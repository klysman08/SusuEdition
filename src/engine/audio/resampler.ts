/**
 * Reamostrador linear em streaming para estéreo.
 * Entrada: blocos planares em qualquer taxa/número de canais; saída: L/R na taxa alvo.
 * Mono vira estéreo duplicado; mais de 2 canais usam os dois primeiros.
 */
export class StereoResampler {
  private readonly ratio: number;
  /** Amostras de entrada pendentes (L e R). */
  private bufL: Float32Array = new Float32Array(0);
  private bufR: Float32Array = new Float32Array(0);
  /** Posição fracionária da próxima amostra de saída dentro do buffer. */
  private pos = 0;

  constructor(
    readonly inputRate: number,
    readonly outputRate: number,
  ) {
    this.ratio = inputRate / outputRate;
  }

  /** Quantas amostras de saída já podem ser produzidas. */
  get available(): number {
    if (this.bufL.length < 2) return 0;
    return Math.max(0, Math.floor((this.bufL.length - 1 - this.pos) / this.ratio) + 1);
  }

  push(planes: readonly Float32Array[]): void {
    const l = planes[0];
    if (!l || l.length === 0) return;
    const r = planes[1] ?? l;
    this.bufL = concat(this.bufL, l);
    this.bufR = concat(this.bufR, r);
  }

  /** Adiciona silêncio de entrada (para completar o final). */
  pushSilence(frames: number): void {
    this.push([new Float32Array(frames)]);
  }

  /** Lê até `n` amostras de saída em `outL/outR` a partir de `offset`. Retorna quantas leu. */
  read(outL: Float32Array, outR: Float32Array, offset: number, n: number): number {
    const count = Math.min(n, this.available);
    let pos = this.pos;
    for (let k = 0; k < count; k++) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const l0 = this.bufL[i]!;
      const r0 = this.bufR[i]!;
      const l1 = this.bufL[i + 1] ?? l0;
      const r1 = this.bufR[i + 1] ?? r0;
      outL[offset + k] = l0 + (l1 - l0) * frac;
      outR[offset + k] = r0 + (r1 - r0) * frac;
      pos += this.ratio;
    }
    // Descarta a entrada já consumida (mantém a amostra de interpolação).
    const drop = Math.max(0, Math.floor(pos));
    if (drop > 0) {
      this.bufL = this.bufL.subarray(drop);
      this.bufR = this.bufR.subarray(drop);
      pos -= drop;
    }
    this.pos = pos;
    return count;
  }
}

function concat(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) return b.slice();
  const out = new Float32Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
