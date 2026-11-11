import { createProbePool, type ProbePool } from "@/engine/decode";
import type { MediaKind } from "@/engine/types";
import { releaseMedia, type MediaBackend, type PickedMedia } from "@/platform/media";

import { sourceIds, sourceOf, type ItemUpdate, type LibraryItem, type MediaLibraryStore } from "./store";

export interface ImportReport {
  added: number;
  duplicates: number;
  failed: { name: string; error: string }[];
}

/**
 * Agrupa atualizações e aplica no store no máximo a cada `interval` ms.
 * Com 150+ itens isso evita centenas de renders seguidos durante o import.
 */
function createBatcher(store: MediaLibraryStore, interval = 120) {
  let pending: ItemUpdate[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    store.getState().applyUpdates(batch);
    store.getState().advanceProgress(batch.length);
  };
  return {
    push(u: ItemUpdate) {
      pending.push(u);
      timer ??= setTimeout(flush, interval);
    },
    flush() {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}

let videoPool: ProbePool | null = null;

/**
 * Importa mídias para a biblioteca:
 * 1. registra (rápido) e mostra os itens imediatamente como "pendentes";
 * 2. fotos: processadas em paralelo no Rust (ou no worker, no navegador);
 * 3. vídeos: cache em disco → senão probe + thumbnail no worker (Mediabunny).
 */
export async function importMedia(
  store: MediaLibraryStore,
  backend: MediaBackend,
  picked: PickedMedia[],
  opts: { imagesOnly?: boolean } = {},
): Promise<ImportReport> {
  const report: ImportReport = { added: 0, duplicates: 0, failed: [] };
  if (picked.length === 0) return report;

  const outcomes = await backend.register(picked);
  const existing = store.getState().items;
  const fresh: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const o of outcomes) {
    if (o.status === "error") {
      report.failed.push({ name: o.uri, error: o.error });
      continue;
    }
    // A biblioteca aceita só fotos e vídeos (música tem seu próprio passo).
    if (o.kind !== "image" && o.kind !== "video") {
      report.failed.push({ name: o.name, error: "unsupported" });
      continue;
    }
    if (opts.imagesOnly && o.kind !== "image") {
      report.failed.push({ name: o.name, error: "imagesOnly" });
      continue;
    }
    if (existing[o.id] || seen.has(o.id)) {
      report.duplicates++;
      continue;
    }
    seen.add(o.id);
    fresh.push({
      id: o.id,
      kind: o.kind,
      name: o.name,
      uri: o.uri,
      size: o.size,
      modifiedMs: o.modifiedMs,
      status: "pending",
    });
  }
  report.added = fresh.length;
  if (fresh.length === 0) return report;

  store.getState().addItems(fresh);
  await processItems(store, backend, fresh);
  return report;
}

/** Mídia de um projeto salvo. */
export interface SavedMedia {
  id: string;
  /** Arquivo de origem quando esta mídia é um trecho extra do mesmo arquivo (vídeo dividido). */
  sourceId?: string;
  uri: string;
  name: string;
  kind: MediaKind;
  size: number;
  modifiedMs?: number;
}

export interface RestoreReport {
  /** id salvo → id atual (difere quando o arquivo mudou desde que o projeto foi salvo). */
  idMap: Map<string, string>;
  /** Arquivos que não estão mais no caminho salvo. */
  missing: string[];
  /** Resolve quando miniaturas e metadados estiverem prontos. */
  processed: Promise<void>;
}

/**
 * Reabre as mídias de um projeto salvo a partir dos caminhos guardados, na mesma ordem.
 * Arquivos não encontrados continuam no projeto como "ausentes" (não são descartados:
 * um HD externo desconectado não pode apagar metade do projeto no próximo autosave).
 * Retorna assim que os itens entram na biblioteca; o processamento segue em `processed`.
 */
export async function restoreMedia(
  store: MediaLibraryStore,
  backend: MediaBackend,
  saved: readonly SavedMedia[],
): Promise<RestoreReport> {
  const report: RestoreReport = { idMap: new Map(), missing: [], processed: Promise.resolve() };
  if (saved.length === 0) return report;

  const outcomes = await backend.reopen(saved.map((r) => ({ id: r.sourceId ?? r.id, uri: r.uri })));
  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  const missing = new Set<string>();
  saved.forEach((ref, i) => {
    const o = outcomes[i];
    const found = o?.status === "ok" && (o.kind === "image" || o.kind === "video") ? o : null;
    // Trecho extra de um arquivo: mantém o próprio id e aponta para o arquivo (reaberto).
    const alias = ref.sourceId !== undefined && ref.sourceId !== ref.id;
    const source = found?.id ?? ref.sourceId ?? ref.id;
    const id = alias ? ref.id : source;
    if (seen.has(id)) return;
    seen.add(id);
    report.idMap.set(ref.id, id);
    if (!found) missing.add(ref.name);
    items.push({
      id,
      ...(alias ? { sourceId: source } : {}),
      kind: found ? (found.kind as MediaKind) : ref.kind,
      name: found?.name ?? ref.name,
      uri: found?.uri ?? ref.uri,
      size: found?.size ?? ref.size,
      modifiedMs: found ? found.modifiedMs : ref.modifiedMs,
      ...(found ? { status: "pending" as const } : { status: "error" as const, error: "missing" }),
    });
  });
  report.missing = [...missing];

  store.getState().addItems(items);
  report.processed = processItems(
    store,
    backend,
    items.filter((i) => i.status === "pending"),
  );
  return report;
}

export type RelinkResult = "ok" | "cancelled" | "unsupported" | "duplicate" | "error";

/**
 * Troca o arquivo de uma mídia (ex.: "arquivo não encontrado" depois de mover a pasta):
 * a mídia mantém a posição no projeto e passa a apontar para o arquivo escolhido.
 * `newId` é o id da mídia depois da troca (os ajustes dela devem segui-lo).
 */
export async function relinkMedia(
  store: MediaLibraryStore,
  backend: MediaBackend,
  id: string,
  picked: PickedMedia[],
): Promise<{ result: RelinkResult; newId?: string }> {
  const current = store.getState().items[id];
  if (!current || picked.length === 0) return { result: "cancelled" };
  const [o] = await backend.register(picked.slice(0, 1));
  if (!o || o.status === "error") return { result: "error" };
  if (o.kind !== current.kind) return { result: "unsupported" };

  const alias = current.sourceId !== undefined;
  const newId = alias ? id : o.id;
  if (newId !== id && store.getState().items[newId]) return { result: "duplicate" };
  const file = { name: o.name, uri: o.uri, size: o.size, modifiedMs: o.modifiedMs };
  const oldSource = sourceOf(current);
  store.getState().replaceItem(id, {
    id: newId,
    ...(alias ? { sourceId: o.id } : {}),
    kind: current.kind,
    ...file,
    status: "pending",
  });
  // Outros trechos do mesmo arquivo passam a usar o arquivo novo também.
  const siblings = Object.values(store.getState().items).filter((i) => i.id !== newId && sourceOf(i) === oldSource);
  for (const s of siblings) {
    store.getState().replaceItem(s.id, { id: s.id, sourceId: o.id, kind: s.kind, ...file, status: "pending" });
  }
  const fresh = [newId, ...siblings.map((s) => s.id)].flatMap((x) => store.getState().items[x] ?? []);
  await processItems(store, backend, fresh);
  if (oldSource !== o.id) void releaseMedia([oldSource]);
  return { result: "ok", newId };
}

/** Processa de novo mídias já presentes na biblioteca (ex.: recolocadas por um "desfazer"). */
export function reprocessMedia(store: MediaLibraryStore, backend: MediaBackend, ids: readonly string[]): Promise<void> {
  return processItems(
    store,
    backend,
    ids.flatMap((id) => store.getState().items[id] ?? []),
  );
}

/** Remove mídias da biblioteca e libera os arquivos que ninguém mais usa. */
export async function removeMedia(store: MediaLibraryStore, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const sources = sourceIds(store.getState().items, ids);
  store.getState().remove([...ids]);
  const still = new Set(sourceIds(store.getState().items, store.getState().order));
  const unused = sources.filter((s) => !still.has(s));
  cancelPendingVideos(unused);
  await releaseMedia(unused);
}

/**
 * Metadados + miniaturas dos itens recém-adicionados (fotos no Rust, vídeos no worker).
 * Várias mídias podem apontar para o mesmo arquivo (trechos de um vídeo dividido):
 * o arquivo é processado uma vez e o resultado vale para todas.
 */
async function processItems(store: MediaLibraryStore, backend: MediaBackend, fresh: LibraryItem[]): Promise<void> {
  if (fresh.length === 0) return;
  store.getState().beginProgress(fresh.length);

  const batcher = createBatcher(store);
  const clips = new Map<string, string[]>();
  const kinds = new Map<string, MediaKind>();
  for (const item of fresh) {
    const source = sourceOf(item);
    clips.set(source, [...(clips.get(source) ?? []), item.id]);
    kinds.set(source, item.kind);
  }
  const push = (u: ItemUpdate) => {
    for (const id of clips.get(u.id) ?? [u.id]) batcher.push({ id, patch: u.patch });
  };
  const wanted = (source: string) => (clips.get(source) ?? []).some((id) => store.getState().items[id]);
  const images = [...kinds].filter(([, k]) => k === "image").map(([s]) => s);
  const videos = [...kinds].filter(([, k]) => k === "video").map(([s]) => s);

  const imageJob = backend.processImages(images, (e) => {
    push(
      e.type === "done"
        ? { id: e.id, patch: { status: "ready", error: undefined, meta: e.meta, thumbUrl: backend.thumbUrl(e.id) } }
        : { id: e.id, patch: { status: "error", error: e.error } },
    );
  });

  const videoJob = processVideos(backend, videos, push, wanted);
  await Promise.all([imageJob, videoJob]);
  batcher.flush();
}

async function processVideos(
  backend: MediaBackend,
  ids: string[],
  push: (u: ItemUpdate) => void,
  wanted: (id: string) => boolean,
): Promise<void> {
  if (ids.length === 0) return;
  const cached = await backend.cacheGet(ids);
  const todo: string[] = [];
  ids.forEach((id, i) => {
    const meta = cached[i];
    if (meta) push({ id, patch: { status: "ready", error: undefined, meta, thumbUrl: backend.thumbUrl(id) } });
    else todo.push(id);
  });

  videoPool ??= createProbePool(backend.videoProbeConcurrency);
  const pool = videoPool;
  await Promise.all(
    todo.map(async (id) => {
      // Item removido antes de começar? Pula.
      if (!wanted(id)) return push({ id, patch: {} });
      try {
        const res = await pool.run({ id, kind: "video", source: backend.probeSource(id) });
        if (!res.ok) return push({ id, patch: { status: "error", error: res.error } });
        const thumbUrl = res.thumb ? await backend.cachePut(id, res.meta, res.thumb) : undefined;
        push({ id, patch: { status: "ready", error: undefined, meta: res.meta, thumbUrl } });
      } catch (err) {
        push({ id, patch: { status: "error", error: err instanceof Error ? err.message : String(err) } });
      }
    }),
  );
}

/** Cancela vídeos ainda na fila (ex.: itens removidos durante o import). */
export function cancelPendingVideos(ids: string[]): void {
  videoPool?.cancel(ids);
}
