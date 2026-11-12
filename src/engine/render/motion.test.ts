import { describe, expect, it } from "vitest";

import { MOTION_KINDS } from "../timeline/types";
import { cropDecodeTarget, cropForRatio, croppedSize, isFullCrop, normalizeCrop } from "./crop";
import { decodeSize, fitRect } from "./fit";
import { applyMotion, lookFilter, MOTION_TILT, MOTION_ZOOM, motionTransform } from "./motion";
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
    for (const kind of MOTION_KINDS.filter((k) => k !== "none")) {
      for (const p of [-0.5, -0.2, 0, 0.5, 1, 1.2, 2]) {
        expect(motionTransform(kind, p)!.scale).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("todo movimento sem giro mantém o enquadramento coberto do início ao fim", () => {
    for (const kind of MOTION_KINDS.filter((k) => k !== "none" && !k.startsWith("tilt"))) {
      for (const p of [-0.2, 0, 0.15, 0.3, 0.5, 0.8, 1, 1.2]) {
        const r = applyMotion(rect, motionTransform(kind, p));
        expect(r.x).toBeLessThanOrEqual(1e-9);
        expect(r.x + r.w).toBeGreaterThanOrEqual(rect.w - 1e-9);
        expect(r.y).toBeLessThanOrEqual(1e-9);
        expect(r.y + r.h).toBeGreaterThanOrEqual(rect.h - 1e-9);
      }
    }
  });

  it("deslocamento vertical: para cima sobe, para baixo desce", () => {
    const up = [0, 1].map((p) => applyMotion(rect, motionTransform("panUp", p)).y);
    expect(up[1]!).toBeLessThan(up[0]!);
    const down = [0, 1].map((p) => applyMotion(rect, motionTransform("panDown", p)).y);
    expect(down[1]!).toBeGreaterThan(down[0]!);
  });

  it("impacto entra ampliado e assenta; pulsar vai e volta", () => {
    const punch = [0, 0.1, 0.3].map((p) => motionTransform("punch", p)!.scale);
    expect(punch[0]!).toBeGreaterThan(punch[1]!);
    expect(punch[1]!).toBeGreaterThan(punch[2]!);
    const pulse = [0, 0.5, 1].map((p) => motionTransform("pulse", p)!.scale);
    expect(pulse[0]!).toBeCloseTo(1, 6);
    expect(pulse[1]!).toBeCloseTo(1 + MOTION_ZOOM, 6);
    expect(pulse[2]!).toBeCloseTo(1, 6);
  });

  it("giro: ângulos opostos, e a ampliação cobre o quadro em 16:9 e 9:16 no maior ângulo", () => {
    expect(motionTransform("tiltRight", 0)!.rotation).toBeCloseTo(-MOTION_TILT, 9);
    expect(motionTransform("tiltRight", 1)!.rotation).toBeCloseTo(MOTION_TILT, 9);
    expect(motionTransform("tiltLeft", 1)!.rotation).toBeCloseTo(-MOTION_TILT, 9);
    expect(motionTransform("tiltLeft", 0.5)!.rotation).toBeCloseTo(0, 9);
    for (const kind of ["tiltLeft", "tiltRight"] as const) {
      for (const p of [-0.2, 0, 0.5, 1, 1.2]) {
        const m = motionTransform(kind, p)!;
        const a = Math.abs(m.rotation!);
        // Um retângulo W×H girado de `a` cobre o original se a escala ≥ cos a + (lado maior/menor)·sen a.
        expect(m.scale).toBeGreaterThanOrEqual(Math.cos(a) + (16 / 9) * Math.sin(a));
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

describe("corte da mídia", () => {
  const photo = { width: 4000, height: 3000 };

  it("normaliza para dentro da mídia e trata a mídia inteira como 'sem corte'", () => {
    expect(normalizeCrop(undefined)).toBeUndefined();
    expect(normalizeCrop({ x: 0, y: 0, w: 1, h: 1 })).toBeUndefined();
    expect(normalizeCrop({ x: 0.2, y: 0.3, w: 0.5, h: 0.4 })).toEqual({ x: 0.2, y: 0.3, w: 0.5, h: 0.4 });
    expect(normalizeCrop({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 })).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(normalizeCrop({ x: Number.NaN, y: 0, w: 1, h: 1 })).toBeUndefined();
    expect(isFullCrop({ x: 0, y: 0, w: 0.5, h: 1 })).toBe(false);
  });

  it("o enquadramento passa a valer para a parte cortada", () => {
    const crop = { x: 0.25, y: 0, w: 0.5, h: 1 };
    const shown = croppedSize(photo, crop);
    expect(shown).toEqual({ width: 2000, height: 3000 });
    // 2000×3000 "inteira" num quadro 1080×1920: limitada pela largura.
    const r = fitRect(shown, { width: 1080, height: 1920 }, "fit");
    expect(r.w).toBeCloseTo(1080, 6);
    expect(r.h).toBeCloseTo(1620, 6);
    expect(croppedSize(photo, undefined)).toBe(photo);
  });

  it("foto cortada é decodificada maior, sem passar do original", () => {
    const out = { width: 1080, height: 1920 };
    const full = decodeSize(photo, out);
    const half = decodeSize(photo, cropDecodeTarget(out, { x: 0, y: 0, w: 0.5, h: 0.5 }));
    expect(half.width).toBeGreaterThan(full.width);
    expect(half.width).toBeLessThanOrEqual(photo.width);
    expect(cropDecodeTarget(out, undefined)).toBe(out);
  });

  it("atalho de proporção: o maior corte na proporção pedida, dentro da mídia", () => {
    const c = cropForRatio(photo, 9 / 16);
    expect(c.h).toBeCloseTo(1, 6);
    expect((c.w * photo.width) / (c.h * photo.height)).toBeCloseTo(9 / 16, 6);
    expect(c.x).toBeCloseTo((1 - c.w) / 2, 6);
    const wide = cropForRatio(photo, 16 / 9, { x: 0, y: 0, w: 0.2, h: 0.2 });
    expect(wide.w).toBeCloseTo(1, 6);
    expect(wide.y).toBe(0);
    expect((wide.w * photo.width) / (wide.h * photo.height)).toBeCloseTo(16 / 9, 6);
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
