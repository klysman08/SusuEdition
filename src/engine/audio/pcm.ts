/**
 * Áudio PCM em memória: o que o fallback de decodificação produz quando o leitor nativo
 * não abre um arquivo. Funções puras (testáveis no Vitest).
 */

export interface PcmAudio {
  /** Um plano por canal (no máximo 2), amostras em [-1, 1]. */
  channels: Float32Array[];
  sampleRate: number;
}

/** WAV PCM 16-bit (cabeçalho canônico de 44 bytes). */
export function encodeWav(pcm: PcmAudio): Blob {
  const channels = pcm.channels.slice(0, 2);
  const nch = Math.max(1, channels.length);
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * nch * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nch, true);
  v.setUint32(24, pcm.sampleRate, true);
  v.setUint32(28, pcm.sampleRate * nch * 2, true);
  v.setUint16(32, nch * 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, dataBytes, true);
  const out = new Int16Array(buf, 44, frames * nch);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      out[i * nch + c] = Math.round(s < 0 ? s * 32768 : s * 32767);
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

/**
 * Converte áudio para mono numa taxa menor enquanto ele é decodificado (média dos canais
 * e de cada janela — o mesmo que o Rust faz para a análise de batidas). A memória fica
 * proporcional à saída, não ao arquivo.
 */
export class MonoDownsampler {
  private readonly step: number;
  private next: number;
  private pos = 0;
  private sum = 0;
  private count = 0;
  private buf: Float32Array;
  private len = 0;

  constructor(fromRate: number, toRate: number) {
    this.step = fromRate / toRate;
    this.next = this.step;
    this.buf = new Float32Array(1 << 16);
  }

  /** `channels[c]` tem `frames` amostras. */
  push(channels: readonly Float32Array[], frames: number): void {
    const nch = channels.length;
    if (nch === 0) return;
    for (let i = 0; i < frames; i++) {
      let x = 0;
      for (let c = 0; c < nch; c++) x += channels[c]![i]!;
      this.sum += x / nch;
      this.count++;
      this.pos++;
      while (this.pos >= this.next) {
        this.emit(this.count > 0 ? this.sum / this.count : 0);
        this.sum = 0;
        this.count = 0;
        this.next += this.step;
      }
    }
  }

  finish(): Float32Array {
    return this.buf.slice(0, this.len);
  }

  private emit(v: number) {
    if (this.len === this.buf.length) {
      const bigger = new Float32Array(this.buf.length * 2);
      bigger.set(this.buf);
      this.buf = bigger;
    }
    this.buf[this.len++] = v;
  }
}

/** Mono na taxa `rate` de um áudio já decodificado. */
export function toMono(pcm: PcmAudio, rate: number): Float32Array {
  const frames = pcm.channels[0]?.length ?? 0;
  if (frames === 0 || pcm.channels.length === 0) return new Float32Array(0);
  const d = new MonoDownsampler(pcm.sampleRate, rate);
  d.push(pcm.channels, frames);
  return d.finish();
}
