import type { Beat } from "../types";
import type { RhythmBeat } from "./types";

export interface RhythmOptions {
  /** Picos 0..1 da waveform (cobrem o arquivo inteiro). */
  peaks?: readonly number[];
  /** Duração do arquivo (s) — necessária para usar `peaks`. */
  durationSec?: number;
  /** Batidas por compasso (4/4 por padrão). */
  beatsPerBar?: number;
}

/** Janela (em batidas) usada para suavizar a energia e medir mudanças de seção. */
const SMOOTH_HALF = 4;
const SECTION_WINDOW = 8;
/** Diferença mínima de energia (0..1) entre antes/depois para marcar uma mudança de seção. */
const SECTION_MIN = 0.18;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function medianInterval(beats: readonly Beat[]): number {
  if (beats.length < 2) return 0.5;
  const gaps: number[] = [];
  for (let i = 1; i < beats.length; i++) gaps.push(beats[i]!.timeSec - beats[i - 1]!.timeSec);
  gaps.sort((a, b) => a - b);
  return Math.max(0.05, gaps[gaps.length >> 1]!);
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))]!;
}

/** Média de `v[from..to)` limitada ao vetor. */
function mean(v: readonly number[], from: number, to: number): number {
  const a = Math.max(0, from);
  const b = Math.min(v.length, to);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += v[i]!;
  return s / (b - a);
}

/** Uma batida detectada a menos disto de um marcador é substituída por ele. */
const MARKER_MERGE_SEC = 0.06;

/**
 * Junta os marcadores manuais (tempo do arquivo de música) às batidas detectadas.
 * Um marcador vale como a batida mais forte possível — início de compasso e mudança
 * de seção — então a sincronia prefere cortar nele. Funciona também sem batidas
 * detectadas (fala, música ambiente): os marcadores viram as únicas batidas.
 */
export function mergeMarkers(beats: readonly RhythmBeat[], markers: readonly number[]): RhythmBeat[] {
  if (markers.length === 0) return beats.slice();
  const sorted = [...new Set(markers.map(round3))].filter((m) => m >= 0).sort((a, b) => a - b);
  const kept = beats.filter((b) => !sorted.some((m) => Math.abs(m - b.timeSec) < MARKER_MERGE_SEC));
  const energyNear = (t: number) => {
    let best: RhythmBeat | undefined;
    for (const b of beats) if (!best || Math.abs(b.timeSec - t) < Math.abs(best.timeSec - t)) best = b;
    return best?.energy ?? 0.5;
  };
  const manual = sorted.map((m): RhythmBeat => ({
    timeSec: m,
    strength: 1,
    energy: energyNear(m),
    bar: 1,
    boundary: 1,
    manual: true,
  }));
  return [...kept, ...manual].sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * Enriquece as batidas com o "mapa" da música, usado para escolher onde cortar:
 *
 * - `energy` (0..1): intensidade local — volume médio em torno da batida, suavizado
 *   por ±4 batidas e normalizado entre os percentis 5 e 95 da faixa.
 * - `bar` (0..1): confiança de que a batida abre um compasso. A fase do compasso é a
 *   que concentra as batidas mais fortes.
 * - `boundary` (0..1): mudança de seção (entrada do refrão, drop, pausa) — picos da
 *   diferença de energia entre as 8 batidas seguintes e as 8 anteriores.
 *
 * Função pura e determinística; O(batidas).
 */
export function analyzeRhythm(beats: readonly Beat[], opts: RhythmOptions = {}): RhythmBeat[] {
  const n = beats.length;
  if (n === 0) return [];
  const period = medianInterval(beats);
  const { peaks, durationSec } = opts;

  // 1. Intensidade bruta: volume da waveform em torno da batida (ou a força do onset).
  const usePeaks = !!peaks && peaks.length > 0 && !!durationSec && durationSec > 0;
  const raw = beats.map((b) => {
    if (!usePeaks) return b.strength;
    const perSec = peaks!.length / durationSec!;
    const a = Math.floor((b.timeSec - period / 2) * perSec);
    const z = Math.max(a + 1, Math.ceil((b.timeSec + period / 2) * perSec));
    return mean(peaks!, a, z);
  });

  // 2. Suaviza e normaliza.
  const smooth = raw.map((_, i) => mean(raw, i - SMOOTH_HALF, i + SMOOTH_HALF + 1));
  const sorted = [...smooth].sort((a, b) => a - b);
  const lo = percentile(sorted, 0.05);
  const hi = percentile(sorted, 0.95);
  const flat = hi - lo < 0.05 * Math.max(hi, 1e-6);
  const energy = smooth.map((v) => (flat ? 0.5 : clamp01((v - lo) / (hi - lo))));

  // 3. Compassos: fase com maior soma de forças.
  const perBar = Math.max(2, Math.round(opts.beatsPerBar ?? 4));
  const sums = new Array<number>(perBar).fill(0);
  beats.forEach((b, i) => (sums[i % perBar]! += b.strength));
  let phase = 0;
  for (let p = 1; p < perBar; p++) if (sums[p]! > sums[phase]!) phase = p;
  const avg = sums.reduce((a, b) => a + b, 0) / perBar;
  // Sem acento claro ainda marcamos compassos (com pouca confiança): cortar a cada 4
  // batidas continua soando regular.
  const barConfidence = n >= perBar * 2 && avg > 0 ? Math.min(1, Math.max(0.35, (sums[phase]! / avg - 1) / 0.3)) : 0.35;

  // 4. Mudanças de seção.
  const novelty = energy.map((_, i) =>
    i < SECTION_WINDOW / 2 || i > n - SECTION_WINDOW / 2
      ? 0
      : Math.abs(mean(energy, i, i + SECTION_WINDOW) - mean(energy, i - SECTION_WINDOW, i)),
  );
  const boundary = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const v = novelty[i]!;
    if (v < SECTION_MIN) continue;
    let isPeak = true;
    for (let k = Math.max(0, i - 4); k <= Math.min(n - 1, i + 4) && isPeak; k++) {
      if (novelty[k]! > v || (novelty[k] === v && k < i)) isPeak = false;
    }
    if (!isPeak) continue;
    // A seção costuma virar no início de um compasso: leva a marca ao mais próximo.
    let at = i;
    for (const d of [0, -1, 1, -2, 2]) {
      const k = i + d;
      if (k >= 0 && k < n && k % perBar === phase) {
        at = k;
        break;
      }
    }
    boundary[at] = Math.max(boundary[at]!, Math.min(1, v / 0.5));
  }

  return beats.map((b, i) => ({
    timeSec: b.timeSec,
    strength: b.strength,
    energy: round3(energy[i]!),
    bar: i % perBar === phase ? round3(barConfidence) : 0,
    boundary: round3(boundary[i]!),
  }));
}
