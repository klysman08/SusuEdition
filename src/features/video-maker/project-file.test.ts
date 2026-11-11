import { describe, expect, it } from "vitest";

import {
  parseProjectFile,
  parseSummary,
  PROJECT_VERSION,
  projectFingerprint,
  remapOverrides,
  type VideoProjectFile,
} from "./project-file";
import { DEFAULT_VIDEO_PROJECT, pickSettings, withDefaults } from "./project-store";

const file = (patch: Partial<VideoProjectFile> = {}): VideoProjectFile => ({
  version: PROJECT_VERSION,
  summary: {
    kind: "video",
    name: "Praia",
    createdAt: 1000,
    updatedAt: 2000,
    mediaCount: 2,
    durationSec: 7,
    aspect: "9:16",
    coverId: "aaa",
  },
  media: [
    { id: "aaa", uri: "C:\\fotos\\a.jpg", name: "a.jpg", kind: "image", size: 10, modifiedMs: 5 },
    { id: "bbb", uri: "D:\\videos\\b.mp4", name: "b.mp4", kind: "video", size: 20 },
  ],
  music: {
    id: "mmm",
    uri: "C:\\musicas\\m.mp3",
    name: "m.mp3",
    size: 30,
    selection: { inSec: 12, outSec: 42 },
    snapToBeats: false,
  },
  settings: {
    ...DEFAULT_VIDEO_PROJECT,
    aspect: "16:9",
    overrides: { bbb: { sourceInSec: 3, durationSec: 4.5 } },
    filter: { preset: "warm", intensity: 0.6, adjust: { ...DEFAULT_VIDEO_PROJECT.filter.adjust, contrast: 0.2 } },
  },
  ...patch,
});

describe("parseProjectFile", () => {
  it("lê de volta exatamente o que foi gravado (caminhos, música, ajustes)", () => {
    const original = file();
    expect(parseProjectFile(JSON.stringify(original))).toEqual(original);
  });

  it("guarda trechos extras de um arquivo dividido e os marcadores da música", () => {
    const original = file({
      media: [
        { id: "bbb", uri: "D:\\videos\\b.mp4", name: "b.mp4", kind: "video", size: 20 },
        { id: "bbb~k1", sourceId: "bbb", uri: "D:\\videos\\b.mp4", name: "b.mp4", kind: "video", size: 20 },
      ],
      settings: { ...DEFAULT_VIDEO_PROJECT, markers: [4.5, 12] },
    });
    const parsed = parseProjectFile(JSON.stringify(original))!;
    expect(parsed.media[1]).toMatchObject({ id: "bbb~k1", sourceId: "bbb" });
    expect(parsed.media[0]!.sourceId).toBeUndefined();
    expect(parsed.settings.markers).toEqual([4.5, 12]);
  });

  it("completa campos ausentes com o padrão atual", () => {
    const old = { version: 1, summary: { kind: "video", name: "Antigo" }, media: [], settings: { aspect: "1:1" } };
    const parsed = parseProjectFile(JSON.stringify(old))!;
    expect(parsed.settings.aspect).toBe("1:1");
    expect(parsed.settings.timeline).toEqual(DEFAULT_VIDEO_PROJECT.timeline);
    expect(parsed.settings.filter).toEqual(DEFAULT_VIDEO_PROJECT.filter);
    expect(parsed.music).toBeNull();
    expect(parsed.summary.aspect).toBe("9:16");
  });

  it("ignora mídias inválidas e trechos de música impossíveis", () => {
    const raw = file();
    const json = JSON.stringify({
      ...raw,
      media: [...raw.media, { id: "ccc" }, { id: "ddd", uri: "x", kind: "audio" }, null],
      music: { ...raw.music, selection: { inSec: 9, outSec: 3 } },
    });
    const parsed = parseProjectFile(json)!;
    expect(parsed.media.map((m) => m.id)).toEqual(["aaa", "bbb"]);
    expect(parsed.music?.selection).toBeNull();
  });

  it("recusa o que não é projeto ou vem de uma versão futura", () => {
    expect(parseProjectFile("não é json")).toBeNull();
    expect(parseProjectFile("[]")).toBeNull();
    expect(parseProjectFile(JSON.stringify({ version: 1, media: [] }))).toBeNull();
    expect(parseProjectFile(JSON.stringify({ ...file(), version: PROJECT_VERSION + 1 }))).toBeNull();
  });
});

describe("parseSummary", () => {
  it("só aceita resumos de projetos de vídeo", () => {
    expect(parseSummary(null)).toBeNull();
    expect(parseSummary({ kind: "collage" })).toBeNull();
    expect(parseSummary({ kind: "video", name: "X", mediaCount: 3 })).toMatchObject({ name: "X", mediaCount: 3 });
  });
});

describe("remapOverrides", () => {
  it("leva os ajustes para o id novo de um arquivo que mudou", () => {
    const out = remapOverrides({ old: { durationSec: 2 }, same: { fit: "cover" } }, new Map([["old", "new"]]));
    expect(out).toEqual({ new: { durationSec: 2 }, same: { fit: "cover" } });
  });
});

describe("projectFingerprint", () => {
  it("ignora a data e a duração calculada; muda com qualquer edição", () => {
    const a = file();
    const later = file({ summary: { ...a.summary, updatedAt: 9999, durationSec: 8 } });
    expect(projectFingerprint(later)).toBe(projectFingerprint(a));
    const edited = file({ settings: { ...a.settings, fit: "cover" } });
    expect(projectFingerprint(edited)).not.toBe(projectFingerprint(a));
    const renamed = file({ summary: { ...a.summary, name: "Serra" } });
    expect(projectFingerprint(renamed)).not.toBe(projectFingerprint(a));
  });
});

describe("pickSettings / withDefaults", () => {
  it("separa os dados das ações do store", () => {
    const state = { ...DEFAULT_VIDEO_PROJECT, setAspect: () => {} };
    expect(pickSettings(state)).toEqual(DEFAULT_VIDEO_PROJECT);
  });

  it("mescla configurações parciais de sincronia e filtro", () => {
    const s = withDefaults({
      timeline: { ...DEFAULT_VIDEO_PROJECT.timeline, beatSync: { enabled: false } as never },
      filter: { preset: "noir" } as never,
    });
    expect(s.timeline.beatSync).toEqual({ ...DEFAULT_VIDEO_PROJECT.timeline.beatSync, enabled: false });
    expect(s.filter).toEqual({ ...DEFAULT_VIDEO_PROJECT.filter, preset: "noir" });
  });
});
