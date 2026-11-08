import type { AspectRatio, QualityPreset, Size } from "../types";

const SHORT_SIDE: Record<QualityPreset, number> = {
  "720p": 720,
  "1080p": 1080,
  "4k": 2160,
};

function parseRatio(aspect: AspectRatio): [number, number] {
  const [w, h] = aspect.split(":").map(Number) as [number, number];
  return [w, h];
}

/** Arredonda para o número par mais próximo (exigência dos encoders H.264). */
function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/**
 * Resolução de saída para um aspect ratio e preset de qualidade.
 * O lado menor recebe o valor do preset (720/1080/2160). Ex.: 9:16 @ 1080p → 1080×1920.
 */
export function outputSize(aspect: AspectRatio, quality: QualityPreset): Size {
  const [rw, rh] = parseRatio(aspect);
  const short = SHORT_SIDE[quality];
  if (rw <= rh) {
    return { width: even(short), height: even((short * rh) / rw) };
  }
  return { width: even((short * rw) / rh), height: even(short) };
}

/** Bitrate de vídeo sugerido (bits/s) — SPEC RF-V21. */
export function suggestedVideoBitrate(quality: QualityPreset, fps: 30 | 60): number {
  const base = { "720p": 6_000_000, "1080p": 12_000_000, "4k": 40_000_000 }[quality];
  return fps === 60 ? Math.round(base * 1.5) : base;
}
