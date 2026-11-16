import { describe, expect, it } from "vitest";

import { beatPulseAt, withPulse } from "@/engine/render";
import { isTransitionKind, MOTION_KINDS } from "@/engine/timeline";
import { DEFAULT_VIDEO_PROJECT, withDefaults, type VideoProjectSettings } from "@/features/video-maker/project-store";
import en from "@/i18n/locales/en.json";
import ptBR from "@/i18n/locales/pt-BR.json";

import { isTemplateId, TEMPLATE_IDS, TEMPLATE_LIST, TEMPLATES, templateSettings } from "./catalog";
import { buildPreviewScene } from "./preview/preview-renderer";

const SIZES = [
  { width: 640, height: 427 },
  { width: 427, height: 640 },
];

describe("catálogo de templates", () => {
  it("lista todos os templates, cada um com o próprio id", () => {
    expect(TEMPLATE_LIST.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    for (const id of TEMPLATE_IDS) expect(TEMPLATES[id].id).toBe(id);
    expect(isTemplateId("frameShift")).toBe(true);
    expect(isTemplateId("nope")).toBe(false);
  });

  it("os três pedidos estão lá", () => {
    expect(TEMPLATE_IDS).toEqual(expect.arrayContaining(["cinematicBeat", "frameShift", "grid"]));
  });

  it.each(TEMPLATE_LIST)("$id: usa só transições e movimentos que existem", (tpl) => {
    const tr = tpl.timeline.transition;
    if (tr?.kind === "mix") {
      expect(tr.kinds.length).toBeGreaterThan(0);
      for (const k of tr.kinds) expect(k === "cut" || isTransitionKind(k)).toBe(true);
    } else if (tr && tr.kind !== "cut") {
      expect(isTransitionKind(tr.kind)).toBe(true);
    }
    for (const m of tpl.timeline.motionSet ?? []) expect(MOTION_KINDS).toContain(m);
    expect(tpl.effects?.letterbox ?? 0).toBeLessThanOrEqual(0.2);
    expect(tpl.effects?.beatPulse ?? 0).toBeLessThanOrEqual(1);
    expect(tpl.tags.length).toBeGreaterThan(0);
  });

  it.each(TEMPLATE_LIST)("$id: tem nome e descrição nas duas línguas", (tpl) => {
    for (const locale of [ptBR, en]) {
      const entry = locale.templates.items[tpl.id];
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it.each(TEMPLATE_LIST)("$id: monta uma timeline válida sobre mídias de exemplo", (tpl) => {
    const scene = buildPreviewScene(tpl, SIZES);
    expect(scene.segments.length).toBeGreaterThan(3);
    expect(scene.durationSec).toBeGreaterThan(1);
    let cursor = 0;
    for (const seg of scene.segments) {
      expect(seg.startSec).toBeCloseTo(cursor, 5);
      expect(seg.durationSec).toBeGreaterThan(0);
      if (seg.transitionIn.kind !== "cut") {
        expect(seg.transitionIn.durationSec).toBeGreaterThan(0);
        expect(seg.transitionIn.durationSec).toBeLessThanOrEqual(seg.durationSec + 1e-6);
      }
      cursor += seg.durationSec;
    }
    expect(cursor).toBeCloseTo(scene.durationSec, 5);
  });
});

describe("templateSettings", () => {
  const custom: VideoProjectSettings = {
    ...DEFAULT_VIDEO_PROJECT,
    aspect: "1:1",
    overrides: { a: { durationSec: 3, motion: "pulse" } },
    markers: [1.5, 4],
    mix: { ...DEFAULT_VIDEO_PROJECT.mix, musicGain: 0.4, videoGain: 0.6 },
    timeline: { ...DEFAULT_VIDEO_PROJECT.timeline, total: { mode: "custom", seconds: 30 }, keepVideoAudio: true },
    exportQuality: "4k",
  };

  it("num vídeo novo, usa a proporção sugerida e marca o template", () => {
    const s = templateSettings(TEMPLATES.vintage, DEFAULT_VIDEO_PROJECT);
    expect(s.aspect).toBe("4:3");
    expect(s.templateId).toBe("vintage");
    expect(s.filter.preset).toBe("vintage");
    expect(s.timeline.transitionSound).toBe("click");
    expect(s.timeline.beatSync.enabled).toBe(false);
  });

  it("num projeto aberto, mantém o que é escolha de quem edita", () => {
    const s = templateSettings(TEMPLATES.cinematicBeat, custom, custom.aspect);
    expect(s.aspect).toBe("1:1");
    expect(s.overrides).toEqual(custom.overrides);
    expect(s.markers).toEqual([1.5, 4]);
    expect(s.exportQuality).toBe("4k");
    expect(s.mix.musicGain).toBe(0.4);
    expect(s.mix.videoGain).toBe(0.6);
    expect(s.timeline.total).toEqual({ mode: "custom", seconds: 30 });
    expect(s.timeline.keepVideoAudio).toBe(true);
    // ...e o template manda no ritmo, nos efeitos e no filtro.
    expect(s.timeline.beatSync.preset).toBe("accents");
    expect(s.effects).toEqual({ letterbox: 0.09, beatPulse: 0.6 });
    expect(s.filter.preset).toBe("dramatic");
  });

  it("o template que define a duração total vence", () => {
    expect(templateSettings(TEMPLATES.recap, custom).timeline.total).toEqual({ mode: "custom", seconds: 15 });
  });

  it("trocar de template não deixa sobras do anterior", () => {
    const first = templateSettings(TEMPLATES.cinematicBeat, DEFAULT_VIDEO_PROJECT);
    const second = templateSettings(TEMPLATES.memories, first);
    expect(second.effects).toEqual({ letterbox: 0, beatPulse: 0 });
    expect(second.timeline.motionSet).toBeUndefined();
    expect(second.timeline.motionOnVideos).toBe(false);
    expect(second.templateId).toBe("memories");
  });

  it("o resultado sobrevive a salvar e reabrir o projeto", () => {
    for (const tpl of TEMPLATE_LIST) {
      const s = templateSettings(tpl, DEFAULT_VIDEO_PROJECT);
      expect(withDefaults(JSON.parse(JSON.stringify(s)) as Partial<VideoProjectSettings>)).toEqual(s);
    }
  });
});

describe("projetos antigos", () => {
  it("ganham os campos novos com o padrão", () => {
    const old = withDefaults({
      timeline: { ...DEFAULT_VIDEO_PROJECT.timeline, transition: { kind: "fade", durationSec: 0.5 } },
      mix: { musicGain: 0.5, videoGain: 1, duckingGain: 0.35 },
    } as unknown as Partial<VideoProjectSettings>);
    expect(old.effects).toEqual({ letterbox: 0, beatPulse: 0 });
    expect(old.templateId).toBeNull();
    expect(old.mix.sfxGain).toBe(DEFAULT_VIDEO_PROJECT.mix.sfxGain);
    expect(old.timeline.transitionSound).toBe("none");
    expect(old.timeline.transition).toEqual({ kind: "fade", durationSec: 0.5 });
  });
});

describe("pulso na batida", () => {
  const beats = [
    { timeSec: 1, strength: 1 },
    { timeSec: 1.5, strength: 0.4 },
  ];

  it("salta na batida e se desfaz logo depois", () => {
    expect(beatPulseAt(beats, 0.9, 1)).toBe(0);
    const onBeat = beatPulseAt(beats, 1, 1);
    expect(onBeat).toBeGreaterThan(0.05);
    expect(beatPulseAt(beats, 1.2, 1)).toBeLessThan(onBeat / 4);
    // batida mais fraca, pulso menor
    expect(beatPulseAt(beats, 1.5, 1)).toBeLessThan(onBeat);
    expect(beatPulseAt(beats, 1, 0)).toBe(0);
    expect(beatPulseAt([], 1, 1)).toBe(0);
  });

  it("soma ao movimento da mídia sem perder o deslocamento", () => {
    expect(withPulse(null, 0)).toBeNull();
    expect(withPulse(null, 0.1)).toEqual({ scale: 1.1, dx: 0, dy: 0 });
    expect(withPulse({ scale: 1.2, dx: 0.05, dy: 0 }, 0.1)).toEqual({ scale: 1.2 * 1.1, dx: 0.05, dy: 0 });
  });
});
