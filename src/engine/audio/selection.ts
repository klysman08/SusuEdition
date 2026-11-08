import type { Beat } from "../types";

/** Trecho escolhido da música, em segundos do arquivo. */
export interface Selection {
  inSec: number;
  outSec: number;
}

export const MIN_SELECTION_SEC = 1;
/** Distância máxima para "grudar" numa batida. */
export const SNAP_DISTANCE_SEC = 0.25;
export const DEFAULT_SELECTION_SEC = 60;

const round = (t: number) => Math.round(t * 1000) / 1000;

/** Garante 0 ≤ in < out ≤ duração e duração mínima. */
export function clampSelection(sel: Selection, durationSec: number, min = MIN_SELECTION_SEC): Selection {
  const minLen = Math.min(min, durationSec);
  let inSec = Math.min(Math.max(0, sel.inSec), Math.max(0, durationSec - minLen));
  const outSec = Math.min(Math.max(sel.outSec, inSec + minLen), durationSec);
  if (outSec - inSec < minLen) inSec = Math.max(0, outSec - minLen);
  return { inSec: round(inSec), outSec: round(outSec) };
}

/** Batida mais próxima de `t` dentro de `maxDist` (ou `null`). Busca binária: beats ordenados. */
export function nearestBeat(t: number, beats: readonly Beat[], maxDist = SNAP_DISTANCE_SEC): Beat | null {
  if (beats.length === 0) return null;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]!.timeSec < t) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [beats[lo - 1], beats[lo]].filter((b): b is Beat => b !== undefined);
  const best = candidates.reduce((a, b) => (Math.abs(b.timeSec - t) < Math.abs(a.timeSec - t) ? b : a));
  return Math.abs(best.timeSec - t) <= maxDist ? best : null;
}

export function snapTime(t: number, beats: readonly Beat[], enabled: boolean, maxDist = SNAP_DISTANCE_SEC): number {
  if (!enabled) return t;
  return nearestBeat(t, beats, maxDist)?.timeSec ?? t;
}

/**
 * Seleção inicial: começa na primeira batida forte dos primeiros 10 s (pula silêncio
 * de introdução) e dura até `preferred` segundos, terminando numa batida se houver uma perto.
 */
export function defaultSelection(
  durationSec: number,
  beats: readonly Beat[],
  preferred = DEFAULT_SELECTION_SEC,
): Selection {
  const strong = beats.find((b) => b.strength >= 0.3 && b.timeSec <= 10);
  const inSec = strong?.timeSec ?? 0;
  const target = Math.min(durationSec, inSec + preferred);
  const outSec = target >= durationSec ? durationSec : snapTime(target, beats, true, 0.5);
  return clampSelection({ inSec, outSec }, durationSec);
}

/** Move a seleção inteira mantendo a duração. */
export function moveSelection(sel: Selection, deltaSec: number, durationSec: number): Selection {
  const len = sel.outSec - sel.inSec;
  const inSec = Math.min(Math.max(0, sel.inSec + deltaSec), Math.max(0, durationSec - len));
  return { inSec: round(inSec), outSec: round(inSec + len) };
}

/** Ajusta uma das bordas (com snap opcional às batidas). */
export function setEdge(
  sel: Selection,
  edge: "in" | "out",
  t: number,
  durationSec: number,
  beats: readonly Beat[] = [],
  snap = false,
): Selection {
  const time = snapTime(t, beats, snap);
  if (edge === "in") {
    const inSec = Math.min(Math.max(0, time), sel.outSec - MIN_SELECTION_SEC);
    return clampSelection({ inSec, outSec: sel.outSec }, durationSec);
  }
  const outSec = Math.max(Math.min(durationSec, time), sel.inSec + MIN_SELECTION_SEC);
  return clampSelection({ inSec: sel.inSec, outSec }, durationSec);
}

/**
 * Define a duração mantendo o início (ou recuando-o se passar do fim da música).
 * `null` = música inteira.
 */
export function withLength(
  sel: Selection,
  lengthSec: number | null,
  durationSec: number,
  beats: readonly Beat[] = [],
  snap = false,
): Selection {
  if (lengthSec === null || lengthSec >= durationSec) return { inSec: 0, outSec: round(durationSec) };
  let inSec = sel.inSec;
  if (inSec + lengthSec > durationSec) inSec = durationSec - lengthSec;
  const outSec = snapTime(inSec + lengthSec, beats, snap);
  return clampSelection({ inSec, outSec }, durationSec);
}
