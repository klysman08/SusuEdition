/**
 * Áudio.
 *
 * M2: análise da música (feita em Rust) e lógica do recorte do trecho.
 * M3/M4: mixagem em blocos (música + áudio dos vídeos, ducking, fades) e AAC.
 */
import type { Beat } from "../types";

export * from "./peaks";
export * from "./selection";

/** Resultado da análise de uma música (espelha `AudioAnalysis` do Rust). */
export interface AudioAnalysis {
  durationSec: number;
  sourceRate: number;
  channels: number;
  /** Picos 0..1 para a waveform. */
  peaks: number[];
  /** `null` quando não há pulso detectável (fala, ambiente, silêncio). */
  bpm: number | null;
  beats: Beat[];
}

export interface AudioMixSettings {
  /** Volume da música 0..1. */
  musicGain: number;
  /** Volume da música durante segmentos com áudio de vídeo (0..1). */
  duckingGain: number;
  sampleRate: 48000;
  channels: 2;
}

export const DEFAULT_AUDIO_MIX: AudioMixSettings = {
  musicGain: 1,
  duckingGain: 0.35,
  sampleRate: 48000,
  channels: 2,
};
