import type { Beat } from "../types";
import type { TimelineSegment, Transition } from "./types";

export interface BeatSyncOptions {
  /** Quanto cada corte pode se afastar da posição calculada (s). */
  maxDeviationSec: number;
  minClipSec: number;
  /** Peso da distância contra a força da batida (0 = só força, 1 = equilibrado). */
  distanceWeight?: number;
}

export interface BeatSyncStats {
  /** Cortes alinhados a uma batida. */
  snapped: number;
  /** Total de cortes entre segmentos. */
  cuts: number;
}

const EPS = 1e-6;
const r = (n: number) => Math.round(n * 1e6) / 1e6;

/** Primeiro índice com `timeSec >= t` (beats ordenados). */
function lowerBound(beats: readonly Beat[], t: number): number {
  let lo = 0;
  let hi = beats.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]!.timeSec < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Move cada corte para uma batida próxima (RF-V17/RF-V18).
 *
 * - Cada corte procura batidas em `[ideal − desvio, ideal + desvio]`; vence a de maior
 *   `força − peso × distância/desvio` (batidas fortes têm prioridade).
 * - Restrições: duração mínima de cada segmento, vídeos nunca passam do que resta do
 *   clipe, sobra espaço para os segmentos seguintes e o fim do vídeo não muda.
 * - Sem batida válida, o corte fica onde estava. Guloso da esquerda para a direita:
 *   determinístico e O(cortes × batidas no intervalo).
 *
 * @param beats batidas já em tempo de timeline (0 = início do vídeo), ordenadas.
 * @param maxDurations duração máxima de cada segmento (`Infinity` para fotos).
 */
export function syncCutsToBeats(
  segments: readonly TimelineSegment[],
  beats: readonly Beat[],
  maxDurations: readonly number[],
  opts: BeatSyncOptions,
): { cuts: number[]; stats: BeatSyncStats } {
  const n = segments.length;
  const ideal = segments.slice(1).map((s) => s.startSec);
  const stats: BeatSyncStats = { snapped: 0, cuts: ideal.length };
  if (n < 2 || beats.length === 0 || opts.maxDeviationSec <= 0) return { cuts: ideal, stats };

  const last = segments[n - 1]!;
  const end = last.startSec + last.durationSec;
  const weight = opts.distanceWeight ?? 0.6;
  const min = opts.minClipSec;
  const cuts: number[] = [];
  let prev = 0;

  for (let i = 0; i < ideal.length; i++) {
    const c = ideal[i]!;
    const remaining = ideal.length - i; // segmentos depois deste corte
    let lo = Math.max(c - opts.maxDeviationSec, prev + min);
    const hi = Math.min(c + opts.maxDeviationSec, end - min * remaining, prev + (maxDurations[i] ?? Infinity));
    if (i === ideal.length - 1) lo = Math.max(lo, end - (maxDurations[n - 1] ?? Infinity));

    let chosen = Math.min(Math.max(c, prev + min), end - min * remaining);
    if (lo <= hi + EPS) {
      let best: Beat | null = null;
      let bestScore = -Infinity;
      for (let k = lowerBound(beats, lo - EPS); k < beats.length && beats[k]!.timeSec <= hi + EPS; k++) {
        const b = beats[k]!;
        const score = b.strength - weight * (Math.abs(b.timeSec - c) / opts.maxDeviationSec);
        if (score > bestScore) {
          bestScore = score;
          best = b;
        }
      }
      if (best) {
        chosen = best.timeSec;
        stats.snapped++;
      } else {
        chosen = Math.min(Math.max(c, lo), hi);
      }
    }
    cuts.push(r(chosen));
    prev = chosen;
  }
  return { cuts, stats };
}

function clampTransition(t: Transition, prev: number, cur: number): Transition {
  if (t.kind === "cut") return t;
  const d = Math.min(t.durationSec, prev, cur);
  return d > EPS ? { kind: "fade", durationSec: r(d) } : { kind: "cut" };
}

/** Reconstrói os segmentos a partir dos novos cortes (o fim total não muda). */
export function applyCuts(
  segments: readonly TimelineSegment[],
  cuts: readonly number[],
  transition: Transition,
): TimelineSegment[] {
  if (segments.length < 2) return segments.slice();
  const last = segments.at(-1)!;
  const end = last.startSec + last.durationSec;
  const bounds = [0, ...cuts, end];
  const out: TimelineSegment[] = [];
  segments.forEach((seg, i) => {
    const start = bounds[i]!;
    const duration = r(bounds[i + 1]! - start);
    const prev = out.at(-1);
    out.push({
      ...seg,
      startSec: r(start),
      durationSec: duration,
      sourceOutSec: r(seg.sourceInSec + duration),
      transitionIn: prev ? clampTransition(transition, prev.durationSec, duration) : { kind: "cut" },
    });
  });
  return out;
}
