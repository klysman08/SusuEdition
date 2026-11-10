import { medianInterval } from "./rhythm";
import type { BeatSyncPreset, RhythmBeat, TimelineSegment, Transition } from "./types";

/** Como um estilo de sincronia pesa cada característica da música. */
export interface BeatSyncProfile {
  /** Quanto a duração de cada mídia pode variar (fração da duração planejada). */
  flex: number;
  /** Peso da força do onset na batida. */
  strength: number;
  /** Bônus para inícios de compasso. */
  bar: number;
  /** Bônus para mudanças de seção (refrão, drop, pausa). */
  boundary: number;
  /** 0..1 — quanto a energia da música acelera/desacelera os cortes. */
  pacing: number;
  /** Penalidade por fugir da duração-alvo (maior = ritmo mais uniforme). */
  regularity: number;
}

export const BEAT_SYNC_PRESETS: Record<BeatSyncPreset, BeatSyncProfile> = {
  /** Ritmo uniforme: cada corte vai à batida mais próxima. */
  steady: { flex: 0.3, strength: 0.4, bar: 0.3, boundary: 0.2, pacing: 0, regularity: 2 },
  /** Acompanha a energia: rápido nas partes intensas, calmo nas suaves. */
  dynamic: { flex: 0.6, strength: 0.6, bar: 0.5, boundary: 0.9, pacing: 0.65, regularity: 1 },
  /** Corta no início dos compassos. */
  bars: { flex: 0.6, strength: 0.2, bar: 1.5, boundary: 0.6, pacing: 0.2, regularity: 0.8 },
  /** Persegue as batidas mais fortes, onde quer que estejam. */
  accents: { flex: 0.8, strength: 1.5, bar: 0.2, boundary: 0.6, pacing: 0.3, regularity: 0.5 },
};

export interface BeatSyncOptions {
  profile: BeatSyncProfile;
  /** Substitui `profile.flex` (ajuste fino do usuário). */
  flexibility?: number;
  minClipSec: number;
}

export interface BeatSyncStats {
  /** Cortes alinhados a uma batida. */
  snapped: number;
  /** Total de cortes entre segmentos. */
  cuts: number;
}

const EPS = 1e-6;
/** Custo de deixar um corte fora de qualquer batida. */
const MISS_PENALTY = 0.6;
const r = (n: number) => Math.round(n * 1e6) / 1e6;

interface Candidate {
  t: number;
  gain: number;
  /** Energia 0..1 da música neste ponto. */
  energy: number;
  beat: boolean;
}

