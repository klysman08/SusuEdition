/**
 * Exportação de vídeo (M4).
 *
 * Worker + OffscreenCanvas: agenda frames → decodifica → compõe (render/) →
 * `VideoEncoder` H.264 (prefer-hardware, com backpressure) → mux MP4 (Mediabunny)
 * em streaming para disco via Rust. Progresso, ETA e cancelamento.
 */
import type { AspectRatio, FrameRate, QualityPreset } from "../types";

export interface ExportSettings {
  aspect: AspectRatio;
  quality: QualityPreset;
  fps: FrameRate;
}

export type ExportProgress =
  | { phase: "preparing" }
  | { phase: "encoding"; framesDone: number; framesTotal: number; etaSec: number | null }
  | { phase: "finalizing" }
  | { phase: "done"; outputPath: string }
  | { phase: "error"; message: string }
  | { phase: "cancelled" };
