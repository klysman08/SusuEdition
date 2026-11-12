import type { FilterPresetId } from "../render/filters";
import type { Beat, FitMode, MediaItem, MediaKind } from "../types";

/** Movimento lento sobre a mídia (efeito Ken Burns). */
export type MotionKind =
  | "none"
  | "zoomIn"
  | "zoomOut"
  | "panLeft"
  | "panRight"
  | "panUp"
  | "panDown"
  | "punch"
  | "pulse"
  | "tiltLeft"
  | "tiltRight";

export const MOTION_KINDS: readonly MotionKind[] = [
  "none",
  "zoomIn",
  "zoomOut",
  "panLeft",
  "panRight",
  "panUp",
  "panDown",
  "punch",
  "pulse",
  "tiltLeft",
  "tiltRight",
];

/**
 * Corte da mídia: a parte da foto/vídeo que aparece, em fração (0..1) da largura e da
 * altura já com a rotação aplicada. O enquadramento (fit/cover/fill) vale para essa parte.
 */
export interface ClipCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Filtro de cor de uma mídia: um preset com intensidade (o filtro global soma por cima). */
export interface ClipLook {
  preset: FilterPresetId;
  /** 0..1 */
  intensity: number;
}

export interface ClipOverrides {
  /** Duração fixa para este item (vence photo/videoDurationSec). */
  durationSec?: number;
  /** Ponto de início dentro do vídeo de origem. */
  sourceInSec?: number;
  fit?: FitMode;
  /** Parte da mídia que aparece (ausente = inteira). */
  crop?: ClipCrop;
  /** Manter o áudio original deste vídeo (padrão: TimelineSettings.keepVideoAudio). */
  keepAudio?: boolean;
  /** Ganho do áudio original 0..2 (1 = 100%). */
  gain?: number;
  /** Filtro só desta mídia. */
  look?: ClipLook;
  /** Movimento desta mídia (vence `TimelineSettings.photoMotion`). */
  motion?: MotionKind;
  /** Transição de entrada desta mídia (vence `TimelineSettings.transition`). */
  transitionIn?: "cut" | "fade";
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
  /** Movimento padrão das fotos; "auto" alterna zoom e deslocamento a cada foto. */
  photoMotion: MotionKind | "auto";
  keepVideoAudio: boolean;
  /** Fade-out aplicado quando a música é cortada antes do fim da seleção. */
  musicFadeOutSec: number;
  /** Duração mínima de qualquer segmento. */
  minClipSec: number;
  /** Alinhar os cortes às batidas da música (RF-V17/RF-V18). */
  beatSync: BeatSyncSettings;
}

/** Estilo da sincronia (ver `BEAT_SYNC_PRESETS` em `beat-sync.ts`). */
export type BeatSyncPreset = "steady" | "dynamic" | "bars" | "accents";

export interface BeatSyncSettings {
  enabled: boolean;
  preset: BeatSyncPreset;
  /** Quanto a duração de cada mídia pode variar para alcançar uma batida (0..1). */
  flexibility: number;
}

/** Batida com o contexto musical calculado por `analyzeRhythm`. */
export interface RhythmBeat extends Beat {
  /** Intensidade local da música 0..1. */
  energy?: number;
  /** Confiança 0..1 de que abre um compasso (0 = não abre). */
  bar?: number;
  /** Mudança de seção 0..1 (refrão, drop, pausa). */
  boundary?: number;
  /** Marcador colocado à mão pelo usuário. */
  manual?: boolean;
}

export const DEFAULT_TIMELINE_SETTINGS: TimelineSettings = {
  photoDurationSec: 2,
  videoDurationSec: 5,
  total: { mode: "music" },
  overflow: "drop",
  transition: { kind: "cut" },
  photoMotion: "none",
  keepVideoAudio: false,
  musicFadeOutSec: 3,
  minClipSec: 0.2,
  beatSync: { enabled: true, preset: "dynamic", flexibility: 0.6 },
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
  /** Ausente = a mídia inteira. */
  crop?: ClipCrop;
  keepAudio: boolean;
  gain: number;
  look?: ClipLook;
  /** Ausente = sem movimento. */
  motion?: MotionKind;
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
  /** Presente quando a sincronia com batidas foi aplicada. */
  beatSync?: { snapped: number; cuts: number };
}

export interface BuildTimelineInput {
  items: readonly TimelineItem[];
  settings: TimelineSettings;
  music: MusicSelection | null;
  /**
   * Batidas da música (tempo do arquivo). Usadas quando `settings.beatSync.enabled`.
   * Passe o resultado de `analyzeRhythm` para cortes guiados por energia e compassos.
   */
  beats?: readonly RhythmBeat[];
}
