/**
 * Extrair o áudio de um vídeo do projeto: salvar como arquivo (M4A/WAV) ou usar como
 * a música do vídeo. Nada é enviado para fora: a conversão roda no próprio dispositivo.
 */
import {
  ALL_FORMATS,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  WavOutputFormat,
} from "mediabunny";

import { makeSource } from "@/engine/decode/source";
import { sourceOf } from "@/features/media-library";
import { loadRegisteredMusic, type LoadMusicResult } from "@/features/music";
import { getExportPlatform } from "@/platform/export";
import { getMediaBackend } from "@/platform/media";

import { videoMediaStore, videoMusicStore } from "./store";

export type AudioFileFormat = "m4a" | "wav";

export type ExtractResult =
  | { status: "saved"; location: string; fileName: string; bytes: number; canReveal: boolean }
  | { status: "cancelled" }
  /** O vídeo não tem trilha de áudio (ou o dispositivo não consegue lê-la). */
  | { status: "noAudio" };

/** Pedaços enviados ao destino (mantém cada chamada ao app nativo pequena). */
const WRITE_CHUNK = 4 * 1024 * 1024;

/** `Férias 2024.mp4` → `Férias 2024.m4a`. */
export function audioFileName(mediaName: string, format: AudioFileFormat): string {
  const base = mediaName.replace(/\.[^./\\]+$/, "").trim() || "audio";
  return `${base}.${format}`;
}

/**
 * Salva a trilha de áudio da mídia `id` num arquivo. M4A copia o áudio original quando
 * ele já é AAC (instantâneo, sem perda); WAV decodifica para PCM de 16 bits.
 */
export async function extractAudioToFile(
  id: string,
  format: AudioFileFormat,
  onProgress?: (fraction: number) => void,
): Promise<ExtractResult> {
  const item = videoMediaStore.getState().items[id];
  if (!item) return { status: "noAudio" };
  const platform = await getExportPlatform();
  const info = await platform.info("audio");
  const fileName = audioFileName(item.name, format);

  let destination: string | null = null;
  if (info.mustPickDestination) {
    destination = await platform.pickDestination(fileName);
    if (!destination) return { status: "cancelled" };
  }

  const backend = await getMediaBackend();
  const input = new Input({ source: makeSource(backend.probeSource(sourceOf(item))), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return { status: "noAudio" };

    if (format === "m4a") {
      const native = await canEncodeAudio("aac").catch(() => false);
      if (!native) {
        // Sem AAC no WebView (alguns Android): encoder WASM, o mesmo da exportação.
        const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
        registerAacEncoder();
      }
    }

    const target = new BufferTarget();
    const output = new Output({ format: format === "wav" ? new WavOutputFormat() : new Mp4OutputFormat(), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: { codec: format === "wav" ? "pcm-s16" : "aac" },
      showWarnings: false,
    });
    if (!conversion.isValid) return { status: "noAudio" };
    conversion.onProgress = (p) => onProgress?.(p);
    await conversion.execute();
    if (!target.buffer) return { status: "noAudio" };

    const bytes = new Uint8Array(target.buffer);
    const sink = await platform.createSink();
    try {
      for (let at = 0; at < bytes.length; at += WRITE_CHUNK) {
        await sink.write(at, bytes.subarray(at, Math.min(bytes.length, at + WRITE_CHUNK)));
      }
      await sink.finish();
      const saved = await sink.save(fileName, destination, "audio");
      return { status: "saved", location: saved.location, fileName, bytes: bytes.length, canReveal: info.canReveal };
    } catch (err) {
      await sink.discard().catch(() => {});
      throw err;
    }
  } finally {
    input.dispose();
  }
}

/** Usa a trilha de áudio da mídia `id` como a música do vídeo (com análise de batidas). */
export async function setVideoAudioAsMusic(id: string): Promise<LoadMusicResult> {
  const item = videoMediaStore.getState().items[id];
  if (!item) return "error";
  const backend = await getMediaBackend();
  return loadRegisteredMusic(videoMusicStore, backend, {
    id: sourceOf(item),
    name: item.name,
    uri: item.uri,
    size: item.size,
    kind: "video",
  });
}
