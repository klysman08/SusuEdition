import { describe, expect, it } from "vitest";

import { DEFAULT_AUDIO_MIX } from "../audio/mix";
import { duckWeightAt, musicGainAt, videoGainAt } from "../audio/envelope";
import { StereoResampler } from "../audio/resampler";
import type { TimelineSegment } from "../timeline";
import { estimateBytes, exportFileName, frameCount, lowerQuality, planVideoFrames, resolveExport } from "./plan";

const seg = (i: number, kind: "image" | "video", start: number, dur: number, extra: Partial<TimelineSegment> = {}) =>
  ({
    mediaId: `m${i}`,
    kind,
    startSec: start,
    durationSec: dur,
    sourceInSec: 0,
    sourceOutSec: dur,
    transitionIn: { kind: "cut" },
    keepAudio: false,
    gain: 1,
    ...extra,
  }) as TimelineSegment;

describe("plano de exportação", () => {
  it("resolve tamanho, bitrate e fallback de qualidade", () => {
    expect(resolveExport({ aspect: "9:16", quality: "1080p", fps: 30 })).toEqual({
      size: { width: 1080, height: 1920 },
      fps: 30,
      videoBitrate: 12_000_000,
    });
    expect(lowerQuality("4k")).toBe("1080p");
    expect(lowerQuality("720p")).toBeNull();
  });

  it("conta quadros e estima o tamanho", () => {
    expect(frameCount(60, 30)).toBe(1800);
    expect(frameCount(10.01, 60)).toBe(601);
    const bytes = estimateBytes(60, 12_000_000, true);
    expect(bytes / 1e6).toBeCloseTo(93.3, 0);
  });

  it("nome do arquivo com data local", () => {
    expect(exportFileName(new Date(2026, 10, 9, 20, 30, 5))).toBe("SusuEdition_2026-11-09_203005.mp4");
  });

  it("quadros de vídeo cobrem o segmento e a sobreposição dos fades", () => {
    const segments = [
      seg(0, "image", 0, 2),
      seg(1, "video", 2, 1, { sourceInSec: 3, sourceOutSec: 4, transitionIn: { kind: "fade", durationSec: 0.5 } }),
      seg(2, "image", 3, 2, { transitionIn: { kind: "fade", durationSec: 0.5 } }),
    ];
    const [plan] = planVideoFrames(segments, 10, 50, new Map([["m1", 10]]));
    expect(plan).toMatchObject({ index: 1, firstFrame: 18, lastFrame: 32 });
    expect(plan!.sourceTimes[0]).toBeCloseTo(2.8);
    expect(plan!.sourceTimes.at(-1)).toBeCloseTo(4.2);
    expect(plan!.sourceTimes).toHaveLength(15);
  });

  it("tempo de origem nunca passa do fim do arquivo", () => {
    const [plan] = planVideoFrames([seg(0, "video", 0, 2)], 10, 20, new Map([["m0", 1.5]]));
    expect(Math.max(...plan!.sourceTimes)).toBeCloseTo(1.4);
  });
});

describe("StereoResampler", () => {
  it("converte 44,1 kHz mono em 48 kHz estéreo preservando a duração", () => {
    const r = new StereoResampler(44_100, 48_000);
    const sine = new Float32Array(44_100).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 44_100));
    for (let i = 0; i < sine.length; i += 1000) r.push([sine.subarray(i, i + 1000)]);
    const L = new Float32Array(48_000);
    const R = new Float32Array(48_000);
    const n = r.read(L, R, 0, 48_000);
    expect(n).toBeGreaterThan(47_990);
    expect(R[1234]).toBe(L[1234]);
    // Fase correta: a amostra k corresponde a t = k/48000.
    expect(L[4800]).toBeCloseTo(Math.sin(2 * Math.PI * 440 * 0.1), 2);
  });

  it("leituras em pedaços dão o mesmo resultado", () => {
    const a = new StereoResampler(32_000, 48_000);
    const data = new Float32Array(3200).map((_, i) => i / 3200);
    a.push([data, data]);
    const L = new Float32Array(4800);
    const R = new Float32Array(4800);
    let got = 0;
    while (got < 4790) got += a.read(L, R, got, 7);
    expect(L[2400]).toBeCloseTo(0.5, 3);
  });
});

describe("envelopes de áudio", () => {
  const segments = [
    seg(0, "image", 0, 2),
    seg(1, "video", 2, 2, { keepAudio: true, gain: 0.8, transitionIn: { kind: "fade", durationSec: 0.4 } }),
  ];

  it("ducking acompanha a opacidade do vídeo com som", () => {
    expect(duckWeightAt(segments, 1)).toBe(0);
    expect(duckWeightAt(segments, 2)).toBeCloseTo(0.5);
    expect(duckWeightAt(segments, 3)).toBe(1);
    const plan = { musicInSec: 0, musicOutSec: 60, fadeOutSec: 0 };
    expect(musicGainAt(segments, plan, 4, DEFAULT_AUDIO_MIX, 3)).toBeCloseTo(0.35);
  });

  it("áudio do vídeo só dentro do trecho, com rampa e volume", () => {
    expect(videoGainAt(segments, 1, DEFAULT_AUDIO_MIX, 1.9)).toBe(0);
    expect(videoGainAt(segments, 1, DEFAULT_AUDIO_MIX, 2.01)).toBeGreaterThan(0);
    expect(videoGainAt(segments, 1, DEFAULT_AUDIO_MIX, 3)).toBeCloseTo(0.8);
    expect(videoGainAt(segments, 1, DEFAULT_AUDIO_MIX, 4)).toBe(0);
    expect(videoGainAt(segments, 0, DEFAULT_AUDIO_MIX, 1)).toBe(0);
  });
});
