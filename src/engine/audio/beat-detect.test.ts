import { describe, expect, it } from "vitest";

import { detectBeats } from "./beat-detect";

const RATE = 11025;

/** Faixa sintética: "kick" (seno grave com decaimento) + clique agudo a cada batida, sobre ruído. */
function clickTrack(bpm: number, secs: number, offset: number): { samples: Float32Array; truth: number[] } {
  const n = Math.floor(secs * RATE);
  const samples = new Float32Array(n);
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    samples[i] = ((seed >>> 16) / 65535 - 0.5) * 0.02;
  }
  const truth: number[] = [];
  for (let t = offset; t < secs - 0.2; t += 60 / bpm) {
    truth.push(t);
    const start = Math.floor(t * RATE);
    for (let i = 0; i < 0.12 * RATE && start + i < n; i++) {
      const x = i / RATE;
      samples[start + i]! +=
        Math.sin(2 * Math.PI * 80 * x) * Math.exp(-x * 30) * 0.8 +
        Math.sin(2 * Math.PI * 2500 * x) * Math.exp(-x * 200) * 0.4;
    }
  }
  return { samples, truth };
}

describe("detectBeats", () => {
  it.each([90, 120, 140])("detecta %i BPM e alinha as batidas", (bpm) => {
    const { samples, truth } = clickTrack(bpm, 30, 0.37);
    const res = detectBeats(samples, RATE);
    expect(Math.abs(res.bpm! - bpm)).toBeLessThanOrEqual(2);
    expect(res.beats.length).toBeGreaterThanOrEqual(truth.length * 0.85);
    const aligned = res.beats.filter((b) => truth.some((t) => Math.abs(t - b.timeSec) <= 0.04)).length;
    expect(aligned).toBeGreaterThanOrEqual(res.beats.length * 0.9);
    expect(res.beats.every((b) => b.strength >= 0 && b.strength <= 1)).toBe(true);
  });

  it("silêncio não tem batidas", () => {
    expect(detectBeats(new Float32Array(RATE * 10), RATE)).toEqual({ bpm: null, beats: [] });
  });
});
