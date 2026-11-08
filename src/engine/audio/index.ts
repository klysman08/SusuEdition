/**
 * Áudio (M2/M3/M4).
 *
 * Mixagem em blocos: trecho da música + áudio original dos vídeos (ganho por clipe)
 * + volume da música nos trechos com vídeo (ducking), com fades. Saída: AAC 48 kHz estéreo.
 */
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
