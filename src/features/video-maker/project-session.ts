/**
 * Projeto aberto no Video Maker: salvar, reabrir e autosave (RF-G5).
 *
 * Não existe botão "Salvar": assim que a primeira mídia entra, o projeto ganha um id e
 * passa a ser gravado sozinho a cada mudança. O arquivo guarda só os caminhos das
 * mídias e os ajustes (ver `project-file.ts`), então reabrir depois de fechar o
 * programa não exige copiar nada.
 */
import { createStore } from "zustand/vanilla";

import i18n from "@/i18n";
import { cancelPendingVideos, restoreMedia, sourceIds, sourceOf } from "@/features/media-library";
import { restoreMusic } from "@/features/music";
import { getMediaBackend, releaseMedia } from "@/platform/media";
import { getProjectStorage } from "@/platform/projects";

import { resetHistory, withoutHistory } from "./history";
import {
  parseProjectFile,
  parseSummary,
  PROJECT_VERSION,
  projectFingerprint,
  remapOverrides,
  type ProjectMusicRef,
  type ProjectSummary,
  type VideoProjectFile,
} from "./project-file";
import { pickSettings } from "./project-store";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "./store";
import { computeTimeline } from "./timeline-input";

export type SessionStatus = "idle" | "loading" | "saving" | "saved" | "error";

export interface ProjectSessionState {
  /** `null`: ainda não há projeto (nenhuma mídia adicionada). */
  id: string | null;
  name: string;
  createdAt: number;
  savedAt: number | null;
  status: SessionStatus;
  /** Aumenta a cada gravação/remoção: quem lista projetos recarrega. */
  revision: number;
}

const EMPTY: Omit<ProjectSessionState, "revision"> = {
  id: null,
  name: "",
  createdAt: 0,
  savedAt: null,
  status: "idle",
};

export const projectSession = createStore<ProjectSessionState>()(() => ({ ...EMPTY, revision: 0 }));

/** Espera depois da última mudança antes de gravar. */
const AUTOSAVE_DELAY_MS = 900;
const LAST_PROJECT_KEY = "susu.lastProject";

let timer: ReturnType<typeof setTimeout> | null = null;
/** Entre limpar o projeto anterior e carregar as mídias do novo: nada é gravado. */
let restoring = false;
/** Música do arquivo enquanto ela ainda está sendo reaberta (para não gravar "sem música"). */
let pendingMusic: ProjectMusicRef | null = null;
let lastSaved = "";
/** Muda a cada troca de projeto: tarefas em segundo plano do anterior se descartam. */
let epoch = 0;
/** Abrir/fechar/gravar acontecem um de cada vez. */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function bump() {
  projectSession.setState((s) => ({ revision: s.revision + 1 }));
}

function defaultName(): string {
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  return i18n.t("projects.defaultName", { date });
}

/** Estado atual do editor no formato do arquivo de projeto. */
export function buildProjectFile(now = Date.now()): VideoProjectFile {
  const session = projectSession.getState();
  const { order, items } = videoMediaStore.getState();
  const music = videoMusicStore.getState();
  const settings = pickSettings(videoProjectStore.getState());

  const media = order.flatMap((id) => {
    const it = items[id];
    if (!it?.uri) return [];
    return [
      {
        id,
        ...(it.sourceId ? { sourceId: it.sourceId } : {}),
        uri: it.uri,
        name: it.name,
        kind: it.kind,
        size: it.size,
        modifiedMs: it.modifiedMs,
      },
    ];
  });
  const first = order.length > 0 ? items[order[0]!] : undefined;
  const known = new Set(media.map((m) => m.id));
  const overrides = Object.fromEntries(Object.entries(settings.overrides).filter(([id]) => known.has(id)));

  const track = music.track;
  const musicRef: ProjectMusicRef | null =
    pendingMusic && music.status !== "ready"
      ? pendingMusic
      : track?.uri
        ? {
            id: track.id,
            uri: track.uri,
            name: track.name,
            size: track.size,
            selection: music.selection,
            snapToBeats: music.snapToBeats,
          }
        : null;

  const selection = music.status === "ready" ? music.selection : null;
  const timeline = computeTimeline(order, items, overrides, settings.timeline, selection);

  return {
    version: PROJECT_VERSION,
    summary: {
      kind: "video",
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: now,
      mediaCount: media.length,
      durationSec: timeline.durationSec,
      aspect: settings.aspect,
      coverId: first ? sourceOf(first) : null,
    },
    media,
    music: musicRef,
    settings: { ...settings, overrides },
  };
}

