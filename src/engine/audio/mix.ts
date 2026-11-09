import type { AudioPlan } from "../timeline";

/** Volumes do projeto (0..1). */
export interface AudioMix {
  musicGain: number;
  /** Volume do áudio original dos vídeos que mantêm o som. */
  videoGain: number;
  /** Volume relativo da música enquanto um vídeo com som está tocando. */
  duckingGain: number;
}

export const DEFAULT_AUDIO_MIX: AudioMix = { musicGain: 1, videoGain: 1, duckingGain: 0.35 };

/** Fator 0..1 do fade-out da música no instante `t` da timeline. */
export function musicFadeAt(t: number, durationSec: number, fadeOutSec: number): number {
  if (fadeOutSec <= 0) return 1;
  const remaining = durationSec - t;
  if (remaining >= fadeOutSec) return 1;
  return Math.max(0, remaining / fadeOutSec);
}

/**
 * Volume da música em `t`.
 * `duckWeight` (0..1): quanto de vídeo com som está na tela (fades misturam).
 */
export function musicVolumeAt(
  t: number,
  plan: AudioPlan | null,
  durationSec: number,
  mix: AudioMix,
  duckWeight: number,
): number {
  if (!plan || t < 0 || t > durationSec) return 0;
  if (plan.musicInSec + t >= plan.musicOutSec) return 0;
  const duck = 1 + (mix.duckingGain - 1) * Math.min(1, Math.max(0, duckWeight));
  return clamp01(mix.musicGain * musicFadeAt(t, durationSec, plan.fadeOutSec) * duck);
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
