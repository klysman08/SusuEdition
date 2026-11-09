/**
 * Enquadramento de cada foto na célula (RF-C5): a foto sempre cobre a célula
 * ("cover"); o usuário amplia (zoom ≥ 1) e arrasta (centro da janela visível).
 *
 * O centro é guardado em coordenadas normalizadas da foto, então o enquadramento
 * sobrevive a troca de layout, de proporção e de resolução (preview × export).
 */
import type { Size } from "../types";
import type { Rect } from "./layout";

export interface CellCrop {
  zoom: number;
  /** Centro da janela visível, 0..1 da largura/altura da foto. */
  cx: number;
  cy: number;
}

export const DEFAULT_CROP: CellCrop = { zoom: 1, cx: 0.5, cy: 0.5 };
export const MAX_ZOOM = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Escala px da foto → px da célula. */
function scaleFor(src: Size, cell: Size, zoom: number): number {
  return Math.max(cell.width / src.width, cell.height / src.height) * clamp(zoom, 1, MAX_ZOOM);
}

/** Janela visível da foto (0..1), sempre dentro da foto. */
export function cropWindow(src: Size, cell: Size, crop: CellCrop): Rect {
  if (src.width <= 0 || src.height <= 0) return { x: 0, y: 0, w: 1, h: 1 };
  const s = scaleFor(src, cell, crop.zoom);
  const w = Math.min(1, cell.width / (src.width * s));
  const h = Math.min(1, cell.height / (src.height * s));
  const cx = clamp(crop.cx, w / 2, 1 - w / 2);
  const cy = clamp(crop.cy, h / 2, 1 - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Normaliza o enquadramento (centro dentro dos limites, zoom em [1, MAX]). */
export function clampCrop(src: Size, cell: Size, crop: CellCrop): CellCrop {
  const win = cropWindow(src, cell, crop);
  return { zoom: clamp(crop.zoom, 1, MAX_ZOOM), cx: win.x + win.w / 2, cy: win.y + win.h / 2 };
}

/** Arrasta a foto `dx, dy` px (da célula): a foto acompanha o dedo. */
export function panCrop(src: Size, cell: Size, crop: CellCrop, dx: number, dy: number): CellCrop {
  const s = scaleFor(src, cell, crop.zoom);
  const base = clampCrop(src, cell, crop);
  return clampCrop(src, cell, { ...base, cx: base.cx - dx / (src.width * s), cy: base.cy - dy / (src.height * s) });
}

/**
 * Novo zoom mantendo fixo o ponto da foto sob `anchor` (0..1 da célula;
 * padrão: centro). É o comportamento esperado da pinça e da roda do mouse.
 */
export function zoomCrop(
  src: Size,
  cell: Size,
  crop: CellCrop,
  zoom: number,
  anchor: { x: number; y: number } = { x: 0.5, y: 0.5 },
): CellCrop {
  const before = cropWindow(src, cell, crop);
  const z = clamp(zoom, 1, MAX_ZOOM);
  const after = cropWindow(src, cell, { zoom: z, cx: 0.5, cy: 0.5 });
  const px = before.x + anchor.x * before.w;
  const py = before.y + anchor.y * before.h;
  return clampCrop(src, cell, {
    zoom: z,
    cx: px - anchor.x * after.w + after.w / 2,
    cy: py - anchor.y * after.h + after.h / 2,
  });
}

export function isDefaultCrop(c: CellCrop | undefined): boolean {
  return !c || (Math.abs(c.zoom - 1) < 1e-3 && Math.abs(c.cx - 0.5) < 1e-3 && Math.abs(c.cy - 0.5) < 1e-3);
}

/** Tamanho para decodificar a foto: o suficiente para a célula no zoom atual. */
export function photoDecodeSize(src: Size, cell: Size, zoom: number): Size {
  const s = Math.min(1, scaleFor(src, cell, zoom));
  return { width: Math.max(1, Math.round(src.width * s)), height: Math.max(1, Math.round(src.height * s)) };
}
