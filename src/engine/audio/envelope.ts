import { layersAt } from "../render/schedule";
import type { AudioPlan, TimelineSegment } from "../timeline";
import { clamp01, musicVolumeAt, type AudioMix } from "./mix";

/** Rampa nas bordas do áudio de cada vídeo (evita estalos). */
export const EDGE_RAMP_SEC = 0.02;

/** Quanto de "vídeo com som" está na tela em `t` (0..1) — usado no ducking. */
export function duckWeightAt(segments: readonly TimelineSegment[], t: number): number {
  let w = 0;
  for (const l of layersAt(segments, t)) if (l.segment.keepAudio) w += l.alpha;
  return Math.min(1, w);
}

/** Ganho da música em `t` (mesma regra do preview). */
export function musicGainAt(
  segments: readonly TimelineSegment[],
  plan: AudioPlan | null,
  durationSec: number,
  mix: AudioMix,
  t: number,
): number {
  return musicVolumeAt(t, plan, durationSec, mix, duckWeightAt(segments, t));
}

/**
 * Ganho do áudio original de `segments[index]` em `t`: volume do clipe × volume dos
 * vídeos × opacidade (fades) × rampa de 20 ms nas bordas do trecho.
 */
export function videoGainAt(segments: readonly TimelineSegment[], index: number, mix: AudioMix, t: number): number {
  const seg = segments[index];
  if (!seg?.keepAudio) return 0;
  const end = seg.startSec + seg.durationSec;
  if (t < seg.startSec || t >= end) return 0;
  const layer = layersAt(segments, t).find((l) => l.index === index);
  const alpha = layer?.alpha ?? 0;
  const ramp = Math.min(1, (t - seg.startSec) / EDGE_RAMP_SEC, (end - t) / EDGE_RAMP_SEC);
  return clamp01(seg.gain * mix.videoGain) * alpha * Math.max(0, ramp);
}
