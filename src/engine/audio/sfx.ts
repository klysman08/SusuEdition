/**
 * Efeitos sonoros das transições, sintetizados na hora (nenhum arquivo de áudio é
 * embutido no app). Determinístico: a prévia (WebAudio) e a exportação (mixagem em
 * blocos) usam exatamente as mesmas amostras.
 */

export const SFX_KINDS = ["click", "shutter", "whoosh", "swish", "impact", "pop", "glitch", "chime"] as const;

export type SfxKind = (typeof SFX_KINDS)[number];

export function isSfxKind(v: unknown): v is SfxKind {
  return typeof v === "string" && (SFX_KINDS as readonly string[]).includes(v);
}

export interface SfxClip {
  /** Mono, em [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
  /** Ponto do som que cai em cima do corte (o "golpe"): o som começa `anchorSec` antes. */
  anchorSec: number;
}

/** Duração e ponto de impacto de cada efeito (s). */
export const SFX_SHAPE: Record<SfxKind, { durationSec: number; anchorSec: number }> = {
  click: { durationSec: 0.05, anchorSec: 0 },
  shutter: { durationSec: 0.24, anchorSec: 0.005 },
  whoosh: { durationSec: 0.62, anchorSec: 0.3 },
  swish: { durationSec: 0.28, anchorSec: 0.12 },
  impact: { durationSec: 0.75, anchorSec: 0.005 },
  pop: { durationSec: 0.14, anchorSec: 0 },
  glitch: { durationSec: 0.3, anchorSec: 0.08 },
  chime: { durationSec: 0.95, anchorSec: 0 },
};

/** PRNG pequeno e determinístico (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

/**
 * Ruído filtrado por um passa-banda de estado variável cuja frequência central muda
 * ao longo do tempo — a base de whoosh, swish e obturador.
 */
function sweptNoise(
  out: Float32Array,
  rate: number,
  seed: number,
  freqAt: (t: number) => number,
  ampAt: (t: number) => number,
  q = 1.6,
  from = 0,
  to = out.length,
): void {
  const rand = rng(seed);
  let low = 0;
  let band = 0;
  const damp = 1 / q;
  for (let i = from; i < to; i++) {
    const t = (i - from) / rate;
    const f = 2 * Math.sin((Math.PI * Math.min(freqAt(t), rate * 0.22)) / rate);
    const x = rand() * 2 - 1;
    low += f * band;
    const high = x - low - damp * band;
    band += f * high;
    out[i]! += band * ampAt(t);
  }
}

/** Senoide com frequência variável (fase integrada, sem saltos). */
function sweptSine(
  out: Float32Array,
  rate: number,
  freqAt: (t: number) => number,
  ampAt: (t: number) => number,
  from = 0,
  to = out.length,
): void {
  let phase = 0;
  for (let i = from; i < to; i++) {
    const t = (i - from) / rate;
    phase += (TAU * freqAt(t)) / rate;
    out[i]! += Math.sin(phase) * ampAt(t);
  }
}

const bell = (t: number, d: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t / d))) ** 2;
const attack = (t: number, a: number) => Math.min(1, t / a);

