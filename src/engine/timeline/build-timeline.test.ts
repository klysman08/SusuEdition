import { describe, expect, it } from "vitest";

import type { MediaItem } from "../types";
import { buildTimeline } from "./build-timeline";
import { DEFAULT_TIMELINE_SETTINGS, type TimelineItem, type TimelineSettings } from "./types";

const photo = (id: string): TimelineItem => ({
  media: { id, kind: "image", uri: `susu://media/${id}`, name: id, width: 4000, height: 3000, rotation: 0 },
});

const video = (id: string, durationSec: number, extra: Partial<MediaItem> = {}): TimelineItem => ({
  media: {
    id,
    kind: "video",
    uri: `susu://media/${id}`,
    name: id,
    width: 1920,
    height: 1080,
    rotation: 0,
    durationSec,
    hasAudio: true,
    ...extra,
  },
});

const settings = (patch: Partial<TimelineSettings> = {}): TimelineSettings => ({
  ...DEFAULT_TIMELINE_SETTINGS,
  ...patch,
});

describe("buildTimeline — durações base", () => {
  it("usa 2s por foto e 5s por vídeo por padrão", () => {
    const res = buildTimeline({
      items: [photo("a"), video("b", 20), photo("c")],
      settings: settings({ total: { mode: "items" } }),
      music: null,
    });
    expect(res.segments.map((s) => [s.mediaId, s.startSec, s.durationSec])).toEqual([
      ["a", 0, 2],
      ["b", 2, 5],
      ["c", 7, 2],
    ]);
    expect(res.durationSec).toBe(9);
  });

  it("usa a duração total do vídeo quando ele é menor que o tempo configurado", () => {
    const res = buildTimeline({
      items: [video("v", 3.2)],
      settings: settings({ total: { mode: "items" } }),
      music: null,
    });
    expect(res.segments[0]).toMatchObject({ durationSec: 3.2, sourceInSec: 0, sourceOutSec: 3.2 });
  });

  it("respeita overrides de duração e ponto de início", () => {
    const item = { ...video("v", 10), overrides: { sourceInSec: 4, durationSec: 8 } };
    const res = buildTimeline({
      items: [item, { ...photo("p"), overrides: { durationSec: 1 } }],
      settings: settings({ total: { mode: "items" } }),
      music: null,
    });
    expect(res.segments[0]).toMatchObject({ durationSec: 6, sourceInSec: 4, sourceOutSec: 10 });
    expect(res.segments[1]).toMatchObject({ startSec: 6, durationSec: 1 });
  });
});

describe("buildTimeline — música", () => {
  it("corta a música no fim do conteúdo com fade-out de 3s quando faltam mídias", () => {
    const res = buildTimeline({
      items: [photo("a"), photo("b"), photo("c")],
      settings: settings(),
      music: { inSec: 30, outSec: 90 },
    });
    expect(res.durationSec).toBe(6);
    expect(res.audio).toEqual({ musicInSec: 30, musicOutSec: 36, fadeOutSec: 3 });
    expect(res.warnings).toContainEqual({ kind: "contentShorterThanMusic", contentSec: 6, musicSec: 60 });
  });

  it("limita o fade-out à duração do vídeo quando ele é menor que 3s", () => {
    const res = buildTimeline({ items: [photo("a")], settings: settings(), music: { inSec: 0, outSec: 60 } });
    expect(res.audio?.fadeOutSec).toBe(2);
  });

  it("não aplica fade quando o conteúdo cobre toda a seleção", () => {
    const items = Array.from({ length: 5 }, (_, i) => photo(`p${i}`));
    const res = buildTimeline({ items, settings: settings(), music: { inSec: 10, outSec: 20 } });
    expect(res.durationSec).toBe(10);
    expect(res.audio).toEqual({ musicInSec: 10, musicOutSec: 20, fadeOutSec: 0 });
    expect(res.warnings).toEqual([]);
  });
});

