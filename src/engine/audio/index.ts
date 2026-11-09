/**
 * Áudio.
 *
 * M2: análise da música (feita em Rust) e lógica do recorte do trecho.
 * M3/M4: mixagem em blocos (música + áudio dos vídeos, ducking, fades) e AAC.
 */
import type { Beat } from "../types";

export * from "./mix";
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
