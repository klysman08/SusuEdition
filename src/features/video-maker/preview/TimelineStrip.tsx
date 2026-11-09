import { memo, useRef, type PointerEvent } from "react";
import { useStore } from "zustand";

import type { TimelineResult } from "@/engine/timeline";
import { cn } from "@/lib/utils";

import { videoMediaStore } from "../store";

interface Props {
  timeline: TimelineResult;
  timeSec: number;
  onSeek: (t: number) => void;
  onOpenItem?: (id: string) => void;
}

const Segments = memo(function Segments({ timeline }: { timeline: TimelineResult }) {
  const items = useStore(videoMediaStore, (s) => s.items);
  const d = Math.max(0.001, timeline.durationSec);
  return (
    <>
      {timeline.segments.map((seg) => {
        const thumb = items[seg.mediaId]?.thumbUrl;
        return (
          <div
            key={seg.mediaId}
            className="absolute inset-y-0 overflow-hidden border-r border-background/80 bg-muted"
            style={{ left: `${(seg.startSec / d) * 100}%`, width: `${(seg.durationSec / d) * 100}%` }}
          >
            {thumb && <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url("${thumb}")` }} />}
            {seg.transitionIn.kind === "fade" && (
              <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-background/80 to-transparent" />
            )}
            {seg.keepAudio && <span className="absolute right-0.5 bottom-0.5 size-1.5 rounded-full bg-emerald-400" />}
          </div>
        );
      })}
    </>
  );
});

/** Faixa com as mídias proporcionais à duração; tocar/arrastar posiciona a reprodução. */
export function TimelineStrip({ timeline, timeSec, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const d = timeline.durationSec;
  const fade = timeline.audio?.fadeOutSec ?? 0;

  const seekAt = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || d <= 0) return;
    onSeek(Math.min(d, Math.max(0, ((e.clientX - r.left) / r.width) * d)));
  };

  return (
    <div
      ref={ref}
      className="relative h-12 cursor-pointer touch-none overflow-hidden rounded-md bg-muted select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e);
      }}
      onPointerMove={(e) => dragging.current && seekAt(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <Segments timeline={timeline} />
      {fade > 0 && d > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-r from-transparent to-black/60"
          style={{ width: `${(fade / d) * 100}%` }}
        />
      )}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]",
        )}
        style={{ left: `${d > 0 ? (timeSec / d) * 100 : 0}%` }}
      />
    </div>
  );
}
