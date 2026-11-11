import { describe, expect, it } from "vitest";

import { buildTimeline, DEFAULT_TIMELINE_SETTINGS, type TimelineItem, type TimelineResult } from "@/engine/timeline";

import { splitOverrides, splittableAt } from "./clip-actions";
import { createVideoProjectStore } from "./project-store";

const photo = (id: string): TimelineItem => ({
  media: { id, kind: "image", uri: id, name: id, width: 4000, height: 3000, rotation: 0 },
});
const video = (id: string, durationSec: number): TimelineItem => ({
  media: { id, kind: "video", uri: id, name: id, width: 1920, height: 1080, rotation: 0, durationSec, hasAudio: true },
});
const settings = { ...DEFAULT_TIMELINE_SETTINGS, total: { mode: "items" as const } };
const build = (items: TimelineItem[]): TimelineResult => buildTimeline({ items, settings, music: null });

describe("splittableAt", () => {
  const timeline = build([photo("a"), video("v", 20)]); // a: 0–2, v: 2–7

  it("acha a mídia sob o cursor quando as duas partes têm o tamanho mínimo", () => {
    expect(splittableAt(timeline, 4.5, 0.5)?.mediaId).toBe("v");
    expect(splittableAt(timeline, 1, 0.5)?.mediaId).toBe("a");
  });

  it("recusa cortes colados nas bordas", () => {
    expect(splittableAt(timeline, 2.2, 0.5)).toBeNull();
    expect(splittableAt(timeline, 6.8, 0.5)).toBeNull();
    expect(splittableAt(timeline, 0, 0.5)).toBeNull();
  });
});

describe("splitOverrides", () => {
  it("vídeo: a segunda parte continua de onde a primeira parou e o vídeo final não muda", () => {
    const base = { ...video("v", 20), overrides: { sourceInSec: 3, gain: 0.5 } };
    const before = build([photo("a"), base, photo("z")]);
    const seg = before.segments[1]!;
    const [first, second] = splitOverrides(seg, base.overrides, 1.8);

    expect(first).toEqual({ sourceInSec: 3, gain: 0.5, durationSec: 1.8 });
    expect(second).toEqual({ sourceInSec: 4.8, gain: 0.5, durationSec: 3.2, transitionIn: "cut" });

    const after = build([
      photo("a"),
      { ...base, overrides: first },
      { media: { ...base.media, id: "v~2" }, overrides: second },
      photo("z"),
    ]);
    expect(after.durationSec).toBe(before.durationSec);
    const [p1, p2] = [after.segments[1]!, after.segments[2]!];
    expect(p1.sourceOutSec).toBe(p2.sourceInSec);
    expect(p2.startSec).toBe(seg.startSec + 1.8);
    expect(p2.sourceOutSec).toBe(seg.sourceOutSec);
    expect(after.segments[3]!.startSec).toBe(before.segments[2]!.startSec);
  });

  it("foto: duas partes com a soma da duração original, sem ponto de início", () => {
    const before = build([photo("a")]);
    const [first, second] = splitOverrides(before.segments[0]!, { fit: "cover" }, 0.7);
    expect(first).toEqual({ fit: "cover", durationSec: 0.7 });
    expect(second).toEqual({ fit: "cover", durationSec: 1.3, transitionIn: "cut" });
  });
});

describe("ajustes do projeto: marcadores e mídia religada", () => {
  it("toggleMarker põe em ordem e tira o marcador vizinho", () => {
    const store = createVideoProjectStore();
    store.getState().toggleMarker(12.3456);
    store.getState().toggleMarker(4);
    expect(store.getState().markers).toEqual([4, 12.346]);
    store.getState().toggleMarker(12.4); // a menos de 0,12 s: remove
    expect(store.getState().markers).toEqual([4]);
    store.getState().clearMarkers();
    expect(store.getState().markers).toEqual([]);
  });

  it("moveOverride leva os ajustes para o id novo; setOverride(null) remove", () => {
    const store = createVideoProjectStore();
    store.getState().setOverride("old", { durationSec: 3, fit: undefined });
    expect(store.getState().overrides).toEqual({ old: { durationSec: 3 } });
    store.getState().moveOverride("old", "new");
    expect(store.getState().overrides).toEqual({ new: { durationSec: 3 } });
    store.getState().setOverride("new", null);
    expect(store.getState().overrides).toEqual({});
  });
});
