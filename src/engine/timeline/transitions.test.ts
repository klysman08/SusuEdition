import { describe, expect, it } from "vitest";

import { SFX_KINDS } from "../audio/sfx";
import { segmentFrameRange } from "../export/plan";
import { layersAt } from "../render/schedule";
import { clampTransition } from "./beat-sync";
import { buildTimeline } from "./build-timeline";
import {
  isTransitionKind,
  TRANSITION_CATEGORIES,
  TRANSITION_KINDS,
  transitionIndex,
  TRANSITIONS,
  transitionsIn,
} from "./transitions";
import { DEFAULT_TIMELINE_SETTINGS, type ClipOverrides, type TimelineItem, type TimelineSettings } from "./types";

const photo = (id: string, overrides?: ClipOverrides): TimelineItem => ({
  media: { id, kind: "image", uri: id, name: id, width: 4000, height: 3000, rotation: 0 },
  overrides,
});

const video = (id: string, durationSec: number): TimelineItem => ({
  media: { id, kind: "video", uri: id, name: id, width: 1920, height: 1080, rotation: 0, durationSec, hasAudio: true },
});

const settings = (patch: Partial<TimelineSettings> = {}): TimelineSettings => ({
  ...DEFAULT_TIMELINE_SETTINGS,
  total: { mode: "items" },
  ...patch,
});

const build = (items: TimelineItem[], patch: Partial<TimelineSettings> = {}) =>
  buildTimeline({ items, settings: settings(patch), music: null });

describe("catálogo de transições", () => {
  it("toda transição tem grupo, duração e um som válido", () => {
    for (const kind of TRANSITION_KINDS) {
      const info = TRANSITIONS[kind];
      expect(TRANSITION_CATEGORIES).toContain(info.category);
      expect(info.durationSec).toBeGreaterThan(0);
      expect(SFX_KINDS).toContain(info.sound);
    }
  });

  it("os grupos cobrem todas as transições, sem repetir", () => {
    const all = TRANSITION_CATEGORIES.flatMap(transitionsIn);
    expect([...all].sort()).toEqual([...TRANSITION_KINDS].sort());
  });

  it("o índice do shader segue a ordem do catálogo (fade = 0)", () => {
    expect(transitionIndex("fade")).toBe(0);
    expect(TRANSITION_KINDS.map(transitionIndex)).toEqual(TRANSITION_KINDS.map((_, i) => i));
    expect(isTransitionKind("whipLeft")).toBe(true);
    expect(isTransitionKind("cut")).toBe(false);
  });
});

