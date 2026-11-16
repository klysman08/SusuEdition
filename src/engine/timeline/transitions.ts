/**
 * Catálogo das transições entre mídias. O desenho de cada uma fica no shader
 * (`render/transition-glsl.ts`); aqui estão a ordem, o grupo, a duração natural e o
 * efeito sonoro que combina com ela.
 */
import type { SfxKind } from "../audio/sfx";

/** A ordem é a do shader: o índice vira o `u_kind`. Só acrescente no fim. */
export const TRANSITION_KINDS = [
  "fade",
  "dipBlack",
  "blur",
  "flash",
  "punch",
  "shake",
  "bounce",
  "whipLeft",
  "whipRight",
  "whipUp",
  "whipDown",
  "spin",
  "warp",
  "glitch",
  "pixelate",
  "wipe",
  "iris",
  "burn",
  "frameShift",
  "slices",
  "grid",
] as const;

export type TransitionKind = (typeof TRANSITION_KINDS)[number];

export type TransitionCategory = "smooth" | "impact" | "speed" | "effects";

export const TRANSITION_CATEGORIES: readonly TransitionCategory[] = ["smooth", "impact", "speed", "effects"];

export interface TransitionInfo {
  category: TransitionCategory;
  /** Duração que funciona bem para esta transição (s). */
  durationSec: number;
  /** Som usado quando o efeito sonoro está em "automático". */
  sound: SfxKind;
}

export const TRANSITIONS: Record<TransitionKind, TransitionInfo> = {
  fade: { category: "smooth", durationSec: 0.5, sound: "swish" },
  dipBlack: { category: "smooth", durationSec: 0.7, sound: "swish" },
  blur: { category: "smooth", durationSec: 0.6, sound: "swish" },
  flash: { category: "impact", durationSec: 0.35, sound: "shutter" },
  punch: { category: "impact", durationSec: 0.4, sound: "impact" },
  shake: { category: "impact", durationSec: 0.4, sound: "impact" },
  bounce: { category: "impact", durationSec: 0.45, sound: "pop" },
  whipLeft: { category: "speed", durationSec: 0.4, sound: "whoosh" },
  whipRight: { category: "speed", durationSec: 0.4, sound: "whoosh" },
  whipUp: { category: "speed", durationSec: 0.4, sound: "whoosh" },
  whipDown: { category: "speed", durationSec: 0.4, sound: "whoosh" },
  spin: { category: "speed", durationSec: 0.5, sound: "whoosh" },
  warp: { category: "speed", durationSec: 0.45, sound: "whoosh" },
  glitch: { category: "effects", durationSec: 0.4, sound: "glitch" },
  pixelate: { category: "effects", durationSec: 0.5, sound: "glitch" },
  wipe: { category: "effects", durationSec: 0.5, sound: "swish" },
  iris: { category: "effects", durationSec: 0.6, sound: "swish" },
  burn: { category: "effects", durationSec: 0.8, sound: "chime" },
  frameShift: { category: "effects", durationSec: 0.6, sound: "whoosh" },
  slices: { category: "effects", durationSec: 0.6, sound: "whoosh" },
  grid: { category: "effects", durationSec: 0.8, sound: "click" },
};

export function isTransitionKind(v: unknown): v is TransitionKind {
  return typeof v === "string" && (TRANSITION_KINDS as readonly string[]).includes(v);
}

/** Transições de um grupo, na ordem do catálogo. */
export function transitionsIn(category: TransitionCategory): TransitionKind[] {
  return TRANSITION_KINDS.filter((k) => TRANSITIONS[k].category === category);
}

/** Número da transição no shader. */
export function transitionIndex(kind: TransitionKind): number {
  return TRANSITION_KINDS.indexOf(kind);
}
