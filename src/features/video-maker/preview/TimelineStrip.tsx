import { memo, useRef, type PointerEvent } from "react";
import { useStore } from "zustand";

import type { RhythmBeat, TimelineResult } from "@/engine/timeline";
import { cn } from "@/lib/utils";

import { videoMediaStore } from "../store";

interface Props {
  timeline: TimelineResult;
  timeSec: number;
  onSeek: (t: number) => void;
  /** Duplo clique/toque numa mídia abre os ajustes dela. */
  onOpenItem?: (mediaId: string) => void;
  /** Batidas da música em tempo de timeline (0 = início do vídeo). */
  beats?: readonly RhythmBeat[];
}

/**
 * Faixa da música abaixo das mídias: energia ao fundo, uma marca por batida (inícios
 * de compasso mais altos), mudanças de seção em destaque. Cortes que caem numa batida
 * ganham um marcador sobre as mídias.
 */
const BeatLane = memo(function BeatLane({
  beats,
  timeline,
}: {
  beats: readonly RhythmBeat[];
  timeline: TimelineResult;
}) {
  const d = Math.max(0.001, timeline.durationSec);
  const times = new Set(beats.map((b) => Math.round(b.timeSec * 1000)));
  const aligned = timeline.segments.slice(1).filter((s) => times.has(Math.round(s.startSec * 1000)));
  const x = (t: number) => (t / d) * 100;
  const area =
    beats.length > 1
      ? `0,100 ${beats.map((b) => `${x(b.timeSec).toFixed(2)},${(100 - (b.energy ?? 0.5) * 100).toFixed(1)}`).join(" ")} 100,100`
      : null;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4">
        {area && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <polygon points={area} className="fill-primary/20" />
          </svg>
        )}
        {beats.map((b) => {
          const section = (b.boundary ?? 0) > 0;
          const bar = (b.bar ?? 0) > 0;
          return (
            <span
              key={b.timeSec}
              className={cn(
                "absolute bottom-0 w-px",
                section ? "w-0.5 bg-primary" : bar ? "bg-foreground/70" : "bg-muted-foreground/45",
              )}
              style={{ left: `${x(b.timeSec)}%`, height: section ? "100%" : bar ? "70%" : `${25 + b.strength * 25}%` }}
            />
          );
        })}
      </div>
      {aligned.map((s) => (
        <span
          key={s.mediaId}
          className="pointer-events-none absolute top-0 h-12 w-0.5 -translate-x-1/2 bg-primary"
          style={{ left: `${x(s.startSec)}%` }}
        />
      ))}
    </>
  );
});

const Segments = memo(function Segments({ timeline, activeId }: { timeline: TimelineResult; activeId?: string }) {
  const items = useStore(videoMediaStore, (s) => s.items);
  const d = Math.max(0.001, timeline.durationSec);
  return (
    <>
      {timeline.segments.map((seg) => {
        const thumb = items[seg.mediaId]?.thumbUrl;
        return (
          <div
            key={seg.mediaId}
            className={cn(
              "absolute inset-y-0 overflow-hidden border-r border-background/80 bg-muted",
              seg.mediaId === activeId && "z-[1] rounded-sm ring-2 ring-white ring-inset",
            )}
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

function segmentAt(timeline: TimelineResult, t: number) {
  return timeline.segments.findLast((s) => s.startSec <= t + 1e-6) ?? timeline.segments[0];
}

/** Faixa com as mídias proporcionais à duração; tocar/arrastar posiciona a reprodução. */
export function TimelineStrip({ timeline, timeSec, onSeek, onOpenItem, beats }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const d = timeline.durationSec;
  const fade = timeline.audio?.fadeOutSec ?? 0;
  const hasBeats = !!beats && beats.length > 0;
  const activeId = segmentAt(timeline, timeSec)?.mediaId;

  const timeAt = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || d <= 0) return null;
    return Math.min(d, Math.max(0, ((clientX - r.left) / r.width) * d));
  };
  const seekAt = (e: PointerEvent) => {
    const t = timeAt(e.clientX);
    if (t !== null) onSeek(t);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative cursor-pointer touch-none overflow-hidden rounded-md bg-muted select-none",
        hasBeats ? "h-16" : "h-12",
      )}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e);
      }}
      onPointerMove={(e) => dragging.current && seekAt(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onDoubleClick={(e) => {
        const t = timeAt(e.clientX);
        const seg = t === null ? undefined : segmentAt(timeline, t);
        if (seg) onOpenItem?.(seg.mediaId);
      }}
    >
      <div className="absolute inset-x-0 top-0 h-12">
        <Segments timeline={timeline} activeId={activeId} />
      </div>
      {hasBeats && <BeatLane beats={beats} timeline={timeline} />}
      {fade > 0 && d > 0 && (
        <div
          className="pointer-events-none absolute top-0 right-0 h-12 bg-gradient-to-r from-transparent to-black/60"
          style={{ width: `${(fade / d) * 100}%` }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-y-0 z-[2] w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
        style={{ left: `${d > 0 ? (timeSec / d) * 100 : 0}%` }}
      />
    </div>
  );
}
