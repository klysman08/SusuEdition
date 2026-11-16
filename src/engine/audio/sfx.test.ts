import { describe, expect, it } from "vitest";

import { isSfxKind, mixSfxInto, SFX_KINDS, SFX_SHAPE, sfxEvents, synthSfx } from "./sfx";

const RATE = 48_000;

describe("synthSfx", () => {
  it.each(SFX_KINDS)("%s: amostras finitas, na duração certa e sem estourar", (kind) => {
    const clip = synthSfx(kind, RATE);
    expect(clip.samples.length).toBe(Math.round(SFX_SHAPE[kind].durationSec * RATE));
    let peak = 0;
    let energy = 0;
    for (const v of clip.samples) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(peak).toBeLessThanOrEqual(0.86);
    expect(energy).toBeGreaterThan(1);
    // termina em silêncio (sem estalo)
    expect(Math.abs(clip.samples.at(-1)!)).toBeLessThan(1e-3);
  });

  it("é determinístico: a mesma taxa dá as mesmas amostras", () => {
    const a = synthSfx("glitch", 22_050).samples;
    const b = synthSfx("glitch", 22_050).samples;
    expect(a).toBe(b); // cache
    expect(Array.from(synthSfx("whoosh", 8000).samples.slice(0, 64))).toEqual(
      Array.from(synthSfx("whoosh", 8000).samples.slice(0, 64)),
    );
  });

  it("o ponto de impacto fica dentro do som", () => {
    for (const kind of SFX_KINDS) {
      expect(SFX_SHAPE[kind].anchorSec).toBeGreaterThanOrEqual(0);
      expect(SFX_SHAPE[kind].anchorSec).toBeLessThan(SFX_SHAPE[kind].durationSec);
    }
    expect(isSfxKind("whoosh")).toBe(true);
    expect(isSfxKind("auto")).toBe(false);
  });
});

describe("sfxEvents", () => {
  it("começa o som antes do corte para o impacto cair em cima dele", () => {
    const events = sfxEvents([{ startSec: 0 }, { startSec: 2, sfx: "whoosh" }, { startSec: 4, sfx: "click" }]);
    expect(events).toEqual([
      { kind: "whoosh", startSec: 2 - SFX_SHAPE.whoosh.anchorSec, cutSec: 2 },
      { kind: "click", startSec: 4, cutSec: 4 },
    ]);
  });

  it("nunca começa antes do início do vídeo", () => {
    expect(sfxEvents([{ startSec: 0.1, sfx: "whoosh" }])[0]!.startSec).toBe(0);
  });
});

describe("mixSfxInto", () => {
  it("soma o som nos dois canais, na posição certa, mesmo entre blocos", () => {
    const events = sfxEvents([{ startSec: 1, sfx: "click" }]);
    const clip = synthSfx("click", RATE);
    const block = RATE / 2;
    // Bloco 0,5–1,0 s: ainda em silêncio.
    const before = [new Float32Array(block), new Float32Array(block)] as const;
    mixSfxInto(before[0], before[1], events, 0.5, block, RATE, 1);
    expect(before[0].every((v) => v === 0)).toBe(true);
    // Bloco 1,0–1,5 s: o clique começa na primeira amostra.
    const L = new Float32Array(block);
    const R = new Float32Array(block);
    mixSfxInto(L, R, events, 1, block, RATE, 0.5);
    expect(L[10]).toBeCloseTo(clip.samples[10]! * 0.5);
    expect(R[10]).toBe(L[10]);
    expect(L[clip.samples.length + 5]).toBe(0);
  });

  it("volume zero não mexe no áudio", () => {
    const L = new Float32Array(100).fill(0.25);
    const R = new Float32Array(100).fill(0.25);
    mixSfxInto(L, R, sfxEvents([{ startSec: 0, sfx: "pop" }]), 0, 100, RATE, 0);
    expect(L.every((v) => v === 0.25)).toBe(true);
  });
});
