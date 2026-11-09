import { describe, expect, it } from "vitest";

import { musicFadeAt, musicVolumeAt, DEFAULT_AUDIO_MIX } from "../audio/mix";
import type { TimelineSegment } from "../timeline";
import { coversTarget, decodeSize, fitRect } from "./fit";
import { layersAt, segmentIndexAt, upcomingSegments } from "./schedule";

describe("fitRect", () => {
  const landscape = { width: 1920, height: 1080 };
  const portrait = { width: 1080, height: 1920 };

  it("fit cabe inteira com faixas", () => {
    expect(fitRect(landscape, portrait, "fit")).toEqual({ x: 0, y: 656.25, w: 1080, h: 607.5 });
  });
  it("cover preenche e corta", () => {
    const r = fitRect(landscape, portrait, "cover");
    expect(r.h).toBe(1920);
    expect(r.w).toBeCloseTo(3413.33, 1);
    expect(r.x).toBeCloseTo(-1166.67, 1);
    expect(coversTarget(r, portrait)).toBe(true);
  });
  it("fill estica", () => {
    expect(fitRect(landscape, portrait, "fill")).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });
  it("fit da mesma proporção cobre o destino", () => {
    expect(coversTarget(fitRect({ width: 3840, height: 2160 }, landscape, "fit"), landscape)).toBe(true);
    expect(coversTarget(fitRect(landscape, portrait, "fit"), portrait)).toBe(false);
  });
  it("decodeSize cobre o destino sem ampliar", () => {
    expect(decodeSize({ width: 4000, height: 3000 }, { width: 720, height: 1280 })).toEqual({
      width: 1707,
      height: 1280,
    });
    expect(decodeSize({ width: 400, height: 300 }, { width: 720, height: 1280 })).toEqual({ width: 400, height: 300 });
  });
});

const seg = (i: number, start: number, dur: number, fade = 0): TimelineSegment => ({
  mediaId: `m${i}`,
  kind: "image",
  startSec: start,
  durationSec: dur,
  sourceInSec: 0,
  sourceOutSec: dur,
  transitionIn: fade > 0 ? { kind: "fade", durationSec: fade } : { kind: "cut" },
  keepAudio: false,
  gain: 1,
});

describe("layersAt", () => {
  const cuts = [seg(0, 0, 2), seg(1, 2, 2), seg(2, 4, 2)];
  const fades = [seg(0, 0, 2), seg(1, 2, 2, 1), seg(2, 4, 2, 1)];

  it("corte: uma camada por vez, o fim pertence ao último segmento", () => {
    expect(layersAt(cuts, 1.99).map((l) => l.index)).toEqual([0]);
    expect(layersAt(cuts, 2).map((l) => l.index)).toEqual([1]);
    expect(layersAt(cuts, 6).map((l) => l.index)).toEqual([2]);
    expect(layersAt([], 1)).toEqual([]);
  });

  it("fade centrado no corte mistura as duas camadas", () => {
    expect(layersAt(fades, 1.4).map((l) => l.index)).toEqual([0]);
    const before = layersAt(fades, 1.75);
    expect(before.map((l) => [l.index, l.alpha])).toEqual([
      [0, 1],
      [1, 0.25],
    ]);
    const after = layersAt(fades, 2.25);
    expect(after.map((l) => [l.index, l.alpha])).toEqual([
      [0, 1],
      [1, 0.75],
    ]);
    expect(layersAt(fades, 2.6).map((l) => l.index)).toEqual([1]);
  });

  it("tempo de origem continua antes/depois do trecho durante o fade", () => {
    const [prev, next] = layersAt(fades, 2.25);
    expect(prev!.sourceTimeSec).toBeCloseTo(2.25);
    expect(next!.sourceTimeSec).toBeCloseTo(0.25);
    expect(layersAt(fades, 1.75)[1]!.sourceTimeSec).toBe(0);
  });

  it("segmentIndexAt e upcoming", () => {
    expect(segmentIndexAt(cuts, -1)).toBe(0);
    expect(segmentIndexAt(cuts, 3.9)).toBe(1);
    expect(upcomingSegments(cuts, 1, 2).map((s) => s.mediaId)).toEqual(["m0", "m1"]);
  });
});

describe("mix de áudio", () => {
  const plan = { musicInSec: 10, musicOutSec: 40, fadeOutSec: 3 };

  it("fade-out nos últimos segundos", () => {
    expect(musicFadeAt(0, 30, 3)).toBe(1);
    expect(musicFadeAt(28.5, 30, 3)).toBeCloseTo(0.5);
    expect(musicFadeAt(30, 30, 3)).toBe(0);
    expect(musicFadeAt(29, 30, 0)).toBe(1);
  });

  it("ducking reduz a música enquanto há vídeo com som", () => {
    expect(musicVolumeAt(5, plan, 30, DEFAULT_AUDIO_MIX, 0)).toBe(1);
    expect(musicVolumeAt(5, plan, 30, DEFAULT_AUDIO_MIX, 1)).toBeCloseTo(0.35);
    expect(musicVolumeAt(5, plan, 30, DEFAULT_AUDIO_MIX, 0.5)).toBeCloseTo(0.675);
  });

  it("sem música, fora do vídeo ou depois do fim da música: silêncio", () => {
    expect(musicVolumeAt(5, null, 30, DEFAULT_AUDIO_MIX, 0)).toBe(0);
    expect(musicVolumeAt(31, plan, 30, DEFAULT_AUDIO_MIX, 0)).toBe(0);
    expect(musicVolumeAt(35, { musicInSec: 0, musicOutSec: 20, fadeOutSec: 0 }, 40, DEFAULT_AUDIO_MIX, 0)).toBe(0);
  });
});
