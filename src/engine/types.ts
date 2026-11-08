/**
 * Tipos de domínio compartilhados por todo o motor (`src/engine`).
 * Não importar React nem Tauri aqui.
 */

export type AspectRatio = "9:16" | "16:9" | "4:3" | "1:1" | "4:5" | "3:4";

export const ASPECT_RATIOS: readonly AspectRatio[] = ["9:16", "16:9", "4:3", "1:1", "4:5", "3:4"];

/** fit = contain (com fundo), cover = preenche cortando, fill = estica. */
export type FitMode = "fit" | "cover" | "fill";

export type FitBackground = { kind: "color"; color: string } | { kind: "blur"; strength: number };

export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  /** URI servida pelo protocolo `susu://media/<id>` (ver platform/). */
  uri: string;
  name: string;
  width: number;
  height: number;
  /** Rotação de exibição em graus (EXIF / metadado do vídeo). */
  rotation: 0 | 90 | 180 | 270;
  /** Apenas vídeos. */
  durationSec?: number;
  hasAudio?: boolean;
  /** Data de captura (epoch ms), quando disponível. */
  capturedAt?: number;
}

/**
 * Metadados extraídos do conteúdo de uma mídia (espelha `MediaMeta` do Rust).
 * Persistidos em cache junto com o thumbnail.
 */
export interface MediaMeta {
  kind: MediaKind;
  /** Dimensões de exibição (rotação/orientação já aplicadas). */
  width: number;
  height: number;
  /** Rotação que o renderizador ainda precisa aplicar (vídeos). Fotos: 0. */
  rotation: 0 | 90 | 180 | 270;
  /** Orientação EXIF original (fotos), 1..8. */
  orientation?: number;
  durationSec?: number;
  hasAudio?: boolean;
  capturedAt?: number;
  codec?: string;
  /** `false` quando o WebView não consegue decodificar (ex.: HEVC sem extensão no Windows). */
  decodable?: boolean;
  thumbExt: "jpg" | "webp" | "png";
}

export type QualityPreset = "720p" | "1080p" | "4k";
export type FrameRate = 30 | 60;

export interface Size {
  width: number;
  height: number;
}

export interface Beat {
  /** Tempo em segundos relativo ao início do arquivo de música. */
  timeSec: number;
  /** Força normalizada 0..1 (downbeats/onsets fortes ≈ 1). */
  strength: number;
}