/** Igual ⇒ nada novo para gravar. Muda quando o processamento das mídias termina (duração final). */
function fingerprint(file: VideoProjectFile): string {
  const { total, done } = videoMediaStore.getState().progress;
  return projectFingerprint(file) + (done < total ? "|processing" : "");
}

async function writeCurrent(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (restoring) return;
  let { id } = projectSession.getState();
  if (!id) {
    // O projeto nasce junto com a primeira mídia.
    if (videoMediaStore.getState().order.length === 0) return;
    id = crypto.randomUUID();
    projectSession.setState((s) => ({ id, name: s.name || defaultName(), createdAt: Date.now() }));
  }
  const file = buildProjectFile();
  const print = fingerprint(file);
  if (print === lastSaved) return;

  projectSession.setState({ status: "saving" });
  try {
    await (await getProjectStorage()).write(id, JSON.stringify(file));
    lastSaved = print;
    try {
      localStorage.setItem(LAST_PROJECT_KEY, id);
    } catch {
      // armazenamento indisponível: só perde o atalho "continuar"
    }
    if (projectSession.getState().id === id) {
      projectSession.setState({ status: "saved", savedAt: file.summary.updatedAt });
    }
    bump();
  } catch (err) {
    console.error("falha ao salvar o projeto", err);
    if (projectSession.getState().id === id) projectSession.setState({ status: "error" });
  }
}

/** Grava agora (se houver mudanças). Usado ao sair do editor e ao fechar a janela. */
export function saveNow(): Promise<void> {
  return serial(writeCurrent);
}

function scheduleSave() {
  if (restoring) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
}

/** Esvazia o editor sem gravar. */
async function clearEditor(): Promise<void> {
  epoch++;
  pendingMusic = null;
  lastSaved = "";
  const ids = sourceIds(videoMediaStore.getState().items, videoMediaStore.getState().order);
  const musicId = videoMusicStore.getState().track?.id;
  cancelPendingVideos(ids);
  videoMediaStore.getState().clear();
  videoMusicStore.getState().clear();
  videoProjectStore.getState().reset();
  projectSession.setState({ ...EMPTY });
  await releaseMedia(musicId ? [...ids, musicId] : ids).catch(() => {});
}

/** Salva o projeto atual e deixa o editor vazio, pronto para um projeto novo. */
export function newProject(): Promise<void> {
  return serial(async () => {
    await writeCurrent();
    await withoutHistory(clearEditor);
    resetHistory();
  });
}

export interface OpenResult {
  status: "ok" | "notFound" | "invalid";
  /** Nomes dos arquivos que não estão mais no caminho salvo. */
  missing: string[];
  /** `false` quando a música do projeto não pôde ser reaberta. */
  music: Promise<boolean>;
}

/**
 * Abre um projeto salvo: registra de novo as mídias pelos caminhos guardados e
 * restaura música e ajustes. O projeto que estava aberto é salvo antes.
 */
export function openProject(id: string): Promise<OpenResult> {
  return serial(() => withoutHistory(() => loadProject(id)).finally(resetHistory));
}