describe("buildTimeline — tolerância da música", () => {
  it("diferenças de poucos ms entre vídeo e trecho não cortam a música nem geram aviso", () => {
    const items = Array.from({ length: 5 }, (_, i) => photo(`p${i}`));
    const res = buildTimeline({
      items,
      settings: settings({ total: { mode: "items" } }),
      music: { inSec: 4.992, outSec: 15.004 },
    });
    expect(res.audio?.fadeOutSec).toBe(0);
    expect(res.warnings).toEqual([]);
  });
});

describe("buildTimeline — excesso de mídia", () => {
  const many = Array.from({ length: 10 }, (_, i) => photo(`p${i}`)); // 20s de conteúdo

  it("drop: exclui os itens que não cabem e avisa", () => {
    const res = buildTimeline({
      items: many,
      settings: settings({ total: { mode: "custom", seconds: 7 } }),
      music: null,
    });
    expect(res.durationSec).toBe(7);
    expect(res.segments).toHaveLength(4);
    expect(res.segments.at(-1)?.durationSec).toBe(1);
    expect(res.warnings).toContainEqual({ kind: "itemsDropped", mediaIds: ["p4", "p5", "p6", "p7", "p8", "p9"] });
  });

  it("fit: reduz proporcionalmente para caber", () => {
    const res = buildTimeline({
      items: many,
      settings: settings({ total: { mode: "custom", seconds: 10 }, overflow: "fit" }),
      music: null,
    });
    expect(res.segments).toHaveLength(10);
    expect(res.segments.every((s) => s.durationSec === 1)).toBe(true);
    expect(res.durationSec).toBe(10);
  });

  it("fit: respeita a duração mínima e descarta o que não cabe nem no mínimo", () => {
    const res = buildTimeline({
      items: many,
      settings: settings({ total: { mode: "custom", seconds: 2 }, overflow: "fit" }),
      music: null,
    });
    expect(res.segments).toHaveLength(4);
    expect(res.durationSec).toBe(2);
    expect(res.warnings[0]).toMatchObject({ kind: "itemsDropped" });
  });

  it("lida com 150 mídias para um vídeo de 1 minuto", () => {
    const items = Array.from({ length: 150 }, (_, i) => (i % 3 === 0 ? video(`v${i}`, 12) : photo(`p${i}`)));
    const res = buildTimeline({ items, settings: settings(), music: { inSec: 0, outSec: 60 } });
    expect(res.durationSec).toBe(60);
    expect(res.audio?.fadeOutSec).toBe(0);
    const last = res.segments.at(-1)!;
    expect(last.startSec + last.durationSec).toBeCloseTo(60, 6);
  });
});

describe("buildTimeline — áudio dos vídeos e transições", () => {
  it("mantém o áudio do vídeo apenas quando habilitado e o vídeo possui áudio", () => {
    const items = [
      video("a", 10),
      video("b", 10, { hasAudio: false }),
      { ...video("c", 10), overrides: { keepAudio: false } },
    ];
    const res = buildTimeline({
      items,
      settings: settings({ total: { mode: "items" }, keepVideoAudio: true }),
      music: null,
    });
    expect(res.segments.map((s) => s.keepAudio)).toEqual([true, false, false]);
  });

  it("primeiro segmento é sempre corte; fade é limitado pela duração dos vizinhos", () => {
    const res = buildTimeline({
      items: [photo("a"), { ...photo("b"), overrides: { durationSec: 0.5 } }],
      settings: settings({ total: { mode: "items" }, transition: { kind: "fade", durationSec: 1 } }),
      music: null,
    });
    expect(res.segments[0]?.transitionIn).toEqual({ kind: "cut" });
    expect(res.segments[1]?.transitionIn).toEqual({ kind: "fade", durationSec: 0.5 });
  });
});

