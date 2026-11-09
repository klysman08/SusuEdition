import { createStore } from "zustand/vanilla";

import {
  exportFileName,
  lowerQuality,
  resolveExport,
  startExport,
  type ExportHandle,
  type ExportJob,
  type ExportMedia,
  type ResolvedExport,
} from "@/engine/export";
import type { TimelineResult } from "@/engine/timeline";
import type { QualityPreset } from "@/engine/types";
import { getExportPlatform } from "@/platform/export";
import { getMediaBackend } from "@/platform/media";

import { videoMediaStore, videoMusicStore, videoProjectStore } from "../store";

export type ExportStatus = "idle" | "running" | "saving" | "done" | "error" | "cancelled";

export interface ExportState {
  status: ExportStatus;
  frame: number;
  totalFrames: number;
  startedAt: number;
  finishedAt: number;
  used: ResolvedExport | null;
  fallback: boolean;
  audioCodec: "aac" | "aac-wasm" | null;
  fileName: string;
  location: string | null;
  bytes: number;
  error: string | null;
}

const initial: ExportState = {
  status: "idle",
  frame: 0,
  totalFrames: 0,
  startedAt: 0,
  finishedAt: 0,
  used: null,
  fallback: false,
  audioCodec: null,
  fileName: "",
  location: null,
  bytes: 0,
  error: null,
};

export const exportStore = createStore<ExportState>()(() => initial);

let handle: ExportHandle | null = null;

/** Monta o trabalho de exportação a partir do estado atual do projeto. */
export async function buildJob(timeline: TimelineResult): Promise<ExportJob> {
  const backend = await getMediaBackend();
  const project = videoProjectStore.getState();
  const items = videoMediaStore.getState().items;
  const music = videoMusicStore.getState();

  const media: Record<string, ExportMedia> = {};
  for (const seg of timeline.segments) {
    const it = items[seg.mediaId];
    if (!it?.meta || (it.kind !== "image" && it.kind !== "video")) continue;
    media[seg.mediaId] = {
      kind: it.kind,
      source: backend.probeSource(seg.mediaId),
      size: { width: it.meta.width, height: it.meta.height },
      durationSec: it.meta.durationSec,
    };
  }

  const candidates: ResolvedExport[] = [];
  let q: QualityPreset | null = project.exportQuality;
  while (q) {
    candidates.push(resolveExport({ aspect: project.aspect, quality: q, fps: project.exportFps }));
    q = lowerQuality(q);
  }

  return {
    segments: timeline.segments,
    durationSec: timeline.durationSec,
    audio: timeline.audio,
    media,
    music: music.status === "ready" && music.track && timeline.audio ? backend.probeSource(music.track.id) : null,
    fit: project.fit,
    background: project.background,
    mix: project.mix,
    candidates,
  };
}

async function acquireWakeLock(): Promise<{ release: () => Promise<void> } | null> {
  try {
    return (await navigator.wakeLock?.request("screen")) ?? null;
  } catch {
    return null;
  }
}

/** Exporta o vídeo. Resolve quando termina, é cancelado ou falha (estado no `exportStore`). */
export async function runVideoExport(timeline: TimelineResult): Promise<void> {
  if (handle || timeline.segments.length === 0) return;
  const platform = await getExportPlatform();
  const info = await platform.info();
  const fileName = exportFileName(new Date());

  let destination: string | null = null;
  if (info.mustPickDestination || videoProjectStore.getState().askDestination) {
    destination = await platform.pickDestination(fileName);
    if (!destination) return; // usuário cancelou o "Salvar como"
  }

  exportStore.setState({ ...initial, status: "running", startedAt: performance.now(), fileName });
  const job = await buildJob(timeline);
  const sink = await platform.createSink();
  const wake = await acquireWakeLock();

  try {
    handle = startExport(job, {
      onChunk: (position, data) => sink.write(position, data),
      onMessage: (m) => {
        if (m.type === "started")
          exportStore.setState({ used: m.used, fallback: m.fallback, audioCodec: m.audioCodec });
        else if (m.type === "progress") exportStore.setState({ frame: m.frame, totalFrames: m.totalFrames });
      },
    });
    const end = await handle.finished;
    handle = null;

    if (end.type === "done") {
      exportStore.setState({ status: "saving" });
      const { bytes } = await sink.finish();
      const saved = await sink.save(fileName, destination);
      exportStore.setState({ status: "done", bytes, location: saved.location, finishedAt: performance.now() });
    } else {
      await sink.discard();
      exportStore.setState(
        end.type === "cancelled"
          ? { status: "cancelled", finishedAt: performance.now() }
          : { status: "error", error: end.type === "error" ? end.message : null, finishedAt: performance.now() },
      );
    }
  } catch (err) {
    handle = null;
    await sink.discard().catch(() => {});
    exportStore.setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
  } finally {
    await wake?.release().catch(() => {});
  }
}

export function cancelVideoExport(): void {
  handle?.cancel();
}

export function resetExport(): void {
  if (!handle) exportStore.setState(initial);
}
