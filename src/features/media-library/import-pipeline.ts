import { createProbePool, type ProbePool } from "@/engine/decode";
import type { MediaKind } from "@/engine/types";
import type { MediaBackend, PickedMedia } from "@/platform/media";

import type { ItemUpdate, LibraryItem, MediaLibraryStore } from "./store";

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

  const outcomes = await backend.reopen(saved);
  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  saved.forEach((ref, i) => {
    const o = outcomes[i];
    const found = o?.status === "ok" && (o.kind === "image" || o.kind === "video") ? o : null;
    const id = found?.id ?? ref.id;
    if (seen.has(id)) return;
    seen.add(id);
    report.idMap.set(ref.id, id);
    if (found) {
      items.push({
        id,
        kind: found.kind as MediaKind,
        name: found.name,
        uri: found.uri,
        size: found.size,
        modifiedMs: found.modifiedMs,
        status: "pending",
      });
    } else {
      report.missing.push(ref.name);
      items.push({
        id,
        kind: ref.kind,
        name: ref.name,
        uri: ref.uri,
        size: ref.size,
        modifiedMs: ref.modifiedMs,
        status: "error",
        error: "missing",
      });
    }
  });

  store.getState().addItems(items);
  report.processed = processItems(
    store,
    backend,
    items.filter((i) => i.status === "pending"),
  );
  return report;
}

/** Metadados + miniaturas dos itens recém-adicionados (fotos no Rust, vídeos no worker). */
async function processItems(store: MediaLibraryStore, backend: MediaBackend, fresh: LibraryItem[]): Promise<void> {
  if (fresh.length === 0) return;
  store.getState().beginProgress(fresh.length);

  const batcher = createBatcher(store);
  const images = fresh.filter((i) => i.kind === "image").map((i) => i.id);
  const videos = fresh.filter((i) => i.kind === "video").map((i) => i.id);

  const imageJob = backend.processImages(images, (e) => {
    batcher.push(
      e.type === "done"
        ? { id: e.id, patch: { status: "ready", meta: e.meta, thumbUrl: backend.thumbUrl(e.id) } }
        : { id: e.id, patch: { status: "error", error: e.error } },
    );
  });

  const videoJob = processVideos(store, backend, videos, batcher.push);
  await Promise.all([imageJob, videoJob]);
  batcher.flush();
}

async function processVideos(
  store: MediaLibraryStore,
  backend: MediaBackend,
  ids: string[],
  push: (u: ItemUpdate) => void,
): Promise<void> {
  if (ids.length === 0) return;
  const cached = await backend.cacheGet(ids);
  const todo: string[] = [];
  ids.forEach((id, i) => {
    const meta = cached[i];
    if (meta) push({ id, patch: { status: "ready", meta, thumbUrl: backend.thumbUrl(id) } });
    else todo.push(id);
  });

  videoPool ??= createProbePool(backend.videoProbeConcurrency);
  const pool = videoPool;
  await Promise.all(
    todo.map(async (id) => {
      // Item removido antes de começar? Pula.
      if (!store.getState().items[id]) return push({ id, patch: {} });
      try {
        const res = await pool.run({ id, kind: "video", source: backend.probeSource(id) });
        if (!res.ok) return push({ id, patch: { status: "error", error: res.error } });
        const thumbUrl = res.thumb ? await backend.cachePut(id, res.meta, res.thumb) : undefined;
        push({ id, patch: { status: "ready", meta: res.meta, thumbUrl } });
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
