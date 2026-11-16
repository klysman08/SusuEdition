/**
 * Prévias ao vivo dos templates. Cada cartão mostra o template de verdade: a mesma
 * timeline, o mesmo compositor WebGL e os mesmos shaders do editor, rodando sobre
 * imagens de exemplo com uma "música" de 120 BPM.
 *
 * Um único contexto WebGL atende todos os cartões (o navegador limita quantos podem
 * existir): o quadro é desenhado nele e copiado para o canvas 2D de cada cartão.
 */
import {
  beatPulseAt,
  createWebGLCompositor,
  isNeutralFilter,
  layersAt,
  motionTransform,
  resolveFilter,
  withPulse,
  type Compositor,
  type CompositorLayer,
  type FilterAdjust,
  type VideoEffects,
} from "@/engine/render";
import { buildTimeline, type RhythmBeat, type TimelineItem, type TimelineSegment } from "@/engine/timeline";
import type { FitBackground, FitMode } from "@/engine/types";
import { DEFAULT_VIDEO_PROJECT } from "@/features/video-maker/project-store";

import { templateSettings, type VideoTemplate } from "../catalog";
import { sampleImages, type SampleImage } from "./sample-media";

/** Resolução interna das prévias (4:5). */
export const PREVIEW_SIZE = { width: 288, height: 360 } as const;

/** Mídias na prévia: o bastante para passar por todas as transições de um "mix". */
const ITEM_COUNT = 10;
/** Fotos longas são encurtadas para a prévia não ficar parada. */
const MAX_PHOTO_SEC = 1.7;
const BEAT_SEC = 0.5;
const FRAME_MS = 1000 / 30;

export interface PreviewScene {
  segments: TimelineSegment[];
  durationSec: number;
  beats: RhythmBeat[];
  fit: FitMode;
  background: FitBackground;
  filter: FilterAdjust | null;
  effects: VideoEffects;
}

/** A timeline do template sobre as mídias de exemplo. Pura (testável sem WebGL). */
export function buildPreviewScene(
  template: VideoTemplate,
  sizes: readonly { width: number; height: number }[],
): PreviewScene {
  const settings = templateSettings(template, DEFAULT_VIDEO_PROJECT);
  const items: TimelineItem[] = Array.from({ length: ITEM_COUNT }, (_, i) => {
    const size = sizes[i % sizes.length]!;
    return { media: { id: `sample-${i}`, kind: "image", uri: "", name: "", rotation: 0, ...size } };
  });
  const photoDurationSec = Math.min(MAX_PHOTO_SEC, settings.timeline.photoDurationSec);
  const total = ITEM_COUNT * photoDurationSec;
  // Compasso 4/4 a 120 BPM: a primeira batida de cada compasso é a forte.
  const beats: RhythmBeat[] = [];
  for (let i = 0; i * BEAT_SEC <= total; i++) {
    const downbeat = i % 4 === 0;
    beats.push({
      timeSec: i * BEAT_SEC,
      strength: downbeat ? 1 : i % 2 === 0 ? 0.7 : 0.45,
      energy: 0.5,
      bar: downbeat ? 1 : 0,
    });
  }
  const timeline = buildTimeline({
    items,
    settings: { ...settings.timeline, photoDurationSec, total: { mode: "items" } },
    music: { inSec: 0, outSec: total },
    beats,
  });
  const filter = resolveFilter(settings.filter);
  return {
    segments: timeline.segments,
    durationSec: timeline.durationSec,
    beats,
    fit: settings.fit,
    background: settings.background,
    filter: isNeutralFilter(filter) ? null : filter,
    effects: settings.effects,
  };
}

interface Entry {
  scene: PreviewScene;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  /** Quadro parado já desenhado (movimento reduzido). */
  drawn: boolean;
}

let gl: { canvas: HTMLCanvasElement; compositor: Compositor } | null | undefined;
let samples: SampleImage[] = [];
const entries = new Map<HTMLCanvasElement, Entry>();
let raf = 0;
let lastFrame = 0;
let observer: IntersectionObserver | null = null;

function renderer() {
  if (gl !== undefined) return gl;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_SIZE.width;
    canvas.height = PREVIEW_SIZE.height;
    gl = { canvas, compositor: createWebGLCompositor(canvas, { preserveDrawingBuffer: true }) };
    samples = sampleImages();
  } catch {
    gl = null; // sem WebGL2: os cartões ficam com o fundo do próprio cartão
  }
  return gl;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function draw(entry: Entry, t: number) {
  const r = renderer();
  if (!r) return;
  const { scene } = entry;
  const pulse = beatPulseAt(scene.beats, t, scene.effects.beatPulse);
  const layers: CompositorLayer[] = layersAt(scene.segments, t).map((l) => {
    const index = Number(l.segment.mediaId.slice("sample-".length)) % samples.length;
    const sample = samples[index]!;
    return {
      key: `sample-${index}`,
      source: sample.canvas,
      size: sample.size,
      dynamic: false,
      fit: l.segment.fit ?? scene.fit,
      alpha: l.alpha,
      motion: withPulse(motionTransform(l.segment.motion, l.progress), pulse),
      transition: l.transition,
    };
  });
  r.compositor.draw(layers, scene.background, scene.filter, scene.effects);
  entry.ctx.drawImage(r.canvas, 0, 0, entry.ctx.canvas.width, entry.ctx.canvas.height);
}

function frame(now: number) {
  raf = 0;
  if (now - lastFrame >= FRAME_MS - 2) {
    lastFrame = now;
    const still = reducedMotion();
    for (const entry of entries.values()) {
      if (!entry.visible || entry.scene.durationSec <= 0) continue;
      if (still) {
        if (entry.drawn) continue;
        // Parado: o meio da primeira transição, que é a "cara" do template.
        draw(entry, entry.scene.segments[1]?.startSec ?? 0);
        entry.drawn = true;
      } else {
        draw(entry, (now / 1000) % entry.scene.durationSec);
      }
    }
  }
  schedule();
}

function schedule() {
  if (raf || typeof requestAnimationFrame !== "function") return;
  const still = reducedMotion();
  for (const e of entries.values()) {
    if (e.visible && !(still && e.drawn)) {
      raf = requestAnimationFrame(frame);
      return;
    }
  }
}

/**
 * Liga um canvas à prévia animada de `template`. Só anima enquanto o canvas está
 * visível. Retorna a função que desliga.
 */
export function attachTemplatePreview(canvas: HTMLCanvasElement, template: VideoTemplate): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || !renderer()) return () => {};
  canvas.width = PREVIEW_SIZE.width;
  canvas.height = PREVIEW_SIZE.height;
  const scene = buildPreviewScene(
    template,
    samples.map((s) => s.size),
  );
  entries.set(canvas, { scene, ctx, visible: typeof IntersectionObserver !== "function", drawn: false });
  if (typeof IntersectionObserver === "function") {
    observer ??= new IntersectionObserver((records) => {
      for (const rec of records) {
        const entry = entries.get(rec.target as HTMLCanvasElement);
        if (entry) entry.visible = rec.isIntersecting;
      }
      schedule();
    });
    observer.observe(canvas);
  }
  schedule();
  return () => {
    observer?.unobserve(canvas);
    entries.delete(canvas);
  };
}
