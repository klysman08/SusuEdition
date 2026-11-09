import { memo, useRef, type PointerEvent } from "react";
import { useStore } from "zustand";

import type { TimelineResult } from "@/engine/timeline";
import type { Beat } from "@/engine/types";
import { cn } from "@/lib/utils";

import { videoMediaStore } from "../store";

interface Props {
  timeline: TimelineResult;
  timeSec: number;
  onSeek: (t: number) => void;
  /** Batidas da música em tempo de timeline (0 = início do vídeo). */
  beats?: readonly Beat[];
}

/** Marcas das batidas abaixo da faixa; cortes que caem numa batida ganham um marcador. */
const BeatLane = memo(function BeatLane({ beats, timeline }: { beats: readonly Beat[]; timeline: TimelineResult }) {
  const d = Math.max(0.001, timeline.durationSec);
  const times = new Set(beats.map((b) => Math.round(b.timeSec * 1000)));
  const aligned = timeline.segments.slice(1).filter((s) => times.has(Math.round(s.startSec * 1000)));
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5">
        {beats.map((b) => (
          <span
            key={b.timeSec}
            className="absolute bottom-0 w-px bg-muted-foreground/60"
            style={{ left: `${(b.timeSec / d) * 100}%`, height: `${30 + b.strength * 70}%` }}
          />
        ))}
      </div>
      {aligned.map((s) => (
        <span
          key={s.mediaId}
          className="pointer-events-none absolute top-0 h-12 w-0.5 -translate-x-1/2 bg-primary"
          style={{ left: `${(s.startSec / d) * 100}%` }}
        />
      ))}
    </>
  );
});

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
export function TimelineStrip({ timeline, timeSec, onSeek, beats }: Props) {
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
      className={cn(
        "relative cursor-pointer touch-none overflow-hidden rounded-md bg-muted select-none",
        beats && beats.length > 0 ? "h-[60px]" : "h-12",
      )}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e);
      }}
      onPointerMove={(e) => dragging.current && seekAt(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <div className="absolute inset-x-0 top-0 h-12">
        <Segments timeline={timeline} />
      </div>
      {beats && beats.length > 0 && <BeatLane beats={beats} timeline={timeline} />}
      {fade > 0 && d > 0 && (
        <div
          className="pointer-events-none absolute top-0 right-0 h-12 bg-gradient-to-r from-transparent to-black/60"
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
