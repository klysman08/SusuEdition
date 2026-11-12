/**
 * Corte de uma mídia do vídeo: a parte da foto/vídeo que aparece no quadro.
 * Guardado em fração da mídia (0..1), então vale para qualquer resolução —
 * prévia e exportação usam o mesmo retângulo.
 */
import type { ClipCrop } from "../timeline/types";
import type { Size } from "../types";

export const FULL_CROP: ClipCrop = { x: 0, y: 0, w: 1, h: 1 };
/** Menor lado do corte (fração da mídia). */
export const MIN_CROP = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function isFullCrop(c: ClipCrop | null | undefined): boolean {
  return !c || (c.x <= 1e-3 && c.y <= 1e-3 && c.w >= 1 - 1e-3 && c.h >= 1 - 1e-3);
}

/** Corte válido (dentro da mídia, com o tamanho mínimo) ou `undefined` quando é a mídia inteira. */
export function normalizeCrop(c: ClipCrop | null | undefined): ClipCrop | undefined {
  if (!c || ![c.x, c.y, c.w, c.h].every(Number.isFinite)) return undefined;
  const w = clamp(c.w, MIN_CROP, 1);
  const h = clamp(c.h, MIN_CROP, 1);
  const out = { x: round4(clamp(c.x, 0, 1 - w)), y: round4(clamp(c.y, 0, 1 - h)), w: round4(w), h: round4(h) };
  return isFullCrop(out) ? undefined : out;
}

/** Tamanho (px) da parte cortada. */
export function croppedSize(size: Size, crop: ClipCrop | null | undefined): Size {
  return crop ? { width: size.width * crop.w, height: size.height * crop.h } : size;
}

/**
 * Alvo de decodificação para uma foto cortada: a parte que aparece precisa ter a
 * resolução do quadro, então a foto inteira é decodificada proporcionalmente maior.
 */
export function cropDecodeTarget(target: Size, crop: ClipCrop | null | undefined): Size {
  return crop ? { width: target.width / crop.w, height: target.height / crop.h } : target;
}

/**
 * Maior corte na proporção `ratio` (largura/altura, em px) que cabe na mídia,
 * centrado no corte atual. Usado pelos atalhos de proporção do editor de corte.
 */
export function cropForRatio(size: Size, ratio: number, around: ClipCrop = FULL_CROP): ClipCrop {
  if (size.width <= 0 || size.height <= 0 || ratio <= 0) return FULL_CROP;
  // Proporção em unidades normalizadas: w/h = ratio × altura/largura da mídia.
  const k = (ratio * size.height) / size.width;
  let w = 1;
  let h = w / k;
  if (h > 1) {
    h = 1;
    w = k;
  }
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}
