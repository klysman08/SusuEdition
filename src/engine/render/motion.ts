/**
 * Movimento lento sobre a mídia (Ken Burns): um zoom ou deslocamento contínuo durante
 * o tempo em que ela fica na tela. Compartilhado pelo preview e pelo export.
 */
import type { ClipLook, MotionKind } from "../timeline/types";
import { NEUTRAL_ADJUST, resolveFilter, type FilterAdjust } from "./filters";
import type { Rect } from "./fit";

export interface MotionTransform {
  /** Ampliação em torno do centro (≥ 1: a mídia nunca fica menor que o enquadramento). */
  scale: number;
  /** Deslocamento como fração da largura/altura do enquadramento original. */
  dx: number;
  dy: number;
}

/** Quanto o zoom varia do início ao fim da mídia. */
export const MOTION_ZOOM = 0.1;
/** O movimento continua um pouco antes/depois do segmento, enquanto ele aparece num fade. */
const OVERSHOOT = 0.2;

/**
 * Transformação no instante `progress` (0 = início do segmento, 1 = fim).
 * `null` quando não há movimento.
 */
export function motionTransform(kind: MotionKind | undefined, progress: number): MotionTransform | null {
  if (!kind || kind === "none") return null;
  const p = Math.min(1 + OVERSHOOT, Math.max(-OVERSHOOT, progress));
  switch (kind) {
    case "zoomIn":
      return { scale: 1 + MOTION_ZOOM * (p + OVERSHOOT), dx: 0, dy: 0 };
    case "zoomOut":
      return { scale: 1 + MOTION_ZOOM * (1 + OVERSHOOT - p), dx: 0, dy: 0 };
    // Deslocamento: ampliado o suficiente para as bordas nunca aparecerem.
    case "panLeft":
      return { scale: 1 + MOTION_ZOOM * (1 + 2 * OVERSHOOT), dx: MOTION_ZOOM * (0.5 - p), dy: 0 };
    case "panRight":
      return { scale: 1 + MOTION_ZOOM * (1 + 2 * OVERSHOOT), dx: MOTION_ZOOM * (p - 0.5), dy: 0 };
  }
}

/** Aplica a transformação ao retângulo de destino da mídia. */
export function applyMotion(rect: Rect, m: MotionTransform | null | undefined): Rect {
  if (!m) return rect;
  const w = rect.w * m.scale;
  const h = rect.h * m.scale;
  return {
    x: rect.x + (rect.w - w) / 2 + m.dx * rect.w,
    y: rect.y + (rect.h - h) / 2 + m.dy * rect.h,
    w,
    h,
  };
}

/** Parâmetros de shader do filtro de uma mídia (`null` = sem filtro). */
export function lookFilter(look: ClipLook | undefined): FilterAdjust | null {
  if (!look || look.preset === "none" || look.intensity <= 0) return null;
  return resolveFilter({ preset: look.preset, intensity: look.intensity, adjust: NEUTRAL_ADJUST });
}
