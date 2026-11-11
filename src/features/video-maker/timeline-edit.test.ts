import { describe, expect, it } from "vitest";

import type { TimelineSegment } from "@/engine/timeline";

import {
  durationForEnd,
  durationLimits,
  nearestBoundary,
  reorderForBoundary,
  snapTime,
  tickStep,
} from "./timeline-edit";

const seg = (id: string, start: number, dur: number, kind: "image" | "video" = "image"): TimelineSegment => ({
  mediaId: id,
  kind,
  startSec: start,
  durationSec: dur,
  sourceInSec: 0,
  sourceOutSec: dur,
  transitionIn: { kind: "cut" },
  keepAudio: false,
  gain: 1,
});

const abc = [seg("a", 0, 2), seg("b", 2, 2), seg("c", 4, 2)];

describe("snapTime", () => {
  const beats = [0.5, 1, 1.5, 2];

  it("gruda no ponto mais próximo dentro do limite", () => {
    expect(snapTime(1.04, beats, 0.1)).toEqual({ time: 1, snapped: true });
    expect(snapTime(1.46, beats, 0.1)).toEqual({ time: 1.5, snapped: true });
  });

  it("fica onde está quando não há ponto por perto", () => {
    expect(snapTime(1.25, beats, 0.1)).toEqual({ time: 1.25, snapped: false });
    expect(snapTime(3, beats, 0.1)).toEqual({ time: 3, snapped: false });
    expect(snapTime(1, [], 0.1)).toEqual({ time: 1, snapped: false });
  });
});

describe("durationForEnd / durationLimits", () => {
  it("fotos: do início do segmento até o ponto solto, respeitando o mínimo", () => {
    const limits = durationLimits(abc[1]!, undefined, 0.5);
    expect(durationForEnd(abc[1]!, 5.234, limits)).toBe(3.23);
    expect(durationForEnd(abc[1]!, 2.1, limits)).toBe(0.5);
  });

  it("vídeos não passam do que resta do arquivo depois do ponto de início", () => {
    const video = { ...seg("v", 10, 3, "video"), sourceInSec: 4 };
    const limits = durationLimits(video, 9, 0.5);
    expect(limits.maxSec).toBe(5);
    expect(durationForEnd(video, 30, limits)).toBe(5);
  });
});

describe("nearestBoundary", () => {
  it("escolhe o corte mais próximo, incluindo o começo e o fim", () => {
    expect(nearestBoundary(abc, 0.3)).toBe(0);
    expect(nearestBoundary(abc, 2.2)).toBe(1);
    expect(nearestBoundary(abc, 3.4)).toBe(2);
    expect(nearestBoundary(abc, 5.9)).toBe(3);
  });
});

describe("reorderForBoundary", () => {
  const order = ["a", "b", "c"];

  it("move para antes do segmento do corte", () => {
    expect(reorderForBoundary(order, abc, "c", 0)).toEqual(["c", "a", "b"]);
    expect(reorderForBoundary(order, abc, "a", 2)).toEqual(["b", "a", "c"]);
  });

  it("corte depois do último: vai para o fim", () => {
    expect(reorderForBoundary(order, abc, "a", 3)).toEqual(["b", "c", "a"]);
  });

  it("soltar nas próprias bordas não muda nada", () => {
    expect(reorderForBoundary(order, abc, "b", 1)).toBeNull();
    expect(reorderForBoundary(order, abc, "b", 2)).toBeNull();
    expect(reorderForBoundary(order, abc, "c", 3)).toBeNull();
  });

  it("mídias fora da timeline (sem tempo, ausentes) mantêm o lugar", () => {
    // "x" está na biblioteca mas não entrou no vídeo.
    expect(reorderForBoundary(["a", "x", "b", "c"], abc, "c", 1)).toEqual(["a", "x", "c", "b"]);
  });
});

describe("tickStep", () => {
  it("mantém as marcas da régua legíveis em qualquer zoom", () => {
    expect(tickStep(10)).toBe(10); // 10 px/s → uma marca a cada 10 s (100 px)
    expect(tickStep(64)).toBe(1);
    expect(tickStep(400)).toBe(0.25);
    expect(tickStep(0.01)).toBe(600);
  });
});