/** Primeiro índice com `t >= x` (candidatos ordenados). */
function lowerBound(c: readonly Candidate[], x: number): number {
  let lo = 0;
  let hi = c.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c[mid]!.t < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Escolhe os cortes que melhor "casam" com a música (RF-V17/RF-V18).
 *
 * Em vez de empurrar cada corte para a batida vizinha, resolve todos de uma vez por
 * programação dinâmica: maximiza a soma do valor musical de cada corte (força da
 * batida, início de compasso, mudança de seção) menos o quanto cada mídia foge da sua
 * duração-alvo. Com `pacing`, a duração-alvo encolhe nas partes intensas da música e
 * cresce nas calmas — o vídeo acelera no refrão e respira nos trechos suaves.
 *
 * Restrições: duração mínima, vídeos nunca passam do que resta do clipe, e o fim do
 * vídeo não muda. As posições originais também são candidatas (com penalidade), então
 * sempre há solução; sem batida boa por perto, o corte fica onde estava.
 *
 * Determinístico. O(cortes × candidatos × janela).
 *
 * @param beats batidas em tempo de timeline (0 = início do vídeo), ordenadas.
 * @param maxDurations duração máxima de cada segmento (`Infinity` para fotos).
 */
export function syncCutsToBeats(
  segments: readonly TimelineSegment[],
  beats: readonly RhythmBeat[],
  maxDurations: readonly number[],
  opts: BeatSyncOptions,
): { cuts: number[]; stats: BeatSyncStats } {
  const n = segments.length;
  const ideal = segments.slice(1).map((s) => s.startSec);
  const stats: BeatSyncStats = { snapped: 0, cuts: ideal.length };
  const p = opts.profile;
  const flex = Math.max(0, opts.flexibility ?? p.flex);
  if (n < 2 || beats.length === 0 || flex <= 0) return { cuts: ideal, stats };

  const last = segments[n - 1]!;
  const end = last.startSec + last.durationSec;
  const period = medianInterval(beats);

  // Faixa de duração permitida por segmento. O piso de 0,6 batida garante que a
  // batida mais próxima esteja sempre ao alcance.
  const base = segments.map((s) => s.durationSec);
  const dev = base.map((b) => Math.max(b * flex, period * 0.6));
  const lo = base.map((b, i) => Math.min(b, Math.max(opts.minClipSec, b - dev[i]!)));
  const hi = base.map((b, i) => Math.max(b, Math.min(maxDurations[i] ?? Infinity, b + dev[i]!)));

  // Candidatos: batidas dentro do vídeo + posições originais (corte "solto").
  const cands: Candidate[] = [];
  let energySum = 0;
  let energyCount = 0;
  for (const b of beats) {
    if (b.timeSec <= EPS || b.timeSec >= end - EPS) continue;
    if (b.energy !== undefined) {
      energySum += b.energy;
      energyCount++;
    }
    cands.push({
      t: b.timeSec,
      gain: p.strength * b.strength + p.bar * (b.bar ?? 0) + p.boundary * (b.boundary ?? 0),
      energy: b.energy ?? 0.5,
      beat: true,
    });
  }
  if (cands.length === 0) return { cuts: ideal, stats };
  const beatCands = cands.slice();
  const energyNear = (t: number) => {
    const k = lowerBound(beatCands, t);
    const a = beatCands[Math.max(0, k - 1)]!;
    const b = beatCands[Math.min(beatCands.length - 1, k)]!;
    return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a.energy : b.energy;
  };
  for (const t of ideal) {
    const k = lowerBound(beatCands, t - 1e-4);
    if (k < beatCands.length && Math.abs(beatCands[k]!.t - t) <= 1e-4) continue;
    cands.push({ t, gain: -MISS_PENALTY, energy: energyNear(t), beat: false });
  }
  cands.sort((a, b) => a.t - b.t || Number(b.beat) - Number(a.beat));

  // Ritmo guiado pela energia: alvo × 2^(−pacing × z), z ∈ [−1, 1].
  const meanEnergy = energyCount > 0 ? energySum / energyCount : 0.5;
  const pacing = energyCount > 0 ? p.pacing : 0;
  const target = (i: number, energy: number) => {
    if (pacing <= 0) return base[i]!;
    const z = Math.min(1, Math.max(-1, (energy - meanEnergy) * 2));
    return Math.min(hi[i]!, Math.max(lo[i]!, base[i]! * 2 ** (-pacing * z)));
  };
  const cost = (i: number, duration: number, energy: number) => {
    const d = (duration - target(i, energy)) / dev[i]!;
    return p.regularity * d * d;
  };

  const C = cands.length;
  const cutCount = n - 1;
  const back = new Int32Array(cutCount * C).fill(-1);
  let prev = new Float64Array(C).fill(-Infinity);
  let cur = new Float64Array(C).fill(-Infinity);

  // Primeiro corte: parte de t = 0.
  const startEnergy = energyNear(0);
  for (let k = lowerBound(cands, lo[0]! - EPS); k < C && cands[k]!.t <= hi[0]! + EPS; k++) {
    prev[k] = cands[k]!.gain - cost(0, cands[k]!.t, startEnergy);
  }
  for (let i = 1; i < cutCount; i++) {
    cur.fill(-Infinity);
    const row = i * C;
    for (let j = 0; j < C; j++) {
      const v = prev[j]!;
      if (v === -Infinity) continue;
      const from = cands[j]!;
      const max = from.t + hi[i]! + EPS;
      for (let k = Math.max(j + 1, lowerBound(cands, from.t + lo[i]! - EPS)); k < C && cands[k]!.t <= max; k++) {
        const score = v + cands[k]!.gain - cost(i, cands[k]!.t - from.t, from.energy);
        if (score > cur[k]!) {
          cur[k] = score;
          back[row + k] = j;
        }
      }
    }
    [prev, cur] = [cur, prev];
  }

  // Último segmento: do último corte até o fim (que não muda).
  let best = -1;
  let bestScore = -Infinity;
  for (let k = 0; k < C; k++) {
    if (prev[k] === -Infinity) continue;
    const d = end - cands[k]!.t;
    if (d < lo[n - 1]! - EPS || d > hi[n - 1]! + EPS) continue;
    const score = prev[k]! - cost(n - 1, d, cands[k]!.energy);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  if (best < 0) return { cuts: ideal, stats };

  const cuts = new Array<number>(cutCount);
  for (let i = cutCount - 1, k = best; i >= 0; i--) {
    cuts[i] = r(cands[k]!.t);
    if (cands[k]!.beat) stats.snapped++;
    k = back[i * C + k]!;
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
