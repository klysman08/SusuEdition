import type { FitMode, MediaItem, MediaKind } from "../types";

export interface ClipOverrides {
  /** Duração fixa para este item (vence photo/videoDurationSec). */
  durationSec?: number;
  /** Ponto de início dentro do vídeo de origem. */
  sourceInSec?: number;
  fit?: FitMode;
  /** Manter o áudio original deste vídeo (padrão: TimelineSettings.keepVideoAudio). */
  keepAudio?: boolean;
  /** Ganho do áudio original 0..2 (1 = 100%). */
  gain?: number;
}

export interface TimelineItem {
  media: MediaItem;
  overrides?: ClipOverrides;
}

export type TotalDuration = { mode: "music" } | { mode: "custom"; seconds: number } | { mode: "items" };

export type Transition = { kind: "cut" } | { kind: "fade"; durationSec: number };

export interface MusicSelection {
  inSec: number;
  outSec: number;
}

export interface TimelineSettings {
  photoDurationSec: number;
  videoDurationSec: number;
  total: TotalDuration;
  /** O que fazer quando há mais mídia do que a duração total permite. */
  overflow: "drop" | "fit";
  transition: Transition;
  keepVideoAudio: boolean;
  /** Fade-out aplicado quando a música é cortada antes do fim da seleção. */
  musicFadeOutSec: number;
  /** Duração mínima de qualquer segmento. */
  minClipSec: number;
}

export const DEFAULT_TIMELINE_SETTINGS: TimelineSettings = {
  photoDurationSec: 2,
  videoDurationSec: 5,
  total: { mode: "music" },
  overflow: "drop",
  transition: { kind: "cut" },
  keepVideoAudio: false,
  musicFadeOutSec: 3,
  minClipSec: 0.5,
};

export interface TimelineSegment {
  mediaId: string;
  kind: MediaKind;
  /** Início na timeline de saída (s). */
  startSec: number;
  durationSec: number;
  /** Intervalo usado do arquivo de origem (vídeos); 0..duration para fotos. */
  sourceInSec: number;
  sourceOutSec: number;
  /** Transição de entrada (o primeiro segmento sempre é "cut"). */
  transitionIn: Transition;
  fit?: FitMode;
  keepAudio: boolean;
  gain: number;
}

export interface AudioPlan {
  /** Trecho do arquivo de música usado. */
  musicInSec: number;
  musicOutSec: number;
  /** Fade-out no final da música (0 = sem fade). */
  fadeOutSec: number;
}

export type TimelineWarning =
  | { kind: "itemsDropped"; mediaIds: string[] }
  | { kind: "contentShorterThanMusic"; contentSec: number; musicSec: number }
  | { kind: "musicShorterThanVideo"; musicSec: number; videoSec: number };

export interface TimelineResult {
  segments: TimelineSegment[];
  durationSec: number;
  audio: AudioPlan | null;
  warnings: TimelineWarning[];
}

export interface BuildTimelineInput {
  items: readonly TimelineItem[];
  settings: TimelineSettings;
  music: MusicSelection | null;
}
