import type { FitMode, Size } from "../types";

/** Retângulo em pixels do destino (origem no canto superior esquerdo). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Onde desenhar uma fonte `src` dentro de `dst`:
 * - fit: cabe inteira (sobram faixas, preenchidas pelo fundo);
 * - cover: preenche tudo (as bordas excedentes ficam fora do quadro);
 * - fill: estica para o tamanho exato.
 */
export function fitRect(src: Size, dst: Size, mode: FitMode): Rect {
  if (mode === "fill" || src.width <= 0 || src.height <= 0) return { x: 0, y: 0, w: dst.width, h: dst.height };
  const sx = dst.width / src.width;
  const sy = dst.height / src.height;
  const s = mode === "fit" ? Math.min(sx, sy) : Math.max(sx, sy);
  const w = src.width * s;
  const h = src.height * s;
  return { x: (dst.width - w) / 2, y: (dst.height - h) / 2, w, h };
}

/** `true` quando o retângulo cobre todo o destino (o fundo não aparece). */
export function coversTarget(r: Rect, dst: Size, eps = 0.5): boolean {
  return r.x <= eps && r.y <= eps && r.x + r.w >= dst.width - eps && r.y + r.h >= dst.height - eps;
}

/** Tamanho para decodificar uma imagem que vai cobrir `dst` sem ampliar além do original. */
export function decodeSize(src: Size, dst: Size): Size {
  const s = Math.min(1, Math.max(dst.width / src.width, dst.height / src.height));
  return { width: Math.max(1, Math.round(src.width * s)), height: Math.max(1, Math.round(src.height * s)) };
}