describe("buildTimeline — transições", () => {
  it("aplica a transição padrão a todas as mídias menos a primeira", () => {
    const res = build([photo("a"), photo("b"), photo("c")], { transition: { kind: "glitch", durationSec: 0.4 } });
    expect(res.segments.map((s) => s.transitionIn.kind)).toEqual(["cut", "glitch", "glitch"]);
    expect(res.segments[1]!.transitionIn).toEqual({ kind: "glitch", durationSec: 0.4 });
  });

  it("no mix, cada mídia entra com a próxima transição da lista", () => {
    const res = build([photo("a"), photo("b"), photo("c"), photo("d"), photo("e")], {
      transition: { kind: "mix", kinds: ["whipLeft", "cut", "flash"], durationSec: 0.3 },
    });
    expect(res.segments.map((s) => s.transitionIn.kind)).toEqual(["cut", "whipLeft", "cut", "flash", "whipLeft"]);
  });

  it("um mix vazio vira corte seco", () => {
    const res = build([photo("a"), photo("b")], { transition: { kind: "mix", kinds: [], durationSec: 0.3 } });
    expect(res.segments[1]!.transitionIn).toEqual({ kind: "cut" });
  });

  it("a mídia com transição própria vence o padrão (e usa a duração natural se o padrão é corte)", () => {
    const res = build([photo("a"), photo("b", { transitionIn: "spin" }), photo("c", { transitionIn: "cut" })], {
      transition: { kind: "cut" },
    });
    expect(res.segments[1]!.transitionIn).toEqual({ kind: "spin", durationSec: TRANSITIONS.spin.durationSec });
    expect(res.segments[2]!.transitionIn).toEqual({ kind: "cut" });

    const withDefault = build([photo("a"), photo("b", { transitionIn: "spin" })], {
      transition: { kind: "fade", durationSec: 0.8 },
    });
    expect(withDefault.segments[1]!.transitionIn).toEqual({ kind: "spin", durationSec: 0.8 });
  });

  it("um fade pode tomar o segmento inteiro; as demais deixam parte da mídia parada", () => {
    expect(clampTransition({ kind: "fade", durationSec: 2 }, 1, 1)).toEqual({ kind: "fade", durationSec: 1 });
    expect(clampTransition({ kind: "whipUp", durationSec: 2 }, 1, 0.5)).toEqual({ kind: "whipUp", durationSec: 0.35 });
    expect(clampTransition({ kind: "cut" }, 1, 1)).toEqual({ kind: "cut" });
  });

  it("a camada que entra carrega a transição; o progresso vai de 0 a 1 centrado no corte", () => {
    const res = build([photo("a"), photo("b")], { transition: { kind: "grid", durationSec: 0.8 } });
    const cut = res.segments[1]!.startSec;
    expect(layersAt(res.segments, cut - 0.5).map((l) => l.transition)).toEqual([undefined]);
    const mid = layersAt(res.segments, cut);
    expect(mid.map((l) => l.transition)).toEqual([undefined, "grid"]);
    expect(mid[1]!.alpha).toBeCloseTo(0.5);
    expect(layersAt(res.segments, cut - 0.2)[1]!.alpha).toBeCloseTo(0.25);
    expect(layersAt(res.segments, cut + 0.2)[1]!.alpha).toBeCloseTo(0.75);
    expect(layersAt(res.segments, cut + 0.5).map((l) => l.transition)).toEqual([undefined]);
  });

  it("a exportação mantém a mídia visível durante toda a transição", () => {
    const res = build([photo("a"), photo("b")], { transition: { kind: "warp", durationSec: 0.4 } });
    // 2 s por foto a 30 fps: a segunda entra 0,2 s (6 quadros) antes do corte.
    expect(segmentFrameRange(res.segments, 1, 30, 120)[0]).toBe(54);
    expect(segmentFrameRange(res.segments, 0, 30, 120)[1]).toBe(65);
  });
});

describe("buildTimeline — efeito sonoro das transições", () => {
  it("sem efeito por padrão", () => {
    const res = build([photo("a"), photo("b")], { transition: { kind: "flash", durationSec: 0.3 } });
    expect(res.segments.every((s) => s.sfx === undefined)).toBe(true);
  });

  it("um som fixo toca em toda troca, inclusive em corte seco — nunca na primeira mídia", () => {
    const res = build([photo("a"), photo("b"), photo("c")], { transitionSound: "shutter" });
    expect(res.segments.map((s) => s.sfx)).toEqual([undefined, "shutter", "shutter"]);
  });

  it("no automático, cada transição toca o som dela e o corte seco fica em silêncio", () => {
    const res = build([photo("a"), photo("b"), photo("c"), photo("d")], {
      transition: { kind: "mix", kinds: ["whipLeft", "cut", "glitch"], durationSec: 0.3 },
      transitionSound: "auto",
    });
    expect(res.segments.map((s) => s.sfx)).toEqual([undefined, "whoosh", undefined, "glitch"]);
  });

  it("a mídia pode ter o próprio som ou nenhum", () => {
    const res = build([photo("a"), photo("b", { soundIn: "pop" }), photo("c", { soundIn: "none" })], {
      transitionSound: "click",
    });
    expect(res.segments.map((s) => s.sfx)).toEqual([undefined, "pop", undefined]);
  });
});

describe("buildTimeline — movimento", () => {
  it("o movimento padrão só vale para vídeos quando pedido", () => {
    const items = [photo("a"), video("v", 10)];
    expect(build(items, { photoMotion: "zoomIn" }).segments.map((s) => s.motion)).toEqual(["zoomIn", undefined]);
    expect(build(items, { photoMotion: "zoomIn", motionOnVideos: true }).segments.map((s) => s.motion)).toEqual([
      "zoomIn",
      "zoomIn",
    ]);
  });

  it("o auto segue a sequência do template quando há uma", () => {
    const res = build([photo("a"), photo("b"), photo("c")], { photoMotion: "auto", motionSet: ["punch", "pulse"] });
    expect(res.segments.map((s) => s.motion)).toEqual(["punch", "pulse", "punch"]);
  });
});
