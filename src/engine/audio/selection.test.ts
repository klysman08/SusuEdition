import { describe, expect, it } from "vitest";

import type { Beat } from "../types";
import { computePeaks, peakInRange } from "./peaks";
import {
  clampSelection,
  defaultSelection,
  moveSelection,
  nearestBeat,
  setEdge,
  snapTime,
  withLength,
} from "./selection";

const beatsEvery = (period: number, from: number, to: number, strength = 1): Beat[] => {
  const out: Beat[] = [];
  for (let t = from; t <= to; t += period) out.push({ timeSec: Math.round(t * 1000) / 1000, strength });
  return out;
};

describe("clampSelection", () => {
  it("mantém dentro da música e com duração mínima", () => {
    expect(clampSelection({ inSec: -5, outSec: 500 }, 200)).toEqual({ inSec: 0, outSec: 200 });
    expect(clampSelection({ inSec: 199.8, outSec: 199.9 }, 200)).toEqual({ inSec: 199, outSec: 200 });
    expect(clampSelection({ inSec: 10, outSec: 10.2 }, 200)).toEqual({ inSec: 10, outSec: 11 });
  });
  it("músicas menores que a duração mínima usam a faixa inteira", () => {
    expect(clampSelection({ inSec: 0, outSec: 0.2 }, 0.5)).toEqual({ inSec: 0, outSec: 0.5 });
  });
});

describe("batidas", () => {
  const beats = beatsEvery(0.5, 0.25, 30);

  it("encontra a batida mais próxima dentro do limite", () => {
    expect(nearestBeat(10.1, beats)?.timeSec).toBe(10.25);
    expect(nearestBeat(10.45, beats)?.timeSec).toBe(10.25);
    expect(nearestBeat(100, beats)).toBeNull();
    expect(nearestBeat(1, [])).toBeNull();
  });

  it("snap só quando habilitado", () => {
    expect(snapTime(5.1, beats, true)).toBe(5.25);
    expect(snapTime(5.1, beats, false)).toBe(5.1);
  });
});

describe("defaultSelection", () => {
  it("pula a introdução até a primeira batida forte e dura 60 s", () => {
    const beats = [...beatsEvery(0.5, 0.5, 3, 0.2), ...beatsEvery(0.5, 3.5, 200)];
    expect(defaultSelection(200, beats)).toEqual({ inSec: 3.5, outSec: 63.5 });
  });

  it("músicas curtas usam a faixa inteira", () => {
    expect(defaultSelection(42, [])).toEqual({ inSec: 0, outSec: 42 });
  });
});

describe("edição da seleção", () => {
  const sel = { inSec: 10, outSec: 40 };
  const beats = beatsEvery(0.5, 0, 200);

  it("move mantendo a duração e sem sair da música", () => {
    expect(moveSelection(sel, 5, 200)).toEqual({ inSec: 15, outSec: 45 });
    expect(moveSelection(sel, -50, 200)).toEqual({ inSec: 0, outSec: 30 });
    expect(moveSelection(sel, 500, 200)).toEqual({ inSec: 170, outSec: 200 });
  });

  it("ajusta bordas com snap e sem cruzar a outra borda", () => {
    expect(setEdge(sel, "in", 12.1, 200, beats, true)).toEqual({ inSec: 12, outSec: 40 });
    expect(setEdge(sel, "in", 45, 200)).toEqual({ inSec: 39, outSec: 40 });
    expect(setEdge(sel, "out", 5, 200)).toEqual({ inSec: 10, outSec: 11 });
    expect(setEdge(sel, "out", 300, 200)).toEqual({ inSec: 10, outSec: 200 });
  });

  it("define a duração recuando o início quando necessário", () => {
    expect(withLength(sel, 15, 200)).toEqual({ inSec: 10, outSec: 25 });
    expect(withLength({ inSec: 190, outSec: 195 }, 30, 200)).toEqual({ inSec: 170, outSec: 200 });
    expect(withLength(sel, null, 200)).toEqual({ inSec: 0, outSec: 200 });
  });
});

describe("peaks", () => {
  it("normaliza e agrega por faixa", () => {
    const s = new Float32Array(1000).map((_, i) => (i < 500 ? 0.25 : -0.5));
    expect(computePeaks(s, 4)).toEqual([0.5, 0.5, 1, 1]);
    expect(peakInRange([0.1, 0.7, 0.3], 0.5, 2.2)).toBe(0.7);
  });
});
