import type { TimelineSegment } from "../timeline";

/** Uma fonte visível no instante `t`. */
export interface ActiveLayer {
  index: number;
  segment: TimelineSegment;
  /** Tempo no arquivo de origem (vídeos). Pode passar do trecho durante um fade. */
  sourceTimeSec: number;
  /** Opacidade 0..1 (a primeira camada é sempre 1). */
  alpha: number;
  /** Posição dentro do segmento: 0 no início, 1 no fim (passa um pouco disso nos fades). */
  progress: number;
}

function fadeHalf(seg: TimelineSegment | undefined): number {
  return seg?.transitionIn.kind === "fade" ? seg.transitionIn.durationSec / 2 : 0;
}

function layer(index: number, seg: TimelineSegment, t: number, alpha: number): ActiveLayer {
  return {
    index,
    segment: seg,
    sourceTimeSec: Math.max(0, seg.sourceInSec + (t - seg.startSec)),
    alpha,
    progress: seg.durationSec > 0 ? (t - seg.startSec) / seg.durationSec : 0,
  };
}

/** Índice do segmento que contém `t` (busca binária; o último inclui o fim). */
export function segmentIndexAt(segments: readonly TimelineSegment[], t: number): number {
  if (segments.length === 0) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid]!.startSec <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Camadas visíveis em `t`. Um fade de duração `d` na entrada do segmento `i` é
 * centrado no corte: vai de `start_i - d/2` a `start_i + d/2`, misturando `i-1` → `i`.
 * Usado igualmente pelo preview e pelo export.
 */
export function layersAt(segments: readonly TimelineSegment[], t: number): ActiveLayer[] {
  const i = segmentIndexAt(segments, t);
  if (i < 0) return [];
  const cur = segments[i]!;
  const next = segments[i + 1];

  const nextHalf = fadeHalf(next);
  if (next && nextHalf > 0 && t >= next.startSec - nextHalf) {
    const mix = (t - (next.startSec - nextHalf)) / (2 * nextHalf);
    return [layer(i, cur, t, 1), layer(i + 1, next, t, Math.min(1, mix))];
  }
  const half = fadeHalf(cur);
  const prev = segments[i - 1];
  if (prev && half > 0 && t < cur.startSec + half) {
    const mix = (t - (cur.startSec - half)) / (2 * half);
    return [layer(i - 1, prev, t, 1), layer(i, cur, t, Math.max(0, mix))];
  }
  return [layer(i, cur, t, 1)];
}

/** Segmentos que começam (ou entram em fade) dentro de `[t, t + aheadSec]` — para pré-carregar. */
export function upcomingSegments(segments: readonly TimelineSegment[], t: number, aheadSec: number): TimelineSegment[] {
  const out: TimelineSegment[] = [];
  const start = Math.max(0, segmentIndexAt(segments, t));
  for (let i = start; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.startSec - fadeHalf(s) > t + aheadSec) break;
    out.push(s);
  }
  return out;
}
