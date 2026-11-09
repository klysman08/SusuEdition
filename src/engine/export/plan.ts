import { outputSize, suggestedVideoBitrate } from "../format";
import type { TimelineSegment } from "../timeline";
import type { AspectRatio, FrameRate, QualityPreset, Size } from "../types";

export const AUDIO_BITRATE = 192_000;
export const AUDIO_SAMPLE_RATE = 48_000;

export interface ExportSettings {
  aspect: AspectRatio;
  quality: QualityPreset;
  fps: FrameRate;
}

export interface ResolvedExport {
  size: Size;
  fps: FrameRate;
  videoBitrate: number;
}

export function resolveExport(settings: ExportSettings): ResolvedExport {
  return {
    size: outputSize(settings.aspect, settings.quality),
    fps: settings.fps,
    videoBitrate: suggestedVideoBitrate(settings.quality, settings.fps),
  };
}

/** Qualidade imediatamente inferior (fallback quando o encoder não suporta). */
export function lowerQuality(q: QualityPreset): QualityPreset | null {
  return q === "4k" ? "1080p" : q === "1080p" ? "720p" : null;
}

export function frameCount(durationSec: number, fps: number): number {
  return Math.max(0, Math.round(durationSec * fps));
}

/** Tamanho estimado do MP4 (vídeo + áudio + ~2% de contêiner). */
export function estimateBytes(durationSec: number, videoBitrate: number, withAudio: boolean): number {
  const bits = durationSec * (videoBitrate + (withAudio ? AUDIO_BITRATE : 0));
  return Math.round((bits / 8) * 1.02 + 64 * 1024);
}

/** `SusuEdition_2026-11-09_203015.mp4` (hora local). */
export function exportFileName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `SusuEdition_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.mp4`;
}

export interface VideoFramePlan {
  /** Índice do segmento na timeline. */
  index: number;
  /** Primeiro e último quadro de saída (inclusive) em que o vídeo aparece. */
  firstFrame: number;
  lastFrame: number;
  /** Tempo de origem para cada quadro de `firstFrame` a `lastFrame` (monotônico). */
  sourceTimes: number[];
}

const fadeHalf = (s: TimelineSegment | undefined) =>
  s?.transitionIn.kind === "fade" ? s.transitionIn.durationSec / 2 : 0;

/** Quadros de saída (inclusive) em que o segmento `i` aparece, contando os fades. */
export function segmentFrameRange(
  segments: readonly TimelineSegment[],
  i: number,
  fps: number,
  totalFrames: number,
): [number, number] {
  const seg = segments[i]!;
  const from = seg.startSec - fadeHalf(seg);
  const to = seg.startSec + seg.durationSec + fadeHalf(segments[i + 1]);
  return [Math.max(0, Math.ceil(from * fps - 1e-6)), Math.min(totalFrames - 1, Math.ceil(to * fps - 1e-6) - 1)];
}

/**
 * Quadros de saída em que cada segmento de vídeo é visível (inclui a sobreposição
 * dos fades) e o tempo de origem de cada um — alimenta o decodificador em ordem.
 */
export function planVideoFrames(
  segments: readonly TimelineSegment[],
  fps: number,
  totalFrames: number,
  mediaDurations: ReadonlyMap<string, number>,
): VideoFramePlan[] {
  const plans: VideoFramePlan[] = [];
  segments.forEach((seg, i) => {
    if (seg.kind !== "video") return;
    const [firstFrame, lastFrame] = segmentFrameRange(segments, i, fps, totalFrames);
    if (lastFrame < firstFrame) return;
    const maxSource = Math.max(0, (mediaDurations.get(seg.mediaId) ?? Number.POSITIVE_INFINITY) - 1 / fps);
    const sourceTimes: number[] = [];
    for (let f = firstFrame; f <= lastFrame; f++) {
      const t = seg.sourceInSec + (f / fps - seg.startSec);
      sourceTimes.push(Math.min(maxSource, Math.max(0, t)));
    }
    plans.push({ index: i, firstFrame, lastFrame, sourceTimes });
  });
  return plans;
}
