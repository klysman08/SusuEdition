/**
 * Mixagem do áudio final em blocos (48 kHz estéreo): trecho da música + áudio
 * original dos vídeos que mantêm o som, com fade-out, ducking e volumes.
 * Cada fonte é lida em streaming (nada inteiro na memória).
 */
import { ALL_FORMATS, AudioSampleSink, Input, type AudioSample } from "mediabunny";

import { musicGainAt, videoGainAt } from "../audio/envelope";
import type { AudioMix } from "../audio/mix";
import { StereoResampler } from "../audio/resampler";
import type { ProbeSource } from "../decode/probe-protocol";
import { makeSource } from "../decode/source";
import type { AudioPlan, TimelineSegment } from "../timeline";
import { AUDIO_SAMPLE_RATE } from "./plan";

/** Granularidade dos envelopes de volume (10 ms). */
const GAIN_STEP = 480;

/** Lê a trilha de áudio de um arquivo a partir de `startSec`, já em 48 kHz estéreo. */
class TrackReader {
  private input: Input | null = null;
  private iter: AsyncGenerator<AudioSample, void, unknown> | null = null;
  private resampler: StereoResampler | null = null;
  private ended = false;
  private opened = false;

  constructor(
    private readonly source: ProbeSource,
    private readonly startSec: number,
    private readonly endSec: number,
  ) {}

  private async open() {
    this.opened = true;
    this.input = new Input({ source: makeSource(this.source), formats: ALL_FORMATS });
    const track = await this.input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) {
      this.ended = true;
      return;
    }
    this.iter = new AudioSampleSink(track).samples(this.startSec, this.endSec);
  }

  private async pull(): Promise<void> {
    const r = await this.iter!.next();
    if (r.done) {
      this.ended = true;
      return;
    }
    let sample = r.value;
    try {
      // Corta o início do primeiro bloco se ele começa antes do ponto pedido.
      const skip = Math.round((this.startSec - sample.timestamp) * sample.sampleRate);
      if (skip > 0 && skip < sample.numberOfFrames) {
        const trimmed = sample.trim(skip);
        sample.close();
        sample = trimmed;
      } else if (skip >= sample.numberOfFrames) {
        return;
      }
      this.resampler ??= new StereoResampler(sample.sampleRate, AUDIO_SAMPLE_RATE);
      const planes: Float32Array[] = [];
      for (let c = 0; c < Math.min(2, sample.numberOfChannels); c++) {
        const plane = new Float32Array(sample.numberOfFrames);
        sample.copyTo(plane, { planeIndex: c, format: "f32-planar" });
        planes.push(plane);
      }
      this.resampler.push(planes);
    } finally {
      sample.close();
    }
  }

  /** Preenche `n` amostras (silêncio depois do fim). */
  async read(outL: Float32Array, outR: Float32Array, offset: number, n: number): Promise<void> {
    if (!this.opened) await this.open();
    let got = 0;
    while (got < n) {
      if (this.resampler) got += this.resampler.read(outL, outR, offset + got, n - got);
      if (got >= n) break;
      if (this.ended) {
        // Esvazia a última amostra de interpolação e completa com silêncio.
        this.resampler?.pushSilence(2);
        if (this.resampler) got += this.resampler.read(outL, outR, offset + got, n - got);
        outL.fill(0, offset + got, offset + n);
        outR.fill(0, offset + got, offset + n);
        return;
      }
      await this.pull();
    }
  }

  dispose() {
    void this.iter?.return();
    this.input?.dispose();
    this.input = null;
  }
}

export interface MixerInput {
  segments: readonly TimelineSegment[];
  durationSec: number;
  audio: AudioPlan | null;
  mix: AudioMix;
  music: ProbeSource | null;
  videoSources: ReadonlyMap<string, ProbeSource>;
}

export class AudioMixer {
  private music: TrackReader | null;
  private readers = new Map<number, TrackReader>();

  constructor(private readonly input: MixerInput) {
    const plan = input.audio;
    this.music = plan && input.music ? new TrackReader(input.music, plan.musicInSec, plan.musicOutSec) : null;
  }

  /** O vídeo final tem trilha de áudio? */
  static hasAudio(input: MixerInput): boolean {
    return (!!input.audio && !!input.music) || input.segments.some((s) => s.keepAudio);
  }

  /** Renderiza `frames` amostras a partir de `t0` (s). Retorna [L, R]. */
  async render(t0: number, frames: number): Promise<[Float32Array, Float32Array]> {
    const { segments, durationSec, audio, mix } = this.input;
    const L = new Float32Array(frames);
    const R = new Float32Array(frames);
    const tmpL = new Float32Array(frames);
    const tmpR = new Float32Array(frames);
    const rate = AUDIO_SAMPLE_RATE;

    if (this.music) {
      await this.music.read(tmpL, tmpR, 0, frames);
      for (let k = 0; k < frames; k += GAIN_STEP) {
        const g = musicGainAt(segments, audio, durationSec, mix, t0 + (k + GAIN_STEP / 2) / rate);
        const end = Math.min(frames, k + GAIN_STEP);
        for (let j = k; j < end; j++) {
          L[j]! += tmpL[j]! * g;
          R[j]! += tmpR[j]! * g;
        }
      }
    }

    const t1 = t0 + frames / rate;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      if (!seg.keepAudio) continue;
      const segEnd = seg.startSec + seg.durationSec;
      if (segEnd <= t0 || seg.startSec >= t1) continue;
      const source = this.input.videoSources.get(seg.mediaId);
      if (!source) continue;
      let reader = this.readers.get(i);
      if (!reader) {
        reader = new TrackReader(source, seg.sourceInSec + Math.max(0, t0 - seg.startSec), seg.sourceOutSec + 0.1);
        this.readers.set(i, reader);
      }
      const from = Math.max(0, Math.round((seg.startSec - t0) * rate));
      const to = Math.min(frames, Math.round((segEnd - t0) * rate));
      if (to <= from) continue;
      await reader.read(tmpL, tmpR, from, to - from);
      for (let k = from; k < to; k += GAIN_STEP) {
        const g = videoGainAt(segments, i, mix, t0 + (k + GAIN_STEP / 2) / rate);
        const end = Math.min(to, k + GAIN_STEP);
        for (let j = k; j < end; j++) {
          L[j]! += tmpL[j]! * g;
          R[j]! += tmpR[j]! * g;
        }
      }
      if (segEnd <= t1) {
        reader.dispose();
        this.readers.delete(i);
      }
    }

    for (let j = 0; j < frames; j++) {
      L[j] = Math.max(-1, Math.min(1, L[j]!));
      R[j] = Math.max(-1, Math.min(1, R[j]!));
    }
    return [L, R];
  }

  dispose() {
    this.music?.dispose();
    for (const r of this.readers.values()) r.dispose();
    this.readers.clear();
  }
}
