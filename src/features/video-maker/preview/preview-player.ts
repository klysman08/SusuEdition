import { clamp01, musicVolumeAt, type AudioMix } from "@/engine/audio";
import {
  createWebGLCompositor,
  cropDecodeTarget,
  layersAt,
  lookFilter,
  motionTransform,
  upcomingSegments,
  type Compositor,
  type CompositorLayer,
  type FilterAdjust,
} from "@/engine/render";
import type { AudioPlan, TimelineSegment } from "@/engine/timeline";
import type { FitBackground, FitMode, Size } from "@/engine/types";

import { ImageCache } from "@/engine/decode/image-cache";
import { VideoPool } from "./video-pool";

export interface PreviewMedia {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbUrl?: string;
  /** Tamanho de exibição. */
  size: Size;
}

export interface PreviewInput {
  segments: readonly TimelineSegment[];
  durationSec: number;
  audio: AudioPlan | null;
  media: ReadonlyMap<string, PreviewMedia>;
  musicUrl: string | null;
  fit: FitMode;
  background: FitBackground;
  /** Filtro global já resolvido; `null` = sem filtro. */
  filter: FilterAdjust | null;
  mix: AudioMix;
}

export interface PlayerState {
  timeSec: number;
  durationSec: number;
  playing: boolean;
}

/** Resolução máxima de decodificação das fotos no preview (lado menor). */
const IMAGE_TARGET_SHORT = 720;
const PRELOAD_AHEAD_SEC = 6;
/** Placeholder de vídeo: o thumbnail no tamanho em que foi gerado (lado menor 320). */
const THUMB_TARGET: Size = { width: 320, height: 320 };
const MUSIC_DRIFT_SEC = 0.15;
const VIDEO_DRIFT_SEC = 0.3;

/**
 * Player do preview: relógio próprio (performance.now), composição WebGL a cada
 * quadro, vídeos via <video> (decodificação por hardware, leitura por HTTP Range)
 * e a música num <audio> sincronizado. Sem React: a UI só chama play/pause/seek.
 */
export class PreviewPlayer {
  private compositor: Compositor;
  private images: ImageCache;
  private videos: VideoPool;
  private music: HTMLAudioElement;
  private input: PreviewInput | null = null;
  private time = 0;
  private playing = false;
  private wallStart = 0;
  private timeStart = 0;
  private raf = 0;
  private lastEmit = 0;
  /** Continua redesenhando até este instante (quadros de vídeo chegando após uma busca). */
  private settleUntil = 0;
  private listeners = new Set<(s: PlayerState) => void>();

  constructor(canvas: HTMLCanvasElement) {
    this.compositor = createWebGLCompositor(canvas);
    this.images = new ImageCache(() => this.invalidate());
    this.videos = new VideoPool(() => this.settle(300));
    this.music = new Audio();
    this.music.preload = "auto";
    this.music.crossOrigin = "anonymous";
  }

  get state(): PlayerState {
    return { timeSec: this.time, durationSec: this.input?.durationSec ?? 0, playing: this.playing };
  }

