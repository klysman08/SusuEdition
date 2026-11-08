/** Picos normalizados (0..1) em `buckets` faixas — igual a `services::audio::peaks` no Rust. */
export function computePeaks(samples: Float32Array, buckets: number): number[] {
  if (samples.length === 0 || buckets <= 0) return [];
  const n = Math.min(buckets, samples.length);
  const out = new Array<number>(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * samples.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * samples.length) / n));
    let m = 0;
    for (let j = a; j < b; j++) m = Math.max(m, Math.abs(samples[j]!));
    out[i] = m;
    max = Math.max(max, m);
  }
  return max > 0 ? out.map((p) => Math.round((p / max) * 1000) / 1000) : out;
}

/** Máximo dos picos no intervalo [from, to) — usado para desenhar uma coluna de pixels. */
export function peakInRange(peaks: readonly number[], from: number, to: number): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(to)));
  let m = 0;
  for (let i = a; i < b; i++) m = Math.max(m, peaks[i]!);
  return m;
}
