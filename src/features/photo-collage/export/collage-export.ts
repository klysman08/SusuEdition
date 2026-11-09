import { createStore } from "zustand/vanilla";

import {
  collageFileName,
  collageSize,
  startCollageExport,
  type CollageExportHandle,
  type CollagePhoto,
} from "@/engine/collage";
import type { Size } from "@/engine/types";
import { getExportPlatform } from "@/platform/export";
import { getMediaBackend } from "@/platform/media";

import { collageProjectStore } from "../store";

export type CollageExportStatus = "idle" | "loading" | "encoding" | "saving" | "done" | "error" | "cancelled";

export interface CollageExportState {
  status: CollageExportStatus;
  loaded: number;
  total: number;
  startedAt: number;
  finishedAt: number;
  size: Size | null;
  fileName: string;
  location: string | null;
  bytes: number;
  error: string | null;
}

const initial: CollageExportState = {
  status: "idle",
  loaded: 0,
  total: 0,
  startedAt: 0,
  finishedAt: 0,
  size: null,
  fileName: "",
  location: null,
  bytes: 0,
  error: null,
};

export const collageExportStore = createStore<CollageExportState>()(() => initial);

let handle: CollageExportHandle | null = null;
let gpuMax: number | null = null;

/** Maior lado que a GPU consegue renderizar (texturas/framebuffers). */
export function gpuMaxSize(): number {
  if (gpuMax !== null) return gpuMax;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gpuMax = gl
      ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number)
      : 4096;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    gpuMax = 4096;
  }
  return gpuMax;
}

/** Resolução final do export para o estado atual. */
export function currentExportSize(): Size {
  const s = collageProjectStore.getState();
  return collageSize(s.aspect, s.exportQuality, gpuMaxSize());
}

const CHUNK = 8 * 1024 * 1024;

/** Gera e salva a colagem (estado em `collageExportStore`). */
export async function runCollageExport(photos: readonly CollagePhoto[]): Promise<void> {
  if (handle || photos.length === 0) return;
  const project = collageProjectStore.getState();
  const platform = await getExportPlatform();
  const info = await platform.info("image");
  const fileName = collageFileName(new Date(), project.exportFormat);

  let destination: string | null = null;
  if (info.mustPickDestination || project.askDestination) {
    destination = await platform.pickDestination(fileName);
    if (!destination) return;
  }

  const size = currentExportSize();
  collageExportStore.setState({
    ...initial,
    status: "loading",
    total: photos.length,
    startedAt: performance.now(),
    size,
    fileName,
  });

  const backend = await getMediaBackend();
  const { aspect, layoutId, margin, spacing, radius, background, crops, filter } = project;
  try {
    handle = startCollageExport(
      {
        design: { aspect, layoutId, margin, spacing, radius, background, crops, filter },
        photos: photos.map((p) => ({ ...p, url: new URL(backend.mediaUrl(p.id), location.href).href })),
        size,
        format: project.exportFormat,
        quality: project.jpegQuality,
      },
      (m) => {
        if (m.type === "progress") collageExportStore.setState({ loaded: m.loaded, total: m.total });
        else collageExportStore.setState({ status: "encoding" });
      },
    );
    const end = await handle.finished;
    handle = null;
    if (end.type !== "done") {
      collageExportStore.setState(
        end.type === "cancelled"
          ? { status: "cancelled", finishedAt: performance.now() }
          : { status: "error", error: end.message, finishedAt: performance.now() },
      );
      return;
    }

    collageExportStore.setState({ status: "saving" });
    const sink = await platform.createSink();
    try {
      for (let pos = 0; pos < end.bytes.length; pos += CHUNK) {
        await sink.write(pos, end.bytes.subarray(pos, Math.min(end.bytes.length, pos + CHUNK)));
      }
      const { bytes } = await sink.finish();
      const saved = await sink.save(fileName, destination, "image");
      collageExportStore.setState({ status: "done", bytes, location: saved.location, finishedAt: performance.now() });
    } catch (err) {
      await sink.discard().catch(() => {});
      throw err;
    }
  } catch (err) {
    handle = null;
    collageExportStore.setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
  }
}

export function cancelCollageExport(): void {
  handle?.cancel();
}

export function resetCollageExport(): void {
  if (!handle) collageExportStore.setState(initial);
}
