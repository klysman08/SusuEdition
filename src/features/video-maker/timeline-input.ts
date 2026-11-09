import {
  buildTimeline,
  type ClipOverrides,
  type TimelineItem,
  type TimelineResult,
  type TimelineSettings,
} from "@/engine/timeline";
import type { LibraryItem } from "@/features/media-library";
import type { Selection } from "@/engine/audio";

/** Mídias prontas e decodificáveis, na ordem da biblioteca. */
export function timelineItems(
  order: readonly string[],
  items: Readonly<Record<string, LibraryItem>>,
  overrides: Readonly<Record<string, ClipOverrides>>,
): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const id of order) {
    const it = items[id];
    const meta = it?.meta;
    if (!it || it.status !== "ready" || !meta || meta.decodable === false) continue;
    out.push({
      media: {
        id,
        kind: it.kind,
        uri: id,
        name: it.name,
        width: meta.width,
        height: meta.height,
        rotation: meta.rotation,
        durationSec: meta.durationSec,
        hasAudio: meta.hasAudio,
        capturedAt: meta.capturedAt,
      },
      overrides: overrides[id],
    });
  }
  return out;
}

export function computeTimeline(
  order: readonly string[],
  items: Readonly<Record<string, LibraryItem>>,
  overrides: Readonly<Record<string, ClipOverrides>>,
  settings: TimelineSettings,
  music: Selection | null,
): TimelineResult {
  const effective: TimelineSettings =
    settings.total.mode === "music" && !music ? { ...settings, total: { mode: "items" } } : settings;
  return buildTimeline({ items: timelineItems(order, items, overrides), settings: effective, music });
}
