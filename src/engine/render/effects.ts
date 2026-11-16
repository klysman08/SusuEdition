/**
 * Efeitos do vídeo inteiro que não são filtro de cor: barras de cinema e o pulso na
 * batida. Valem igual na prévia e na exportação.
 */
export interface VideoEffects {
  /** Barras de cinema: fração da altura coberta por cada barra (0..0.2; 0 = sem barras). */
  letterbox: number;
  /** Pulso de zoom a cada batida da música (0..1; 0 = desligado). */
  beatPulse: number;
}

export const DEFAULT_VIDEO_EFFECTS: VideoEffects = { letterbox: 0, beatPulse: 0 };

/** Maior barra de cinema oferecida (cada uma, fração da altura). */
export const MAX_LETTERBOX = 0.2;

export function hasEffects(e: VideoEffects): boolean {
  return e.letterbox > 0 || e.beatPulse > 0;
}
