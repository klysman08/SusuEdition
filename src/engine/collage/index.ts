/**
 * Photo Collage (M6): geometria dos layouts. Valores em pixels da saída.
 */
import type { AspectRatio } from "../types";

export interface CollageCell {
  /** Retângulo normalizado 0..1 dentro da área útil (descontada a margem). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollageLayout {
  id: string;
  /** Quantidade de fotos que o layout comporta. */
  slots: number;
  cells: CollageCell[];
}

export interface CollageSettings {
  aspect: AspectRatio;
  /** Margem externa em px (padrão 0). */
  marginPx: number;
  /** Espaçamento entre células em px (padrão 0). */
  spacingPx: number;
  cornerRadiusPx: number;
  backgroundColor: string;
}

export const DEFAULT_COLLAGE_SETTINGS: CollageSettings = {
  aspect: "1:1",
  marginPx: 0,
  spacingPx: 0,
  cornerRadiusPx: 0,
  backgroundColor: "#ffffff",
};