describe("buildTimeline — durações manuais", () => {
  it("fit: quem tem duração manual não encolhe; os demais dividem o que sobra", () => {
    const items = [{ ...photo("a"), overrides: { durationSec: 4 } }, photo("b"), photo("c"), photo("d")];
    const res = buildTimeline({
      items,
      settings: settings({ total: { mode: "custom", seconds: 7 }, overflow: "fit" }),
      music: null,
    });
    expect(res.segments.map((s) => s.durationSec)).toEqual([4, 1, 1, 1]);
    expect(res.durationSec).toBe(7);
  });

  it("fit: se as durações manuais não cabem, o excesso sai pelo fim", () => {
    const items = [
      { ...photo("a"), overrides: { durationSec: 4 } },
      { ...photo("b"), overrides: { durationSec: 4 } },
      photo("c"),
    ];
    const res = buildTimeline({
      items,
      settings: settings({ total: { mode: "custom", seconds: 6 }, overflow: "fit" }),
      music: null,
    });
    expect(res.durationSec).toBe(6);
    expect(res.segments.map((s) => [s.mediaId, s.durationSec])).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
    expect(res.warnings).toContainEqual({ kind: "itemsDropped", mediaIds: ["c"] });
  });
});

describe("buildTimeline — transição, movimento e filtro por mídia", () => {
  it("a transição de entrada de uma mídia vence a do vídeo", () => {
    const items = [
      photo("a"),
      { ...photo("b"), overrides: { transitionIn: "fade" as const } },
      photo("c"),
      { ...photo("d"), overrides: { transitionIn: "cut" as const } },
    ];
    const cut = buildTimeline({ items, settings: settings({ total: { mode: "items" } }), music: null });
    expect(cut.segments.map((s) => s.transitionIn.kind)).toEqual(["cut", "fade", "cut", "cut"]);
    expect(cut.segments[1]!.transitionIn).toEqual({ kind: "fade", durationSec: 0.5 });

    const fade = buildTimeline({
      items,
      settings: settings({ total: { mode: "items" }, transition: { kind: "fade", durationSec: 1 } }),
      music: null,
    });
    expect(fade.segments.map((s) => s.transitionIn.kind)).toEqual(["cut", "fade", "fade", "cut"]);
    expect(fade.segments[1]!.transitionIn).toEqual({ kind: "fade", durationSec: 1 });
  });

  it("a transição por mídia sobrevive à sincronia com as batidas", () => {
    const beats = Array.from({ length: 80 }, (_, i) => ({ timeSec: i * 0.5, strength: i % 4 === 0 ? 1 : 0.4 }));
    const items = [photo("a"), { ...photo("b"), overrides: { transitionIn: "fade" as const } }, photo("c"), photo("d")];
    const res = buildTimeline({ items, settings: settings(), music: { inSec: 0, outSec: 8 }, beats });
    expect(res.beatSync).toBeDefined();
    expect(res.segments.map((s) => s.transitionIn.kind)).toEqual(["cut", "fade", "cut", "cut"]);
  });

  it("movimento das fotos: padrão do vídeo, 'auto' alternado e o da própria mídia", () => {
    const items = [photo("a"), video("v", 10), photo("b"), { ...photo("c"), overrides: { motion: "none" as const } }];
    const base = { total: { mode: "items" as const } };
    const none = buildTimeline({ items, settings: settings(base), music: null });
    expect(none.segments.map((s) => s.motion)).toEqual([undefined, undefined, undefined, undefined]);

    const zoom = buildTimeline({ items, settings: settings({ ...base, photoMotion: "zoomIn" }), music: null });
    expect(zoom.segments.map((s) => s.motion)).toEqual(["zoomIn", undefined, "zoomIn", undefined]);

    const auto = buildTimeline({ items, settings: settings({ ...base, photoMotion: "auto" }), music: null });
    expect(auto.segments.map((s) => s.motion)).toEqual(["zoomIn", undefined, "zoomOut", undefined]);

    const own = buildTimeline({
      items: [{ ...video("v", 10), overrides: { motion: "panLeft" as const } }],
      settings: settings(base),
      music: null,
    });
    expect(own.segments[0]!.motion).toBe("panLeft");
  });

  it("o filtro da mídia vai para o segmento (e 'none' não vai)", () => {
    const items = [
      { ...photo("a"), overrides: { look: { preset: "noir" as const, intensity: 0.8 } } },
      { ...photo("b"), overrides: { look: { preset: "none" as const, intensity: 1 } } },
    ];
    const res = buildTimeline({ items, settings: settings({ total: { mode: "items" } }), music: null });
    expect(res.segments[0]!.look).toEqual({ preset: "noir", intensity: 0.8 });
    expect(res.segments[1]!.look).toBeUndefined();
  });
});
