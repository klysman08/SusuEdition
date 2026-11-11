/// <reference lib="webworker" />
/**
 * Worker de exportação: para cada quadro de saída, decodifica as fontes visíveis
 * (Mediabunny + WebCodecs), compõe com o mesmo compositor WebGL do preview num
 * OffscreenCanvas, codifica H.264 e mixa/codifica o áudio AAC em blocos de 1 s.
 * O MP4 sai em pedaços pelo MessagePort (o app grava em disco em streaming).
 */
import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  CanvasSource,
  canEncodeAudio,
  canEncodeVideo,
  Input,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  VideoSampleSink,
  type StreamTargetChunk,
  type VideoSample,
} from "mediabunny";

import type { ProbeSource } from "../decode/probe-protocol";
import { makeSource, sourceBlob } from "../decode/source";
import {
  createWebGLCompositor,
  decodeSize,
  layersAt,
  lookFilter,
  motionTransform,
  type CompositorLayer,
} from "../render";
import { AudioMixer } from "./audio-mixer";
import {
  AUDIO_BITRATE,
  AUDIO_SAMPLE_RATE,
  frameCount,
  planVideoFrames,
  segmentFrameRange,
  type ResolvedExport,
} from "./plan";
import type { ChunkAck, ChunkMessage, ExportJob, FromWorker, ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

let cancelled = false;
const post = (m: FromWorker) => self.postMessage(m);

/** Escreve os pedaços do MP4 pelo port, aguardando a confirmação (backpressure). */
function portWritable(port: MessagePort): WritableStream<StreamTargetChunk> {
  let seq = 0;
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void }>();
  port.onmessage = (e: MessageEvent<ChunkAck>) => {
    const p = pending.get(e.data.id);
    pending.delete(e.data.id);
    if (e.data.error) p?.reject(new Error(e.data.error));
    else p?.resolve();
  };
  return new WritableStream({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        const data = chunk.data.slice(); // cópia: o buffer original pode ser reaproveitado
        const msg: ChunkMessage = { id, position: chunk.position, data };
        port.postMessage(msg, [data.buffer]);
      });
    },
  });
}

/** Vídeo de um segmento: um quadro por quadro de saída, em ordem. */
class VideoReader {
  private input: Input;
  private iter: Promise<AsyncGenerator<VideoSample | null, void, unknown> | null>;
  private last: VideoSample | null = null;

  constructor(source: ProbeSource, times: number[]) {
    this.input = new Input({ source: makeSource(source, 32 * 1024 * 1024), formats: ALL_FORMATS });
    this.iter = this.input
      .getPrimaryVideoTrack()
      .then((track) => (track ? new VideoSampleSink(track).samplesAtTimestamps(times) : null));
  }

  /** Próximo quadro (repete o anterior se o decodificador não tiver um novo). */
  async next(): Promise<VideoSample | null> {
    const iter = await this.iter;
    if (!iter) return null;
    const r = await iter.next();
    const sample = r.done ? null : r.value;
    if (sample) {
      if (this.last && this.last !== sample) this.last.close();
      this.last = sample;
    }
    return this.last;
  }

  async dispose() {
    this.last?.close();
    this.last = null;
    const iter = await this.iter;
    void iter?.return();
    this.input.dispose();
  }
}

async function pickVideo(candidates: ResolvedExport[]): Promise<ResolvedExport> {
  for (const c of candidates) {
    const ok = await canEncodeVideo("avc", {
      width: c.size.width,
      height: c.size.height,
      bitrate: c.videoBitrate,
      frameRate: c.fps,
    }).catch(() => false);
    if (ok) return c;
  }
  throw new Error("Este dispositivo não consegue codificar vídeo H.264.");
}

async function pickAudio(): Promise<"aac" | "aac-wasm"> {
  const native = await canEncodeAudio("aac", {
    numberOfChannels: 2,
    sampleRate: AUDIO_SAMPLE_RATE,
    bitrate: AUDIO_BITRATE,
  }).catch(() => false);
  if (native) return "aac";
  // Sem AAC no WebView (alguns Android): encoder WASM, carregado só quando preciso.
  const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
  registerAacEncoder();
  return "aac-wasm";
}

