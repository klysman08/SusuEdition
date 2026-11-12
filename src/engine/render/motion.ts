/**
 * Movimento lento sobre a mídia (Ken Burns): um zoom, deslocamento ou giro contínuo
 * durante o tempo em que ela fica na tela. Compartilhado pelo preview e pelo export.
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
  /** Giro em torno do centro, em radianos (positivo = sentido horário). */
  rotation?: number;
}

/** Quanto o zoom varia do início ao fim da mídia. */
export const MOTION_ZOOM = 0.1;
/** O movimento continua um pouco antes/depois do segmento, enquanto ele aparece num fade. */
const OVERSHOOT = 0.2;
/** Giro: vai de −TILT a +TILT ao longo da mídia. */
export const MOTION_TILT = (2 * Math.PI) / 180;
/** Ampliação que mantém o quadro coberto no maior giro, em qualquer proporção até 16:9. */
const TILT_SCALE = 1.005 + 1.8 * Math.sin(MOTION_TILT * (1 + 2 * OVERSHOOT));
/** Deslocamento: ampliado o suficiente para as bordas nunca aparecerem. */
const PAN_SCALE = 1 + MOTION_ZOOM * (1 + 2 * OVERSHOOT);
/** Impacto: a mídia entra ampliada e assenta nesta fração da duração. */
const PUNCH_SETTLE = 0.3;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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
    case "panLeft":
      return { scale: PAN_SCALE, dx: MOTION_ZOOM * (0.5 - p), dy: 0 };
    case "panRight":
      return { scale: PAN_SCALE, dx: MOTION_ZOOM * (p - 0.5), dy: 0 };
    case "panUp":
      return { scale: PAN_SCALE, dx: 0, dy: MOTION_ZOOM * (0.5 - p) };
    case "panDown":
      return { scale: PAN_SCALE, dx: 0, dy: MOTION_ZOOM * (p - 0.5) };
    // Impacto: entra bem ampliada, assenta rápido e segue num zoom leve — marca a batida.
    case "punch": {
      const settle = 1 - (1 - clamp01(p / PUNCH_SETTLE)) ** 3;
      return { scale: 1 + MOTION_ZOOM * (1.5 * (1 - settle) + 0.3 * (p + OVERSHOOT)), dx: 0, dy: 0 };
    }
    // Pulsar: aproxima até o meio e volta.
    case "pulse":
      return { scale: 1 + MOTION_ZOOM * Math.sin(Math.PI * clamp01(p)), dx: 0, dy: 0 };
    case "tiltLeft":
      return { scale: TILT_SCALE, dx: 0, dy: 0, rotation: MOTION_TILT * (1 - 2 * p) };
    case "tiltRight":
      return { scale: TILT_SCALE, dx: 0, dy: 0, rotation: MOTION_TILT * (2 * p - 1) };
  }
}

/** Aplica a transformação ao retângulo de destino da mídia (o giro fica por conta do compositor). */
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
