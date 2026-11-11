import type { AudioMix } from "../audio/mix";
import type { ProbeSource } from "../decode/probe-protocol";
import type { FilterAdjust } from "../render/filters";
import type { AudioPlan, TimelineSegment } from "../timeline";
import type { FitBackground, FitMode, Size } from "../types";
import type { ResolvedExport } from "./plan";

export interface ExportMedia {
  kind: "image" | "video";
  source: ProbeSource;
  /** Tamanho de exibição (rotação/EXIF aplicados). */
  size: Size;
  durationSec?: number;
}

export interface ExportJob {
  segments: TimelineSegment[];
  durationSec: number;
  audio: AudioPlan | null;
  media: Record<string, ExportMedia>;
  music: ProbeSource | null;
  fit: FitMode;
  background: FitBackground;
  /** Filtro global já resolvido (`resolveFilter`); `null` = sem filtro. */
  filter: FilterAdjust | null;
  mix: AudioMix;
  /** Configuração desejada primeiro, depois alternativas menores (fallback). */
  candidates: ResolvedExport[];
}

export type ToWorker = { type: "start"; job: ExportJob; port: MessagePort } | { type: "cancel" };

export type FromWorker =
  | { type: "started"; used: ResolvedExport; fallback: boolean; audioCodec: "aac" | "aac-wasm" | null }
  | { type: "progress"; frame: number; totalFrames: number }
  | { type: "done"; frames: number }
  | { type: "cancelled" }
  | { type: "error"; message: string };

/** Pedaço do MP4 enviado pelo worker pelo `MessagePort` (escrita posicional). */
export interface ChunkMessage {
  id: number;
  position: number;
  data: Uint8Array;
}

export type ChunkAck = { id: number; error?: string };