async function loadProject(id: string): Promise<OpenResult> {
  {
    const fail = (status: "notFound" | "invalid"): OpenResult => ({
      status,
      missing: [],
      music: Promise.resolve(true),
    });
    const json = await (await getProjectStorage()).read(id);
    if (json === null) return fail("notFound");
    const file = parseProjectFile(json);
    if (!file) return fail("invalid");

    await writeCurrent();
    await clearEditor();
    const mine = epoch;
    restoring = true;
    projectSession.setState({
      id,
      name: file.summary.name,
      createdAt: file.summary.createdAt,
      savedAt: file.summary.updatedAt,
      status: "loading",
    });

    try {
      const backend = await getMediaBackend();
      const report = await restoreMedia(videoMediaStore, backend, file.media);
      videoProjectStore.getState().hydrate({
        ...file.settings,
        overrides: remapOverrides(file.settings.overrides, report.idMap),
      });
      pendingMusic = file.music;
      restoring = false;
      // O que acabou de ser carregado já está em disco: só mudanças a partir daqui gravam.
      lastSaved = fingerprint(buildProjectFile());
      projectSession.setState({ status: "saved" });

      const music = file.music
        ? restoreMusic(videoMusicStore, backend, file.music, () => epoch === mine)
            .then((r) => r === "ok" || r === "cancelled")
            .catch(() => false)
        : Promise.resolve(true);
      void Promise.all([report.processed, music]).finally(() => {
        if (epoch !== mine) return;
        pendingMusic = null;
        scheduleSave();
      });
      try {
        localStorage.setItem(LAST_PROJECT_KEY, id);
      } catch {
        // sem armazenamento local
      }
      return { status: "ok", missing: report.missing, music };
    } catch (err) {
      restoring = false;
      await clearEditor();
      throw err;
    }
  }
}

/**
 * Cria uma cópia de um projeto salvo (para testar uma variação sem perder a original).
 * Devolve o id da cópia. As mídias não são duplicadas: a cópia aponta para os mesmos arquivos.
 */
export function duplicateProject(id: string): Promise<string | null> {
  return serial(async () => {
    if (projectSession.getState().id === id) await writeCurrent();
    const storage = await getProjectStorage();
    const json = await storage.read(id);
    const file = json ? parseProjectFile(json) : null;
    if (!file) return null;
    const copyId = crypto.randomUUID();
    const now = Date.now();
    const name = i18n.t("projects.copyName", { name: file.summary.name || i18n.t("projects.untitled") });
    await storage.write(
      copyId,
      JSON.stringify({ ...file, summary: { ...file.summary, name, createdAt: now, updatedAt: now } }),
    );
    bump();
    return copyId;
  });
}

export function renameProject(name: string): void {
  const next = name.trim();
  if (next && next !== projectSession.getState().name) projectSession.setState({ name: next });
}

/** Apaga um projeto salvo. Os arquivos de mídia originais nunca são tocados. */
export function deleteProject(id: string): Promise<void> {
  return serial(async () => {
    if (projectSession.getState().id === id) {
      await withoutHistory(clearEditor);
      resetHistory();
    }
    await (await getProjectStorage()).remove(id);
    bump();
  });
}

export interface ProjectListItem extends ProjectSummary {
  id: string;
}

/** Projetos de vídeo salvos, do mais recente para o mais antigo. */
export async function listProjects(): Promise<ProjectListItem[]> {
  const entries = await (await getProjectStorage()).list();
  return entries
    .flatMap((e) => {
      const summary = parseSummary(e.summary);
      return summary ? [{ id: e.id, ...summary }] : [];
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

let installed = false;

/** Liga o autosave aos stores do editor (uma vez por sessão do app). */
export function installAutosave(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  videoMediaStore.subscribe((s, p) => {
    if (s.order !== p.order || s.items !== p.items) scheduleSave();
  });
  videoMusicStore.subscribe(scheduleSave);
  videoProjectStore.subscribe(scheduleSave);
  projectSession.subscribe((s, p) => {
    if (s.name !== p.name) scheduleSave();
  });
  // Fechar a janela ou mandar o app para segundo plano: grava o que estiver pendente.
  window.addEventListener("pagehide", () => void saveNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void saveNow();
  });
}

installAutosave();
