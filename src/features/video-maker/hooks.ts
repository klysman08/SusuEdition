import { useMemo } from "react";
import { useStore } from "zustand";

import type { TimelineResult } from "@/engine/timeline";

import type { VideoProjectState } from "./project-store";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "./store";
import { computeTimeline } from "./timeline-input";

export function useProject<T>(selector: (s: VideoProjectState) => T): T {
  return useStore(videoProjectStore, selector);
}

/** Timeline atual (recalculada quando mídias, música ou ajustes mudam). */
export function useVideoTimeline(): TimelineResult {
  const order = useStore(videoMediaStore, (s) => s.order);
  const items = useStore(videoMediaStore, (s) => s.items);
  const selection = useStore(videoMusicStore, (s) => (s.status === "ready" ? s.selection : null));
  const settings = useProject((s) => s.timeline);
  const overrides = useProject((s) => s.overrides);
  return useMemo(
    () => computeTimeline(order, items, overrides, settings, selection),
    [order, items, overrides, settings, selection],
  );
}
