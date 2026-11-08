/// <reference lib="webworker" />
/**
 * Worker de probe: extrai metadados e gera o thumbnail de vídeos (Mediabunny + WebCodecs).
 * Também processa fotos quando o app roda num navegador comum (sem o Rust).
 *
 * Um vídeo por vez por worker: decoders de hardware são um recurso limitado.
 */
import { ALL_FORMATS, BlobSource, CanvasSink, Input, UrlSource, type MetadataTags, type Rotation } from "mediabunny";

import type { MediaMeta } from "../types";
import {
  captureDate,
  posterTime,
  thumbSize,
  type ProbeRequest,
  type ProbeResult,
  type ProbeSource,
} from "./probe-protocol";

declare const self: DedicatedWorkerGlobalScope;

function makeSource(src: ProbeSource) {
  return src.type === "url"
    ? new UrlSource(src.url, { maxCacheSize: 8 * 1024 * 1024, getRetryDelay: (n) => (n < 2 ? 0.2 : null) })
    : new BlobSource(src.blob);
}

async function toBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
  throw new Error("canvas sem convertToBlob");
}

async function probeVideo(req: ProbeRequest): Promise<ProbeResult> {
  const input = new Input({ source: makeSource(req.source), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) return { id: req.id, ok: false, error: "nenhuma trilha de vídeo" };

    const [width, height, rotation, codec, decodable, audio, durationSec, first, tags] = await Promise.all([
      video.getDisplayWidth(),
      video.getDisplayHeight(),
      video.getRotation(),
      video.getCodecParameterString().catch(() => null),
      video.canDecode().catch(() => false),
      input.getPrimaryAudioTrack().catch(() => null),
      input.computeDuration(),
      video.getFirstTimestamp().catch(() => 0),
      input.getMetadataTags().catch(() => ({}) as MetadataTags),
    ]);

    let thumb: Blob | null = null;
    if (decodable) {
      const size = thumbSize(width, height);
      const sink = new CanvasSink(video, { width: size.width, height: size.height, fit: "cover", poolSize: 1 });
      const frame = (await sink.getCanvas(posterTime(first, durationSec))) ?? (await sink.getCanvas(first));
      if (frame) thumb = await toBlob(frame.canvas);
    }

    const meta: MediaMeta = {
      kind: "video",
      width,
      height,
      rotation: (rotation ?? 0) as Rotation,
      durationSec,
      hasAudio: audio !== null,
      capturedAt: captureDate(tags),
      codec: codec ?? undefined,
      decodable,
      thumbExt: "webp",
    };
    return { id: req.id, ok: true, meta, thumb };
  } finally {
    input.dispose();
  }
}

/** Fotos no modo navegador. No app nativo isso é feito em Rust (mais rápido, multi-core). */
async function probeImage(req: ProbeRequest): Promise<ProbeResult> {
  const blob = req.source.type === "blob" ? req.source.blob : await (await fetch(req.source.url)).blob();
  const full = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const size = thumbSize(full.width, full.height);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context indisponível");
    ctx.drawImage(full, 0, 0, size.width, size.height);
    const thumb = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    const meta: MediaMeta = {
      kind: "image",
      width: full.width,
      height: full.height,
      rotation: 0,
      decodable: true,
      thumbExt: "webp",
    };
    return { id: req.id, ok: true, meta, thumb };
  } finally {
    full.close();
  }
}

self.onmessage = async (e: MessageEvent<ProbeRequest>) => {
  const req = e.data;
  let result: ProbeResult;
  try {
    result = req.kind === "video" ? await probeVideo(req) : await probeImage(req);
  } catch (err) {
    result = { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(result);
};