  subscribe(cb: (s: PlayerState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  setInput(input: PreviewInput): void {
    const prevMusic = this.input?.musicUrl ?? null;
    this.input = input;
    if (input.musicUrl !== prevMusic) {
      this.music.pause();
      if (input.musicUrl) this.music.src = input.musicUrl;
      else this.music.removeAttribute("src");
      if (this.playing) this.syncMusic(true);
    }
    if (this.time > input.durationSec) this.time = input.durationSec;
    this.settle();
    this.emit(true);
  }

  resize(size: Size): void {
    this.compositor.resize(size);
    this.invalidate();
  }

  play(): void {
    const input = this.input;
    if (!input || input.durationSec <= 0 || this.playing) return;
    if (this.time >= input.durationSec - 0.05) this.time = 0;
    this.playing = true;
    this.timeStart = this.time;
    this.wallStart = performance.now();
    this.syncMusic(true);
    this.invalidate();
    this.emit(true);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.music.pause();
    this.videos.pauseAll();
    this.invalidate();
    this.emit(true);
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number): void {
    const d = this.input?.durationSec ?? 0;
    this.time = Math.min(d, Math.max(0, t));
    if (this.playing) {
      this.timeStart = this.time;
      this.wallStart = performance.now();
      this.syncMusic(true);
    }
    this.settle();
    this.emit(true);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
    this.music.pause();
    this.music.removeAttribute("src");
    this.music.load();
    this.videos.dispose();
    this.images.dispose();
    this.compositor.dispose();
  }

  /** Redesenha por alguns instantes (ex.: depois de buscar ou trocar a entrada). */
  private settle(ms = 700): void {
    this.settleUntil = Math.max(this.settleUntil, performance.now() + ms);
    this.invalidate();
  }

  /** Agenda um quadro (no máximo um por refresh). */
  private invalidate(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private emit(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastEmit < 66) return; // ~15 atualizações/s para a UI
    this.lastEmit = now;
    const s = this.state;
    for (const l of this.listeners) l(s);
  }

  private frame = (): void => {
    this.raf = 0;
    const input = this.input;
    if (!input) return;

    if (this.playing) {
      this.time = this.timeStart + (performance.now() - this.wallStart) / 1000;
      if (this.time >= input.durationSec) {
        this.time = input.durationSec;
        this.pause();
      }
    }

    this.render(input);
    this.emit();
    if (this.playing || performance.now() < this.settleUntil) this.invalidate();
  };

  private imageTarget(): Size {
    const { width, height } = this.compositor.size;
    const s = IMAGE_TARGET_SHORT / Math.max(1, Math.min(width, height));
    return { width: Math.round(width * s), height: Math.round(height * s) };
  }

  private render(input: PreviewInput): void {
    const t = this.time;
    const layers = layersAt(input.segments, t);
    const target = this.imageTarget();
    const activeIds = new Set(layers.map((l) => l.segment.mediaId));
    const upcoming = upcomingSegments(input.segments, t, PRELOAD_AHEAD_SEC);
    const protect = new Set([...activeIds, ...upcoming.slice(0, 3).map((s) => s.mediaId)]);

    const drawn: CompositorLayer[] = [];
    let duck = 0;

    for (const layer of layers) {
      const seg = layer.segment;
      const media = input.media.get(seg.mediaId);
      if (!media) continue;
      const fit = seg.fit ?? input.fit;
      // Movimento (Ken Burns) e filtro próprios da mídia, iguais aos do export.
      const fx = {
        motion: motionTransform(seg.motion, layer.progress),
        filter: lookFilter(seg.look),
        crop: seg.crop,
      };

      if (media.kind === "image") {
        const bmp = this.images.get(
          { id: media.id, url: media.url, thumbUrl: media.thumbUrl, size: media.size },
          cropDecodeTarget(target, seg.crop),
          true,
        );
        if (bmp) {
          const key = `${media.id}:${bmp.width}`;
          drawn.push({ key, source: bmp, size: media.size, dynamic: false, fit, alpha: layer.alpha, ...fx });
        }
        continue;
      }

      const el = this.videos.acquire(media.id, media.url, protect);
      this.syncVideo(el, layer.sourceTimeSec, seg, layer.alpha, input.mix);
      if (seg.keepAudio) duck += layer.alpha;
      if (el.readyState >= 2 && el.videoWidth > 0) {
        drawn.push({
          key: `${media.id}:video`,
          source: el,
          size: media.size,
          dynamic: true,
          fit,
          alpha: layer.alpha,
          ...fx,
        });
      } else {
        // Placeholder enquanto o vídeo carrega/busca o quadro: o thumbnail.
        const bmp = media.thumbUrl
          ? this.images.get({ id: `${media.id}:thumb`, url: media.thumbUrl, size: media.size }, THUMB_TARGET, true)
          : null;
        if (bmp)
          drawn.push({
            key: `${media.id}:thumb`,
            source: bmp,
            size: media.size,
            dynamic: false,
            fit,
            alpha: layer.alpha,
            ...fx,
          });
      }
    }

    // Pré-carrega as próximas fontes.
    for (const seg of upcoming) {
      if (activeIds.has(seg.mediaId)) continue;
      const media = input.media.get(seg.mediaId);
      if (!media) continue;
      if (media.kind === "image") {
        this.images.prefetch(
          { id: media.id, url: media.url, thumbUrl: media.thumbUrl, size: media.size },
          cropDecodeTarget(target, seg.crop),
        );
      } else if (protect.has(media.id)) {
        const el = this.videos.acquire(media.id, media.url, protect);
        if (el.paused && Math.abs(el.currentTime - seg.sourceInSec) > 0.05 && !el.seeking)
          el.currentTime = seg.sourceInSec;
      }
    }

    this.videos.pauseExcept(activeIds);
    this.compositor.draw(drawn, input.background, input.filter);
    this.compositor.retain(new Set(drawn.map((d) => d.key)));

    // Música: volume com fade-out e ducking; corrige deriva do relógio.
    this.music.volume = musicVolumeAt(t, input.audio, input.durationSec, input.mix, duck);
    if (this.playing) this.syncMusic(false);
  }

  private syncVideo(el: HTMLVideoElement, sourceTime: number, seg: TimelineSegment, alpha: number, mix: AudioMix) {
    const withSound = this.playing && seg.keepAudio;
    el.muted = !withSound;
    if (withSound) el.volume = clamp01(seg.gain * mix.videoGain * alpha);
    const target = Math.min(sourceTime, Number.isFinite(el.duration) ? Math.max(0, el.duration - 0.05) : sourceTime);

    if (this.playing) {
      if (el.paused) {
        if (Math.abs(el.currentTime - target) > 0.1) el.currentTime = target;
        void el.play().catch(() => {});
      } else if (Math.abs(el.currentTime - target) > VIDEO_DRIFT_SEC) {
        el.currentTime = target;
      }
    } else {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - target) > 0.04) el.currentTime = target;
    }
  }

  private syncMusic(force: boolean): void {
    const input = this.input;
    if (!input?.audio || !input.musicUrl) return;
    const target = input.audio.musicInSec + this.time;
    if (target >= input.audio.musicOutSec) {
      this.music.pause();
      return;
    }
    if (force || Math.abs(this.music.currentTime - target) > MUSIC_DRIFT_SEC) this.music.currentTime = target;
    if (this.music.paused) void this.music.play().catch(() => {});
  }
}
