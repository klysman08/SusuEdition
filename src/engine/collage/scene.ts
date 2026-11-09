/** Cena da colagem: tamanhos de saída e geometria compartilhada por preview e export. */
import { resolveFilter, type FilterSettings } from "../render/filters";
import type { AspectRatio, Size } from "../types";
import { cropWindow, DEFAULT_CROP, type CellCrop } from "./crop";
import { layoutCells, type CellRect, type Rect } from "./layout";
import { buildLayout } from "./templates";

/** Medidas de espaçamento são guardadas nesta escala e acompanham a resolução. */
export const REFERENCE_SHORT_SIDE = 1080;

export type CollageQuality = "standard" | "high" | "max";
export const COLLAGE_QUALITIES: readonly CollageQuality[] = ["standard", "high", "max"];
export type ImageFormat = "jpeg" | "png";

export interface CollageDesign {
  aspect: AspectRatio;
  layoutId: string;
  /** Margem externa, espaçamento e raio — px numa saída de 1080 no lado menor. */
  margin: number;
  spacing: number;
  radius: number;
  background: string;
  /** Enquadramento por foto (id da mídia). */
  crops: Record<string, CellCrop>;
  filter: FilterSettings;
}

export interface CollagePhoto {
  id: string;
  /** Tamanho de exibição (orientação EXIF já aplicada). */
  size: Size;
}

const ratio = (aspect: AspectRatio): [number, number] => aspect.split(":").map(Number) as [number, number];

/**
 * Resolução do export (RF-C7): padrão = 1080 no lado menor (redes sociais),
 * alta = 2160, máxima = 4096 no lado maior. `maxSide` limita à capacidade da GPU.
 */
export function collageSize(aspect: AspectRatio, quality: CollageQuality, maxSide = 4096): Size {
  const [rw, rh] = ratio(aspect);
  const longIsW = rw >= rh;
  const shortRatio = Math.min(rw, rh) / Math.max(rw, rh);
  let long: number;
  if (quality === "max") long = 4096;
  else long = (quality === "high" ? 2160 : 1080) / shortRatio;
  long = Math.min(Math.round(long), maxSide, 4096);
  const short = Math.round(long * shortRatio);
  return longIsW ? { width: long, height: short } : { width: short, height: long };
}

/** Tamanho do preview: cabe em `box` (px do dispositivo), mesma proporção do export. */
export function previewSize(aspect: AspectRatio, box: Size, maxSide = 1600): Size {
  const [rw, rh] = ratio(aspect);
  const s = Math.min(box.width / rw, box.height / rh, maxSide / Math.max(rw, rh));
  return { width: Math.max(2, Math.round(rw * s)), height: Math.max(2, Math.round(rh * s)) };
}

export interface CollageGeometry {
  cells: CellRect[];
  /** Por slot: janela visível da foto (0..1). */
  windows: Rect[];
  /** Fator das medidas de referência para esta saída. */
  scale: number;
  radius: number;
}

/** Geometria completa para uma saída de tamanho `size` — igual no preview e no export. */
export function collageGeometry(design: CollageDesign, photos: readonly CollagePhoto[], size: Size): CollageGeometry {
  const scale = Math.min(size.width, size.height) / REFERENCE_SHORT_SIDE;
  const aspects = photos.map((p) => (p.size.height > 0 ? p.size.width / p.size.height : 1));
  const tree = buildLayout(design.layoutId, aspects, size);
  const cells =
    photos.length === 0 ? [] : layoutCells(tree, size, { margin: design.margin * scale, gap: design.spacing * scale });
  const windows = cells.map((c) => {
    const photo = photos[c.slot];
    if (!photo) return { x: 0, y: 0, w: 1, h: 1 };
    return cropWindow(photo.size, { width: c.w, height: c.h }, design.crops[photo.id] ?? DEFAULT_CROP);
  });
  return { cells, windows, scale, radius: design.radius * scale };
}

export function resolvedFilter(design: CollageDesign) {
  return resolveFilter(design.filter);
}

export function collageFileName(date: Date, format: ImageFormat): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `SusuEdition-colagem-${stamp}.${format === "jpeg" ? "jpg" : "png"}`;
}
