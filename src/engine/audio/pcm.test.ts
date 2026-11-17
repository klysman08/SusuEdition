import { describe, expect, it } from "vitest";

import { encodeWav, MonoDownsampler, toMono } from "./pcm";

describe("encodeWav", () => {
  it("gera um WAV PCM 16-bit estéreo com cabeçalho correto", async () => {
    const left = new Float32Array([0, 1, -1, 0.5]);
    const right = new Float32Array([0, -1, 1, -0.5]);
    const blob = encodeWav({ channels: [left, right], sampleRate: 44_100 });
    expect(blob.type).toBe("audio/wav");
    const v = new DataView(await blob.arrayBuffer());
    const text = (at: number, n: number) =>
      String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44_100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(4 * 2 * 2);
    expect(blob.size).toBe(44 + 16);
    // intercalado L, R
    expect(v.getInt16(44 + 4, true)).toBe(32767);
    expect(v.getInt16(44 + 6, true)).toBe(-32768);
  });

  it("limita a 2 canais e corta valores fora de [-1, 1]", async () => {
    const c = new Float32Array([2, -3]);
    const v = new DataView(await encodeWav({ channels: [c, c, c], sampleRate: 8000 }).arrayBuffer());
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
  });
});

describe("toMono", () => {
  it("faz a média dos canais e das janelas", () => {
    const pcm = { channels: [new Float32Array([1, 1, 0, 0]), new Float32Array([0, 0, 0, 0])], sampleRate: 4 };
    expect(Array.from(toMono(pcm, 2))).toEqual([0.5, 0]);
  });

  it("áudio vazio dá mono vazio", () => {
    expect(toMono({ channels: [], sampleRate: 44_100 }, 11_025).length).toBe(0);
  });
});

describe("MonoDownsampler", () => {
  it("dá o mesmo resultado em blocos ou de uma vez", () => {
    const n = 10_000;
    const l = Float32Array.from({ length: n }, (_, i) => Math.sin(i * 0.01));
    const r = Float32Array.from({ length: n }, (_, i) => Math.cos(i * 0.013));
    const whole = toMono({ channels: [l, r], sampleRate: 44_100 }, 11_025);
    const d = new MonoDownsampler(44_100, 11_025);
    for (let at = 0; at < n; at += 1024) {
      const end = Math.min(n, at + 1024);
      d.push([l.subarray(at, end), r.subarray(at, end)], end - at);
    }
    const chunked = d.finish();
    expect(chunked.length).toBe(whole.length);
    expect(chunked.length).toBe(n / 4);
    for (let i = 0; i < whole.length; i++) expect(chunked[i]).toBeCloseTo(whole[i]!, 6);
  });
});
