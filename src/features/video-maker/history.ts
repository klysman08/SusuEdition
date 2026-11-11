/**
 * Desfazer/refazer do Video Maker (RF-G6).
 *
 * Guarda fotografias do que o usuário edita — ajustes do projeto, ordem e conjunto de
 * mídias, trecho da música — e volta a elas. Mudanças em sequência rápida (arrastar um
 * slider, dividir uma mídia) viram uma entrada só. Mídias removidas voltam: o arquivo é
 * registrado de novo pelo caminho guardado.
 */
import { createStore } from "zustand/vanilla";

import type { Selection } from "@/engine/audio";
import { cancelPendingVideos, reprocessMedia, sourceIds, sourceOf, type LibraryItem } from "@/features/media-library";
import { getMediaBackend, releaseMedia } from "@/platform/media";

import { pickSettings, type VideoProjectSettings } from "./project-store";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "./store";

interface Snapshot {
  settings: VideoProjectSettings;
  order: string[];
  items: Record<string, LibraryItem>;
  trackId: string | null;
  selection: Selection | null;
  /** Compara o que é editável (ignora miniaturas e metadados que chegam do processamento). */
  key: string;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export const historyStore = createStore<HistoryState>()(() => ({ canUndo: false, canRedo: false }));

const LIMIT = 100;
/** Mudanças mais próximas que isto contam como uma edição só. */
const COALESCE_MS = 350;

let past: Snapshot[] = [];
let future: Snapshot[] = [];
let head: Snapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Enquanto um desfazer/refazer (ou a abertura de um projeto) mexe nos stores, nada é gravado. */
let paused = 0;

function take(): Snapshot {
  const { order, items } = videoMediaStore.getState();
  const music = videoMusicStore.getState();
  const settings = pickSettings(videoProjectStore.getState());
  const selection = music.status === "ready" ? music.selection : null;
  const trackId = music.track?.id ?? null;
  return {
    settings,
    order: [...order],
    items,
    trackId,
    selection,
    key: JSON.stringify([settings, order, trackId, selection]),
  };
}

function publish() {
  historyStore.setState({ canUndo: past.length > 0, canRedo: future.length > 0 });
}

/**
 * Importar mídias não é uma edição a desfazer: as novas entram em todas as fotografias
 * (no fim da ordem), então voltar no histórico nunca tira do projeto o que foi importado.
 * Trechos criados por "dividir" (têm `sourceId`) ficam de fora — esses se desfazem.
 */
function foldImports(next: Snapshot) {
  if (!head) return;
  const known = new Set(head.order);
  const added = next.order.filter((id) => !known.has(id) && next.items[id] && !next.items[id].sourceId);
  if (added.length === 0) return;
  const patch = (s: Snapshot): Snapshot => {
    const have = new Set(s.order);
    const extra = added.filter((id) => !have.has(id));
    if (extra.length === 0) return s;
    const order = [...s.order, ...extra];
    const items = { ...s.items };
    for (const id of extra) items[id] = next.items[id]!;
    return { ...s, order, items, key: JSON.stringify([s.settings, order, s.trackId, s.selection]) };
  };
  past = past.map(patch);
  future = future.map(patch);
  head = patch(head);
}

function commit() {
  timer = null;
  if (paused > 0) return;
  const next = take();
  if (!head) {
    head = next;
    return;
  }
  foldImports(next);
  // Trocar de música não é desfazível (a análise e o trecho pertencem à faixa): só avança.
  // O mesmo vale para o trecho que aparece quando a análise da música termina.
  const musicLoaded = head.selection === null && next.selection !== null;
  if (next.key === head.key || next.trackId !== head.trackId || musicLoaded) {
    head = next; // também mantém as mídias atualizadas (miniaturas prontas)
    return;
  }
  past.push(head);
  if (past.length > LIMIT) past.shift();
  future = [];
  head = next;
  publish();
}

function schedule() {
  if (paused > 0) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(commit, COALESCE_MS);
}

/** Esquece o histórico e parte do estado atual (projeto novo ou recém-aberto). */
export function resetHistory(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  past = [];
  future = [];
  head = take();
  publish();
}

/** Executa `fn` sem que as mudanças entrem no histórico. */
export async function withoutHistory<T>(fn: () => Promise<T>): Promise<T> {
  paused++;
  try {
    return await fn();
  } finally {
    paused--;
  }
}

async function apply(target: Snapshot): Promise<void> {
  const current = videoMediaStore.getState();
  // Mídias atuais mantêm os dados mais novos; as que voltam vêm da fotografia.
  const items: Record<string, LibraryItem> = {};
  const back: string[] = [];
  for (const id of target.order) {
    const live = current.items[id];
    const saved = target.items[id];
    if (live) items[id] = live;
    else if (saved) {
      items[id] = { ...saved, status: saved.status === "error" ? "error" : "pending", thumbUrl: undefined };
      back.push(id);
    }
  }
  const gone = current.order.filter((id) => !items[id]);
  const goneSources = sourceIds(current.items, gone);

  const backend = await getMediaBackend();
  if (back.length > 0) {
    // Registra de novo os arquivos das mídias que voltam (foram liberados ao remover).
    const refs = back.flatMap((id) => {
      const it = items[id]!;
      return it.uri ? [{ id: sourceOf(it), uri: it.uri }] : [];
    });
    await backend.reopen(refs).catch(() => []);
  }

  videoMediaStore.getState().restore(target.order, items);
  videoProjectStore.getState().hydrate(target.settings);
  const music = videoMusicStore.getState();
  if (target.selection && music.status === "ready" && music.track?.id === target.trackId) {
    music.setSelection(target.selection);
  }

  if (gone.length > 0) {
    const still = new Set(sourceIds(items, target.order));
    const unused = goneSources.filter((s) => !still.has(s));
    cancelPendingVideos(unused);
    void releaseMedia(unused);
  }
  const pending = back.filter((id) => items[id]?.status === "pending");
  if (pending.length > 0) void reprocessMedia(videoMediaStore, backend, pending);
}

async function step(from: Snapshot[], to: Snapshot[]): Promise<void> {
  // Uma edição ainda no intervalo de agrupamento entra no histórico antes de voltar.
  if (timer) {
    clearTimeout(timer);
    commit();
  }
  const target = from.pop();
  if (!target || !head) return;
  to.push(head);
  await withoutHistory(() => apply(target));
  head = take();
  publish();
}

let busy: Promise<void> = Promise.resolve();

export function undo(): Promise<void> {
  busy = busy.then(() => step(past, future)).catch(() => {});
  return busy;
}

export function redo(): Promise<void> {
  busy = busy.then(() => step(future, past)).catch(() => {});
  return busy;
}

let installed = false;

/** Liga o histórico aos stores do editor (uma vez por sessão do app). */
export function installHistory(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  head = take();
  videoMediaStore.subscribe((s, p) => {
    if (s.order !== p.order) schedule();
  });
  videoMusicStore.subscribe((s, p) => {
    if (s.selection !== p.selection || s.track !== p.track) schedule();
  });
  videoProjectStore.subscribe(schedule);
}

installHistory();