function render(kind: SfxKind, rate: number): Float32Array {
  const d = SFX_SHAPE[kind].durationSec;
  const n = Math.round(d * rate);
  const out = new Float32Array(n);
  const at = (sec: number) => Math.min(n, Math.round(sec * rate));

  switch (kind) {
    // Clique seco: um tique agudo com um sopro curto de ruído.
    case "click":
      sweptSine(
        out,
        rate,
        () => 2400,
        (t) => 0.7 * Math.exp(-t * 320),
      );
      sweptNoise(
        out,
        rate,
        11,
        () => 5200,
        (t) => 0.9 * Math.exp(-t * 700),
        1.2,
      );
      break;

    // Obturador de câmera: abre (clique), cortina correndo, fecha (clique mais grave).
    case "shutter": {
      const second = 0.085;
      sweptNoise(
        out,
        rate,
        21,
        () => 3800,
        (t) => 1.1 * Math.exp(-t * 260),
        2.2,
      );
      sweptSine(
        out,
        rate,
        () => 1500,
        (t) => 0.35 * Math.exp(-t * 300),
      );
      sweptNoise(
        out,
        rate,
        22,
        (t) => 900 + 2600 * (t / second),
        (t) => 0.16 * bell(t, second),
        1.1,
        at(0.01),
        at(second),
      );
      sweptNoise(
        out,
        rate,
        23,
        () => 2600,
        (t) => 1.0 * Math.exp(-t * 190),
        2.4,
        at(second),
      );
      sweptSine(
        out,
        rate,
        () => 900,
        (t) => 0.3 * Math.exp(-t * 220),
        at(second),
      );
      break;
    }

    // Whoosh: ruído que sobe e desce de tom, com o pico em cima do corte.
    case "whoosh":
      sweptNoise(
        out,
        rate,
        31,
        (t) => 260 * 2 ** (3.4 * bell(t, d)),
        (t) => 1.2 * bell(t, d) ** 1.4,
        1.8,
      );
      sweptNoise(
        out,
        rate,
        32,
        (t) => 90 + 240 * bell(t, d),
        (t) => 0.5 * bell(t, d) ** 2,
        0.9,
      );
      break;

    // Swish: um whoosh curto e agudo, para transições suaves.
    case "swish":
      sweptNoise(
        out,
        rate,
        41,
        (t) => 1400 * 2 ** (1.9 * bell(t, d)),
        (t) => 0.9 * bell(t, d) ** 1.6,
        2.4,
      );
      break;

    // Impacto: um golpe grave que desce de tom, com um estalo no ataque.
    case "impact":
      sweptSine(
        out,
        rate,
        (t) => 44 + 120 * Math.exp(-t * 22),
        (t) => 1.25 * attack(t, 0.003) * Math.exp(-t * 5.5),
      );
      sweptSine(
        out,
        rate,
        (t) => 88 + 150 * Math.exp(-t * 30),
        (t) => 0.4 * attack(t, 0.003) * Math.exp(-t * 11),
      );
      sweptNoise(
        out,
        rate,
        51,
        (t) => 2600 * Math.exp(-t * 28) + 180,
        (t) => 0.9 * Math.exp(-t * 34),
        0.8,
      );
      for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i]! * 1.6);
      break;

    // Pop: uma bolha — tom que cai rápido.
    case "pop":
      sweptSine(
        out,
        rate,
        (t) => 240 + 760 * Math.exp(-t * 55),
        (t) => attack(t, 0.002) * Math.exp(-t * 42),
      );
      break;

    // Glitch: rajadas digitais (onda quadrada / ruído amostrado em degraus).
    case "glitch": {
      const rand = rng(61);
      const bursts = 9;
      const step = n / bursts;
      for (let b = 0; b < bursts; b++) {
        const from = Math.round(b * step);
        const to = Math.round((b + 0.35 + rand() * 0.6) * step);
        const mode = rand();
        const freq = 180 * 2 ** (rand() * 4.2);
        const hold = 2 + Math.floor(rand() * 14);
        const level = 0.35 + rand() * 0.55;
        let held = 0;
        for (let i = from; i < Math.min(n, to); i++) {
          if ((i - from) % hold === 0) {
            held = mode < 0.55 ? (Math.sin((TAU * freq * i) / rate) >= 0 ? 1 : -1) : rand() * 2 - 1;
          }
          out[i]! += held * level;
        }
      }
      for (let i = 0; i < n; i++) out[i]! *= 0.35 + 0.65 * bell(i / rate, d);
      break;
    }

    // Sino: parciais inarmônicas com decaimentos diferentes.
    case "chime": {
      const partials: [number, number, number][] = [
        [1318.5, 0.55, 4.5],
        [1975.5, 0.3, 6.5],
        [2637, 0.22, 8],
        [3520, 0.12, 11],
        [5274, 0.06, 16],
      ];
      for (const [f, a, decay] of partials) {
        sweptSine(
          out,
          rate,
          () => f,
          (t) => a * attack(t, 0.003) * Math.exp(-t * decay),
        );
      }
      break;
    }
  }

  // Normaliza para um pico fixo e fecha os últimos 6 ms em zero (sem estalo no fim).
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const gain = peak > 0 ? 0.85 / peak : 0;
  const tail = Math.min(n, Math.round(0.006 * rate));
  for (let i = 0; i < n; i++) {
    const fade = i >= n - tail ? (n - 1 - i) / tail : 1;
    out[i] = out[i]! * gain * fade;
  }
  return out;
}

const cache = new Map<string, SfxClip>();

/** Amostras do efeito na taxa pedida (calculadas uma vez por efeito e taxa). */
export function synthSfx(kind: SfxKind, sampleRate: number): SfxClip {
  const key = `${kind}:${sampleRate}`;
  let clip = cache.get(key);
  if (!clip) {
    clip = { samples: render(kind, sampleRate), sampleRate, anchorSec: SFX_SHAPE[kind].anchorSec };
    cache.set(key, clip);
  }
  return clip;
}

export interface SfxEvent {
  kind: SfxKind;
  /** Quando o som começa na timeline (o impacto cai em `cutSec`). */
  startSec: number;
  /** O corte que o som acompanha. */
  cutSec: number;
}

/**
 * Sons a tocar no vídeo: um por segmento com `sfx`, alinhado ao corte de entrada.
 * Ordenados pelo início.
 */
export function sfxEvents(segments: readonly { startSec: number; sfx?: SfxKind }[]): SfxEvent[] {
  const out: SfxEvent[] = [];
  for (const seg of segments) {
    if (!seg.sfx) continue;
    out.push({
      kind: seg.sfx,
      startSec: Math.max(0, seg.startSec - SFX_SHAPE[seg.sfx].anchorSec),
      cutSec: seg.startSec,
    });
  }
  return out.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Soma os efeitos sonoros que caem no bloco `[t0, t0 + frames / rate)` em `L`/`R`.
 * Usado pela mixagem da exportação.
 */
export function mixSfxInto(
  L: Float32Array,
  R: Float32Array,
  events: readonly SfxEvent[],
  t0: number,
  frames: number,
  rate: number,
  gain: number,
): void {
  if (gain <= 0) return;
  const block0 = Math.round(t0 * rate);
  for (const ev of events) {
    const clip = synthSfx(ev.kind, rate);
    const start = Math.round(ev.startSec * rate);
    const from = Math.max(block0, start);
    const to = Math.min(block0 + frames, start + clip.samples.length);
    for (let i = from; i < to; i++) {
      const v = clip.samples[i - start]! * gain;
      L[i - block0]! += v;
      R[i - block0]! += v;
    }
  }
}
