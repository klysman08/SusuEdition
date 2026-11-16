import {
  Aperture,
  ArrowRightToLine,
  Blend,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  CircleDot,
  Columns3,
  Droplets,
  Flame,
  Grip,
  LayoutGrid,
  Maximize2,
  Moon,
  Rocket,
  RotateCw,
  Rows3,
  Tv,
  Vibrate,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { TransitionKind } from "@/engine/timeline";

/** Ícone de cada transição (seletor do painel "Ritmo" e ajustes da mídia). */
export const TRANSITION_ICONS: Record<TransitionKind, LucideIcon> = {
  fade: Blend,
  dipBlack: Moon,
  blur: Droplets,
  flash: Zap,
  punch: Maximize2,
  shake: Vibrate,
  bounce: CircleDot,
  whipLeft: ChevronsLeft,
  whipRight: ChevronsRight,
  whipUp: ChevronsUp,
  whipDown: ChevronsDown,
  spin: RotateCw,
  warp: Rocket,
  glitch: Tv,
  pixelate: Grip,
  wipe: ArrowRightToLine,
  iris: Aperture,
  burn: Flame,
  frameShift: Columns3,
  slices: Rows3,
  grid: LayoutGrid,
};

/** Mesmo conjunto de transições, em qualquer ordem? */
export function sameKinds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k) => b.includes(k));
}
