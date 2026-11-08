/**
 * Compositor WebGL2 (M3).
 *
 * Responsável por desenhar um frame de saída a partir de 1–2 fontes
 * (clipe atual + próximo durante um fade), aplicando enquadramento
 * (fit/cover/fill + fundo desfocado), transições e filtros.
 * Roda tanto na thread principal (preview) quanto em Worker + OffscreenCanvas (export).
 */
import type { FitBackground, FitMode, Size } from "../types";

export interface FrameSource {
  /** ImageBitmap (fotos) ou VideoFrame (vídeos). */
  image: CanvasImageSource;
  size: Size;
  rotation: 0 | 90 | 180 | 270;
}

export interface CompositeParams {
  output: Size;
  fit: FitMode;
  background: FitBackground;
  current: FrameSource;
  /** Próximo clipe durante um fade (mix 0..1). */
  next?: { source: FrameSource; mix: number };
}

export interface Compositor {
  draw(params: CompositeParams): void;
  dispose(): void;
}
