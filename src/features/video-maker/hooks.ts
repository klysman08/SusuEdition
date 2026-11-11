import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";

import { analyzeRhythm, mergeMarkers, type RhythmBeat, type TimelineResult } from "@/engine/timeline";
import { getMediaBackend } from "@/platform/media";

import type { VideoProjectState } from "./project-store";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "./store";
import { computeTimeline } from "./timeline-input";

const NO_BEATS: readonly RhythmBeat[] = [];

export function useProject<T>(selector: (s: VideoProjectState) => T): T {
  return useStore(videoProjectStore, selector);
}

/** URL reproduzível do arquivo original de uma mídia (`null` enquanto resolve). */
export function useMediaUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) return;
    void getMediaBackend().then((b) => alive && setUrl(b.mediaUrl(id)));
    return () => {
      alive = false;
      setUrl(null);
    };
  }, [id]);
  return url;
}

/**
 * Batidas da música (tempo do arquivo) com energia, compassos e mudanças de seção.
 * Recalculado só quando a análise da faixa muda.
 */
export function useRhythm(): readonly RhythmBeat[] {
  const analysis = useStore(videoMusicStore, (s) => s.analysis);
  const markers = useProject((s) => s.markers);
  const detected = useMemo(
    () =>
      analysis && analysis.beats.length > 0
        ? analyzeRhythm(analysis.beats, { peaks: analysis.peaks, durationSec: analysis.durationSec })
        : NO_BEATS,
    [analysis],
  );
  // Marcadores manuais entram como as batidas mais fortes (e valem mesmo sem batidas detectadas).
  return useMemo(
    () => (analysis && markers.length > 0 ? mergeMarkers(detected, markers) : detected),
    [analysis, detected, markers],
  );
}

/** Timeline atual (recalculada quando mídias, música ou ajustes mudam). */
export function useVideoTimeline(): TimelineResult {
  const order = useStore(videoMediaStore, (s) => s.order);
  const items = useStore(videoMediaStore, (s) => s.items);
  const selection = useStore(videoMusicStore, (s) => (s.status === "ready" ? s.selection : null));
  const beats = useRhythm();
  const settings = useProject((s) => s.timeline);
  const overrides = useProject((s) => s.overrides);
  return useMemo(
    () => computeTimeline(order, items, overrides, settings, selection, beats),
    [order, items, overrides, settings, selection, beats],
  );
}
