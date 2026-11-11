/**
 * Edição manual na faixa do tempo: lógica pura (sem React) para arrastar cortes,
 * imantar em batidas, mover mídias e escolher a escala da régua.
 */
import type { TimelineSegment } from "@/engine/timeline";

/** Passos possíveis entre as marcas da régua (s). */
const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** Menor passo cuja distância na tela seja de pelo menos `minPx`. */
export function tickStep(pxPerSec: number, minPx = 64): number {
  return TICK_STEPS.find((s) => s * pxPerSec >= minPx) ?? TICK_STEPS.at(-1)!;
}

/**
 * Imã: se houver um ponto (batida, cursor) a até `thresholdSec` de `t`, devolve o ponto.
 * `points` precisa estar em ordem crescente.
 */
export function snapTime(
  t: number,
  points: readonly number[],
  thresholdSec: number,
): { time: number; snapped: boolean } {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]! < t) lo = mid + 1;
    else hi = mid;
  }
  let best = t;
  let bestDist = thresholdSec;
  for (const p of [points[lo - 1], points[lo]]) {
    if (p === undefined) continue;
    const d = Math.abs(p - t);
    if (d <= bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return { time: best, snapped: best !== t };
}

export interface DurationLimits {
  minSec: number;
  maxSec: number;
}

/** Nova duração do segmento quando o corte de saída é arrastado até `endSec` (tempo da timeline). */
export function durationForEnd(seg: TimelineSegment, endSec: number, limits: DurationLimits): number {
  const d = Math.min(limits.maxSec, Math.max(limits.minSec, endSec - seg.startSec));
  return Math.round(d * 100) / 100;
}

/** Limites de duração de um segmento: vídeos param onde o arquivo acaba. */
export function durationLimits(
  seg: TimelineSegment,
  mediaDurationSec: number | undefined,
  minSec: number,
): DurationLimits {
  if (seg.kind !== "video" || mediaDurationSec === undefined) return { minSec, maxSec: 120 };
  return { minSec: Math.min(minSec, mediaDurationSec), maxSec: Math.max(minSec, mediaDurationSec - seg.sourceInSec) };
}

/** Índice do corte (0..n) mais próximo de `t`: soltar ali insere a mídia antes do segmento de mesmo índice. */
export function nearestBoundary(segments: readonly TimelineSegment[], t: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= segments.length; i++) {
    const seg = segments[i];
    const last = segments[i - 1];
    const time = seg ? seg.startSec : last ? last.startSec + last.durationSec : 0;
    const d = Math.abs(time - t);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Nova ordem da biblioteca ao soltar `activeId` no corte `boundary` da timeline
 * (antes do segmento `boundary`; `segments.length` = depois do último).
 * `null` quando nada muda. Mídias fora da timeline mantêm a posição relativa.
 */
export function reorderForBoundary(
  order: readonly string[],
  segments: readonly TimelineSegment[],
  activeId: string,
  boundary: number,
): string[] | null {
  const from = order.indexOf(activeId);
  if (from < 0 || segments.length === 0) return null;
  const without = order.filter((id) => id !== activeId);
  const before = segments[boundary]?.mediaId;
  let at: number;
  if (before === activeId) return null;
  if (before !== undefined) {
    at = without.indexOf(before);
    if (at < 0) return null;
  } else {
    const lastId = segments.at(-1)!.mediaId;
    if (lastId === activeId) return null;
    const idx = without.indexOf(lastId);
    if (idx < 0) return null;
    at = idx + 1;
  }
  const next = [...without.slice(0, at), activeId, ...without.slice(at)];
  return next.every((id, i) => id === order[i]) ? null : next;
}