async function run(job: ExportJob, port: MessagePort) {
  const used = await pickVideo(job.candidates);
  const { width, height } = used.size;
  const fps = used.fps;
  const totalFrames = frameCount(job.durationSec, fps);
  const outSize = { width, height };

  const mixerInput = {
    segments: job.segments,
    durationSec: job.durationSec,
    audio: job.audio,
    mix: job.mix,
    music: job.music,
    videoSources: new Map(
      Object.entries(job.media)
        .filter(([, m]) => m.kind === "video")
        .map(([id, m]) => [id, m.source]),
    ),
  };
  const withAudio = AudioMixer.hasAudio(mixerInput);
  const audioCodec = withAudio ? await pickAudio() : null;
  post({ type: "started", used, fallback: used !== job.candidates[0], audioCodec });

  const canvas = new OffscreenCanvas(width, height);
  const compositor = createWebGLCompositor(canvas, { preserveDrawingBuffer: true });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: false }),
    target: new StreamTarget(portWritable(port), { chunked: true, chunkSize: 8 * 1024 * 1024 }),
  });
  const video = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: used.videoBitrate,
    keyFrameInterval: 2,
    latencyMode: "quality",
  });
  output.addVideoTrack(video, { frameRate: fps });
  const audioSource = withAudio ? new AudioSampleSource({ codec: "aac", bitrate: AUDIO_BITRATE }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  const mixer = withAudio ? new AudioMixer(mixerInput) : null;

  const durations = new Map(
    Object.entries(job.media).map(([id, m]) => [id, m.durationSec ?? Number.POSITIVE_INFINITY]),
  );
  const videoPlans = planVideoFrames(job.segments, fps, totalFrames, durations);
  const readers = new Map<number, VideoReader>();
  const images = new Map<number, Promise<ImageBitmap | null>>();
  const imageRanges = job.segments.map((s, i) =>
    s.kind === "image" ? segmentFrameRange(job.segments, i, fps, totalFrames) : null,
  );

  const loadImage = (i: number) => {
    let p = images.get(i);
    if (!p) {
      const m = job.media[job.segments[i]!.mediaId];
      p = m
        ? sourceBlob(m.source)
            .then((blob) => {
              const size = decodeSize(m.size, outSize);
              return createImageBitmap(blob, {
                imageOrientation: "from-image",
                resizeWidth: size.width,
                resizeHeight: size.height,
                resizeQuality: "high",
              });
            })
            .catch(() => null)
        : Promise.resolve(null);
      images.set(i, p);
    }
    return p;
  };

  const AUDIO_BLOCK = AUDIO_SAMPLE_RATE; // 1 s
  let audioFrames = 0;
  const totalAudioFrames = Math.round(job.durationSec * AUDIO_SAMPLE_RATE);
  let lastProgress = 0;

  try {
    await output.start();

    for (let f = 0; f < totalFrames; f++) {
      if (cancelled) throw new DOMException("cancelado", "AbortError");
      const t = f / fps;

      // Abre leitores de vídeo um pouco antes (1 s) para esconder a latência.
      for (const plan of videoPlans) {
        if (!readers.has(plan.index) && f >= plan.firstFrame - fps && f <= plan.lastFrame) {
          const m = job.media[job.segments[plan.index]!.mediaId];
          if (m) readers.set(plan.index, new VideoReader(m.source, plan.sourceTimes));
        }
      }
      // Pré-carrega fotos que entram nos próximos 3 s.
      imageRanges.forEach((range, i) => {
        if (range && f >= range[0] - 3 * fps && f <= range[1]) void loadImage(i);
      });

      const frames = new Map<number, VideoSample | null>();
      for (const plan of videoPlans) {
        if (f >= plan.firstFrame && f <= plan.lastFrame)
          frames.set(plan.index, (await readers.get(plan.index)?.next()) ?? null);
      }

      const toClose: VideoFrame[] = [];
      const layers: CompositorLayer[] = [];
      for (const l of layersAt(job.segments, t)) {
        const seg = l.segment;
        const m = job.media[seg.mediaId];
        if (!m) continue;
        const fit = seg.fit ?? job.fit;
        const fx = { motion: motionTransform(seg.motion, l.progress), filter: lookFilter(seg.look) };
        if (m.kind === "image") {
          const bmp = await loadImage(l.index);
          if (bmp) {
            layers.push({ key: `i${l.index}`, source: bmp, size: m.size, dynamic: false, fit, alpha: l.alpha, ...fx });
          }
        } else {
          const sample = frames.get(l.index);
          if (!sample) continue;
          const vf = sample.toVideoFrame();
          toClose.push(vf);
          layers.push({
            key: `v${l.index}`,
            source: vf,
            size: m.size,
            quarterTurns: ((sample.rotation / 90) % 4) as 0 | 1 | 2 | 3,
            dynamic: true,
            fit,
            alpha: l.alpha,
            ...fx,
          });
        }
      }
      compositor.draw(layers, job.background, job.filter);
      compositor.retain(new Set(layers.map((l) => l.key)));
      for (const vf of toClose) vf.close();
      await video.add(t, 1 / fps);

      // Libera fontes que já saíram de cena.
      for (const plan of videoPlans) {
        if (f === plan.lastFrame) {
          await readers.get(plan.index)?.dispose();
          readers.delete(plan.index);
        }
      }
      imageRanges.forEach((range, i) => {
        if (range && f === range[1]) {
          void images.get(i)?.then((b) => b?.close());
          images.delete(i);
        }
      });

      // Áudio intercalado: mantém ~1 s à frente do vídeo.
      if (mixer && audioSource) {
        while (audioFrames < totalAudioFrames && audioFrames / AUDIO_SAMPLE_RATE <= t + 1) {
          const n = Math.min(AUDIO_BLOCK, totalAudioFrames - audioFrames);
          const [L, R] = await mixer.render(audioFrames / AUDIO_SAMPLE_RATE, n);
          const data = new Float32Array(n * 2);
          data.set(L, 0);
          data.set(R, n);
          const sample = new AudioSample({
            data,
            format: "f32-planar",
            numberOfChannels: 2,
            sampleRate: AUDIO_SAMPLE_RATE,
            timestamp: audioFrames / AUDIO_SAMPLE_RATE,
          });
          await audioSource.add(sample);
          sample.close();
          audioFrames += n;
        }
      }

      const now = performance.now();
      if (now - lastProgress > 200 || f === totalFrames - 1) {
        lastProgress = now;
        post({ type: "progress", frame: f + 1, totalFrames });
      }
    }

    await output.finalize();
    post({ type: "done", frames: totalFrames });
  } catch (err) {
    await output.cancel().catch(() => {});
    if (cancelled) post({ type: "cancelled" });
    else throw err;
  } finally {
    for (const r of readers.values()) await r.dispose();
    for (const p of images.values()) void p.then((b) => b?.close());
    mixer?.dispose();
    compositor.dispose();
  }
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }
  cancelled = false;
  run(msg.job, msg.port).catch((err: unknown) => {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  });
};
