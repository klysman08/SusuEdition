import type { Beat } from "../types";

/**
 * Detecção de BPM e batidas em TypeScript — usada quando não há o backend nativo
 * (modo navegador). Segue o mesmo desenho de `services/beat.rs`, trocando o
 * *spectral flux* da STFT por um fluxo de energia em duas bandas (sem FFT):
 *
 * 1. Envelope de onset: aumento da energia log-comprimida do sinal (graves/médios) e
 *    da sua primeira diferença (agudos), em quadros de 256 amostras (≈ 23 ms a 11 kHz).
 * 2. Tempo por autocorrelação com prioridade log-normal em 120 BPM.
 * 3. Batidas por programação dinâmica (Ellis, 2007).
 */

const HOP = 256;
const MIN_BPM = 60;
const MAX_BPM = 200;
const PRIOR_BPM = 120;
const PRIOR_OCTAVES = 0.9;
const TIGHTNESS = 100;

export interface BeatDetection {
  bpm: number | null;
  beats: Beat[];
}

function onsetEnvelope(samples: Float32Array): Float32Array {
  const frames = Math.floor(samples.length / HOP);
  if (frames < 2) return new Float32Array(0);
  const env = new Float32Array(frames);
  let prevLow = 0;
  let prevHigh = 0;
  for (let f = 0; f < frames; f++) {
    const start = f * HOP;
    let low = 0;
    let high = 0;
    for (let i = Math.max(1, start); i < start + HOP; i++) {
      const s = samples[i]!;
      const d = s - samples[i - 1]!;
      low += s * s;
      high += d * d;
    }
    low = Math.log1p((1000 * low) / HOP);
    high = Math.log1p((1000 * high) / HOP);
    if (f > 0) env[f] = Math.max(0, low - prevLow) + Math.max(0, high - prevHigh);
    prevLow = low;
    prevHigh = high;
  }
  return env;
}

/** Remove a tendência local (média móvel de ±0,25 s) e normaliza pelo desvio padrão. */
function normalize(env: Float32Array, fps: number): Float32Array | null {
  const n = env.length;
  if (n === 0) return null;
  const half = Math.max(1, Math.round(fps * 0.25));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + env[i]!;
  const out = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    out[i] = Math.max(0, env[i]! - (prefix[b]! - prefix[a]!) / (b - a));
    sum += out[i]!;
  }
  const mean = sum / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (out[i]! - mean) ** 2;
  const std = Math.sqrt(variance / n);
  if (!Number.isFinite(std) || std < 1e-6) return null;
  for (let i = 0; i < n; i++) out[i] = out[i]! / std;
  return out;
}

/** Período (em quadros, fracionário) pela autocorrelação ponderada. */
function estimatePeriod(raw: Float32Array, fps: number): number | null {
  // Suaviza (1-2-1): onsets muito estreitos perdem correlação quando o período real
  // não é um número inteiro de quadros, o que favoreceria a metade do tempo.
  const o = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    o[i] = 0.25 * (raw[i - 1] ?? 0) + 0.5 * raw[i]! + 0.25 * (raw[i + 1] ?? 0);
  }
  const lagMin = Math.max(1, Math.floor((fps * 60) / MAX_BPM));
  const lagMax = Math.ceil((fps * 60) / MIN_BPM);
  if (o.length <= lagMax * 2) return null;
  const lag0 = (fps * 60) / PRIOR_BPM;
  const score: number[] = [];
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const n = o.length - lag;
    let r = 0;
    for (let t = 0; t < n; t++) r += o[t]! * o[t + lag]!;
    const w = Math.exp(-0.5 * (Math.log2(lag / lag0) / PRIOR_OCTAVES) ** 2);
    score.push((r / n) * w);
  }
  let best = 0;
  for (let i = 1; i < score.length; i++) if (score[i]! > score[best]!) best = i;
  if (score[best]! <= 0) return null;
  let refine = 0;
  if (best > 0 && best + 1 < score.length) {
    const d = score[best - 1]! - 2 * score[best]! + score[best + 1]!;
    if (Math.abs(d) > 1e-12) refine = Math.min(0.5, Math.max(-0.5, (0.5 * (score[best - 1]! - score[best + 1]!)) / d));
  }
  return lagMin + best + refine;
}

function trackBeats(o: Float32Array, period: number): number[] {
  const n = o.length;
  const cum = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const loOff = Math.round(2 * period);
  const hiOff = Math.max(1, Math.round(period / 2));
  for (let t = 0; t < n; t++) {
    if (t < hiOff) {
      cum[t] = o[t]!;
      continue;
    }
    let best = -Infinity;
    let arg = -1;
    for (let tau = Math.max(0, t - loOff); tau <= t - hiOff; tau++) {
      const v = cum[tau]! - TIGHTNESS * Math.log((t - tau) / period) ** 2;
      if (v > best) {
        best = v;
        arg = tau;
      }
    }
    cum[t] = o[t]! + Math.max(0, best);
    if (best > 0) back[t] = arg;
  }
  let t = Math.max(0, n - Math.ceil(period));
  for (let i = t + 1; i < n; i++) if (cum[i]! >= cum[t]!) t = i;
  const beats = [t];
  while (back[t]! >= 0) {
    t = back[t]!;
    beats.push(t);
  }
  return beats.reverse();
}

/** Analisa amostras mono em `rate` Hz (o ideal é ~11 kHz, como no backend nativo). */
export function detectBeats(samples: Float32Array, rate: number): BeatDetection {
  const none: BeatDetection = { bpm: null, beats: [] };
  const fps = rate / HOP;
  const o = normalize(onsetEnvelope(samples), fps);
  if (!o) return none;
  const period = estimatePeriod(o, fps);
  if (period === null) return none;
  const frames = trackBeats(o, period);
  if (frames.length < 2) return none;

  // Força: pico local do onset em torno da batida.
  const raw = frames.map((f) => Math.max(o[Math.max(0, f - 1)]!, o[f]!, o[Math.min(o.length - 1, f + 1)]!));
  // Remove batidas fracas nas pontas (silêncio/fade no início e no fim).
  let energy = 0;
  for (let i = 0; i < o.length; i++) energy += o[i]! ** 2;
  const threshold = 0.5 * Math.sqrt(energy / o.length);
  const first = Math.max(
    0,
    raw.findIndex((s) => s >= threshold),
  );
  const lastStrong = raw.findLastIndex((s) => s >= threshold);
  const last = lastStrong < 0 ? raw.length - 1 : lastStrong;
  const sorted = raw.slice(first, last + 1).sort((a, b) => a - b);
  if (sorted.length < 2) return none;
  const p95 = Math.max(1e-6, sorted[Math.floor((sorted.length - 1) * 0.95)]!);
  const offset = HOP / 2 / rate;

  const beats: Beat[] = [];
  for (let i = first; i <= last; i++) {
    beats.push({
      timeSec: Math.round(((frames[i]! * HOP) / rate + offset) * 1000) / 1000,
      strength: Math.round(Math.min(1, raw[i]! / p95) * 1000) / 1000,
    });
  }
  return { bpm: Math.round(((60 * fps) / period) * 10) / 10, beats };
}
