import type { MediaKind, MediaMeta } from "../types";

/** Lado menor dos thumbnails (igual ao Rust: `THUMB_SHORT_SIDE`). */
export const THUMB_SHORT_SIDE = 320;

export type ProbeSource = { type: "url"; url: string } | { type: "blob"; blob: Blob };

export interface ProbeRequest {
  id: string;
  kind: Exclude<MediaKind, never>;
  source: ProbeSource;
}

export type ProbeResult =
  { id: string; ok: true; meta: MediaMeta; thumb: Blob | null } | { id: string; ok: false; error: string };

/** Dimensões do thumbnail para que o lado menor tenha `short` px (sem ampliar). */
export function thumbSize(width: number, height: number, short = THUMB_SHORT_SIDE): { width: number; height: number } {
  const min = Math.max(1, Math.min(width, height));
  if (min <= short) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const s = short / min;
  return { width: Math.round(width * s), height: Math.round(height * s) };
}

/**
 * Data de captura de um vídeo: tag de data (gravação) → data de criação do arquivo (`mvhd`).
 * Datas inválidas ou "zeradas" (1904/1970, comuns em arquivos editados) são ignoradas.
 */
export function captureDate(tags: { date?: Date; creationTime?: Date | null }): number | undefined {
  for (const d of [tags.date, tags.creationTime]) {
    const t = d?.getTime();
    if (t !== undefined && Number.isFinite(t) && t > Date.UTC(1971, 0, 1)) return t;
  }
  return undefined;
}

/** Momento do frame usado como capa do vídeo: evita o primeiro frame (muitas vezes preto). */
export function posterTime(firstTimestamp: number, durationSec: number): number {
  const d = Math.max(0, durationSec - firstTimestamp);
  return firstTimestamp + Math.min(1, d * 0.1);
}
