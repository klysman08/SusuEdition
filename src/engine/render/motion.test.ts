import { describe, expect, it } from "vitest";

import { applyMotion, lookFilter, MOTION_ZOOM, motionTransform } from "./motion";
import { layersAt } from "./schedule";

const rect = { x: 0, y: 0, w: 1000, h: 500 };

describe("motionTransform", () => {
  it("sem movimento não transforma", () => {
    expect(motionTransform(undefined, 0.5)).toBeNull();
    expect(motionTransform("none", 0.5)).toBeNull();
  });

  it("zoom cresce (ou diminui) continuamente e nunca fica menor que o enquadramento", () => {
    const zin = [0, 0.5, 1].map((p) => motionTransform("zoomIn", p)!.scale);
    expect(zin[0]!).toBeLessThan(zin[1]!);
    expect(zin[1]!).toBeLessThan(zin[2]!);
    expect(zin[2]! - zin[0]!).toBeCloseTo(MOTION_ZOOM, 6);
    const zout = [0, 1].map((p) => motionTransform("zoomOut", p)!.scale);
    expect(zout[0]!).toBeGreaterThan(zout[1]!);
    // Durante um fade a mídia aparece um pouco antes do início e depois do fim.
    for (const kind of ["zoomIn", "zoomOut", "panLeft", "panRight"] as const) {
      for (const p of [-0.5, -0.2, 0, 0.5, 1, 1.2, 2]) {
        expect(motionTransform(kind, p)!.scale).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("deslocamento: a mídia ampliada sempre cobre o enquadramento original", () => {
    for (const kind of ["panLeft", "panRight"] as const) {
      for (const p of [-0.2, 0, 0.3, 1, 1.2]) {
        const r = applyMotion(rect, motionTransform(kind, p));
        expect(r.x).toBeLessThanOrEqual(1e-9);
        expect(r.x + r.w).toBeGreaterThanOrEqual(rect.w - 1e-9);
        expect(r.y).toBeLessThanOrEqual(1e-9);
        expect(r.y + r.h).toBeGreaterThanOrEqual(rect.h - 1e-9);
      }
    }
    const left0 = applyMotion(rect, motionTransform("panLeft", 0));
    const left1 = applyMotion(rect, motionTransform("panLeft", 1));
    expect(left1.x).toBeLessThan(left0.x);
  });

  it("applyMotion amplia em torno do centro", () => {
    const r = applyMotion({ x: 100, y: 50, w: 200, h: 100 }, { scale: 1.5, dx: 0, dy: 0 });
    expect(r).toEqual({ x: 50, y: 25, w: 300, h: 150 });
    expect(applyMotion(rect, null)).toBe(rect);
  });
});

describe("lookFilter", () => {
  it("resolve o preset com a intensidade; 'none' ou intensidade 0 não filtram", () => {
    expect(lookFilter(undefined)).toBeNull();
    expect(lookFilter({ preset: "none", intensity: 1 })).toBeNull();
    expect(lookFilter({ preset: "mono", intensity: 0 })).toBeNull();
    expect(lookFilter({ preset: "mono", intensity: 0.5 })!.grayscale).toBeCloseTo(0.5, 6);
  });
});

describe("layersAt — progresso dentro do segmento", () => {
  it("vai de 0 a 1 e continua no fade para a mídia seguinte", () => {
    const seg = (id: string, start: number, fade = 0) => ({
      mediaId: id,
      kind: "image" as const,
      startSec: start,
      durationSec: 2,
      sourceInSec: 0,
      sourceOutSec: 2,
      transitionIn: fade > 0 ? ({ kind: "fade", durationSec: fade } as const) : ({ kind: "cut" } as const),
      keepAudio: false,
      gain: 1,
    });
    const segments = [seg("a", 0), seg("b", 2, 1)];
    expect(layersAt(segments, 1)[0]!.progress).toBeCloseTo(0.5, 6);
    const [a, b] = layersAt(segments, 2.25);
    expect(a!.segment.mediaId).toBe("a");
    expect(a!.progress).toBeCloseTo(1.125, 6);
    expect(b!.progress).toBeCloseTo(0.125, 6);
  });
});
