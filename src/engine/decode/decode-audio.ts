/**
 * Decodifica a trilha de áudio de um arquivo no WebView — reserva para quando o leitor
 * nativo (Symphonia) não abre o arquivo: HE-AAC (comum em áudio baixado do Instagram),
 * Opus, WAV RF64, MP3 dentro de WAV, arquivos com a extensão errada etc. Primeiro
 * Mediabunny (WebCodecs, em streaming); se ele não ler, o decodificador do navegador.
 */
import { ALL_FORMATS, AudioSampleSink, Input } from "mediabunny";

import { MonoDownsampler, toMono, type PcmAudio } from "../audio/pcm";
import type { ProbeSource } from "./probe-protocol";
import { makeSource } from "./source";

/** Acima disto o arquivo não é lido inteiro na memória (`decodeAudioData`). */
const MAX_WHOLE_FILE_BYTES = 256 * 1024 * 1024;

/** Recebe cada bloco decodificado (planos float de até 2 canais). */
type Sink = (planes: Float32Array[], frames: number, rate: number, channels: number) => void;

/** Lê a trilha em streaming. `false` se o Mediabunny não abrir/decodificar o arquivo. */
async function streamMediabunny(source: ProbeSource, sink: Sink): Promise<boolean> {
  const input = new Input({ source: makeSource(source, 16 * 1024 * 1024), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return false;
    let any = false;
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        const nch = Math.min(2, sample.numberOfChannels);
        const planes: Float32Array[] = [];
        for (let c = 0; c < nch; c++) {
          const plane = new Float32Array(sample.numberOfFrames);
          sample.copyTo(plane, { planeIndex: c, format: "f32-planar" });
          planes.push(plane);
        }
        sink(planes, sample.numberOfFrames, sample.sampleRate, nch);
        any ||= sample.numberOfFrames > 0;
      } finally {
        sample.close();
      }
    }
    return any;
  } catch {
    return false;
  } finally {
    input.dispose();
  }
}

async function withWebAudio(url: string): Promise<PcmAudio | null> {
  try {
    const res = await fetch(url);
    const size = Number(res.headers.get("content-length") ?? 0);
    if (size > MAX_WHOLE_FILE_BYTES) return null;
    const bytes = await res.arrayBuffer();
    const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: 44_100 });
    const buffer = await ctx.decodeAudioData(bytes);
    const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c));
    return { channels, sampleRate: buffer.sampleRate };
  } catch {
    return null;
  }
}

function concat(parts: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** PCM completo da trilha (para gravar uma cópia WAV); `null` se nem o WebView decodificar. */
export async function decodeAudioPcm(source: ProbeSource, url: string): Promise<PcmAudio | null> {
  const parts: Float32Array[][] = [[], []];
  let frames = 0;
  let rate = 0;
  let nch = 0;
  const ok = await streamMediabunny(source, (planes, n, r, c) => {
    rate ||= r;
    nch ||= c;
    for (let i = 0; i < nch; i++) parts[i]!.push(planes[Math.min(i, planes.length - 1)]!);
    frames += n;
  });
  if (ok && rate > 0) return { channels: parts.slice(0, nch).map((p) => concat(p, frames)), sampleRate: rate };
  return withWebAudio(url);
}

export interface MonoAudio {
  /** Mono em `rate` Hz. */
  samples: Float32Array;
  rate: number;
  sourceRate: number;
  channels: number;
}

/**
 * Só o mono em `rate` Hz (para analisar batidas e desenhar a waveform), convertido
 * enquanto decodifica: uma faixa de 7 min ocupa ~18 MB em vez de ~150 MB.
 */
export async function decodeAudioMono(source: ProbeSource, url: string, rate: number): Promise<MonoAudio | null> {
  let down: MonoDownsampler | null = null;
  let sourceRate = 0;
  let channels = 0;
  const ok = await streamMediabunny(source, (planes, n, r, c) => {
    if (!down) {
      down = new MonoDownsampler(r, rate);
      sourceRate = r;
      channels = c;
    }
    down.push(planes, n);
  });
  const done = down as MonoDownsampler | null;
  if (ok && done) return { samples: done.finish(), rate, sourceRate, channels };
  const pcm = await withWebAudio(url);
  return pcm ? { samples: toMono(pcm, rate), rate, sourceRate: pcm.sampleRate, channels: pcm.channels.length } : null;
}
