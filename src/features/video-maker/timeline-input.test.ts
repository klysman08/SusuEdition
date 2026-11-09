import { describe, expect, it } from "vitest";

import { DEFAULT_TIMELINE_SETTINGS } from "@/engine/timeline";
import type { LibraryItem } from "@/features/media-library";

import { createVideoProjectStore } from "./project-store";
import { computeTimeline, timelineItems } from "./timeline-input";

const photo = (id: string, patch: Partial<LibraryItem> = {}): LibraryItem => ({
  id,
  kind: "image",
  name: id,
  size: 1,
  status: "ready",
  meta: { kind: "image", width: 100, height: 100, rotation: 0, thumbExt: "jpg" },
  ...patch,
});

describe("timelineItems", () => {
  it("ignora pendentes, com erro e vídeos não decodificáveis", () => {
    const items = {
      a: photo("a"),
      b: photo("b", { status: "pending" }),
      c: photo("c", { status: "error" }),
      d: photo("d", {
        kind: "video",
        meta: { kind: "video", width: 1, height: 1, rotation: 0, thumbExt: "webp", decodable: false, durationSec: 5 },
      }),
    };
    expect(timelineItems(["a", "b", "c", "d"], items, {}).map((i) => i.media.id)).toEqual(["a"]);
  });
});

describe("computeTimeline", () => {
  it("sem música, 'ajustar à música' usa a soma das mídias", () => {
    const items = { a: photo("a"), b: photo("b") };
    const res = computeTimeline(["a", "b"], items, {}, DEFAULT_TIMELINE_SETTINGS, null);
    expect(res.durationSec).toBe(4);
    expect(res.audio).toBeNull();
  });

  it("aplica overrides por item", () => {
    const items = { a: photo("a"), b: photo("b") };
    const res = computeTimeline(["a", "b"], items, { a: { durationSec: 5 } }, DEFAULT_TIMELINE_SETTINGS, null);
    expect(res.segments.map((s) => s.durationSec)).toEqual([5, 2]);
  });
});

describe("project store", () => {
  it("overrides vazios são removidos", () => {
    const store = createVideoProjectStore();
    store.getState().patchOverride("a", { durationSec: 3 });
    expect(store.getState().overrides).toEqual({ a: { durationSec: 3 } });
    store.getState().patchOverride("a", { durationSec: undefined });
    expect(store.getState().overrides).toEqual({});
  });
});
