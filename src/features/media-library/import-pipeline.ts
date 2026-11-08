import { createProbePool, type ProbePool } from "@/engine/decode";
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
    if (existing[o.id] || seen.has(o.id)) {
      report.duplicates++;
      continue;
    }
    seen.add(o.id);
    fresh.push({ id: o.id, kind: o.kind, name: o.name, size: o.size, modifiedMs: o.modifiedMs, status: "pending" });
  }
  report.added = fresh.length;
  if (fresh.length === 0) return report;

  const state = store.getState();
  state.addItems(fresh);
  state.beginProgress(fresh.length);

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
  return report;
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
