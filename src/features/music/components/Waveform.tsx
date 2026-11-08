import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { moveSelection, peakInRange, setEdge, type Selection } from "@/engine/audio";
import type { Beat } from "@/engine/types";
import { formatTime } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props {
  peaks: readonly number[];
  durationSec: number;
  beats: readonly Beat[];
  selection: Selection;
  position: number | null;
  snap: boolean;
  onChange: (selection: Selection) => void;
  onSeek: (timeSec: number) => void;
}

type DragMode = { kind: "in" | "out" } | { kind: "body"; startX: number; startSel: Selection };

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * Waveform com o trecho selecionado. Arraste as alças para ajustar início/fim,
 * arraste o trecho para movê-lo, toque fora para levar a borda mais próxima até lá.
 * Desenho em canvas (milhares de picos sem custo de DOM).
 */
export function Waveform({ peaks, durationSec, beats, selection, position, snap, onChange, onSeek }: Props) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const movedRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toX = (time: number) => (durationSec > 0 ? (time / durationSec) * size.w : 0);
  const toTime = (x: number) => Math.min(durationSec, Math.max(0, (x / Math.max(1, size.w)) * durationSec));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const active = cssVar(canvas, "--primary", "#e11d48");
    const idle = cssVar(canvas, "--muted-foreground", "#888");
    const beatColor = cssVar(canvas, "--foreground", "#000");
    const beatArea = 10;
    const waveH = size.h - beatArea - 4;
    const mid = waveH / 2;
    const inX = toX(selection.inSec);
    const outX = toX(selection.outSec);
    const barW = 2;
    const gap = 1;
    const perBar = peaks.length / (size.w / (barW + gap));

    for (let x = 0, i = 0; x < size.w; x += barW + gap, i++) {
      const p = peakInRange(peaks, i * perBar, (i + 1) * perBar);
      const h = Math.max(1, p * (waveH - 4));
      const inside = x + barW > inX && x < outX;
      ctx.fillStyle = inside ? active : idle;
      ctx.globalAlpha = inside ? 1 : 0.35;
      ctx.fillRect(x, mid - h / 2, barW, h);
    }

    // Batidas: marcas na base, mais altas quanto mais fortes.
    ctx.fillStyle = beatColor;
    for (const b of beats) {
      const x = toX(b.timeSec);
      const inside = b.timeSec >= selection.inSec && b.timeSec <= selection.outSec;
      ctx.globalAlpha = inside ? 0.55 : 0.2;
      const h = 3 + b.strength * (beatArea - 3);
      ctx.fillRect(Math.round(x), size.h - h, 1, h);
    }
    ctx.globalAlpha = 1;
    // toX depende de size/duration (já nas deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peaks, beats, selection, size, durationSec, resolvedTheme]);

  const localX = (e: PointerEvent) => e.clientX - (wrapRef.current?.getBoundingClientRect().left ?? 0);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-drag]");
    const kind = target?.dataset.drag as "in" | "out" | "body" | undefined;
    movedRef.current = false;
    if (kind === "in" || kind === "out") dragRef.current = { kind };
    else if (kind === "body") dragRef.current = { kind: "body", startX: localX(e), startSel: selection };
    else {
      // Fora do trecho: leva a borda mais próxima até o toque.
      const time = toTime(localX(e));
      const edge = Math.abs(time - selection.inSec) < Math.abs(time - selection.outSec) ? "in" : "out";
      onChange(setEdge(selection, edge, time, durationSec, beats, snap));
      dragRef.current = { kind: edge };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    movedRef.current = true;
    const x = localX(e);
    if (drag.kind === "body") {
      const delta = ((x - drag.startX) / Math.max(1, size.w)) * durationSec;
      onChange(moveSelection(drag.startSel, delta, durationSec));
    } else {
      onChange(setEdge(selection, drag.kind, toTime(x), durationSec, beats, snap));
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    // Toque simples dentro do trecho: posiciona a reprodução.
    if (drag?.kind === "body" && !movedRef.current) onSeek(toTime(localX(e)));
  };

  const onHandleKey = (edge: "in" | "out") => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.1;
    const dir =
      e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const current = edge === "in" ? selection.inSec : selection.outSec;
    onChange(setEdge(selection, edge, current + dir * step, durationSec));
  };

  const inX = toX(selection.inSec);
  const outX = toX(selection.outSec);
  const handle =
    "absolute top-0 bottom-0 z-10 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring";

  return (
    <div className="select-none">
      <div
        ref={wrapRef}
        className="relative h-28 w-full touch-none rounded-lg bg-muted/40 sm:h-36"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragRef.current = null)}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg bg-background/50"
          style={{ width: inX }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 rounded-r-lg bg-background/50"
          style={{ width: Math.max(0, size.w - outX) }}
        />
        <div
          data-drag="body"
          className="absolute inset-y-0 cursor-grab touch-none border-y-2 border-primary/70 active:cursor-grabbing"
          style={{ left: inX, width: Math.max(0, outX - inX) }}
        />
        {(["in", "out"] as const).map((edge) => {
          const value = edge === "in" ? selection.inSec : selection.outSec;
          return (
            <div
              key={edge}
              data-drag={edge}
              role="slider"
              tabIndex={0}
              aria-label={t(edge === "in" ? "music.start" : "music.end")}
              aria-valuemin={0}
              aria-valuemax={Math.round(durationSec * 10) / 10}
              aria-valuenow={Math.round(value * 10) / 10}
              aria-valuetext={formatTime(value)}
              onKeyDown={onHandleKey(edge)}
              className={handle}
              style={{ left: edge === "in" ? inX : outX }}
            >
              <span className="h-full w-1.5 rounded-full bg-primary shadow-[0_0_0_2px_var(--background)]" />
              <span className="absolute top-1/2 h-8 w-3.5 -translate-y-1/2 rounded-md bg-primary shadow-md">
                <span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-primary-foreground/70" />
              </span>
            </div>
          );
        })}
        {position !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-foreground"
            style={{ left: toX(position) }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className={cn(f > 0 && f < 1 && "hidden sm:inline")}>
            {formatTime(durationSec * f, false)}
          </span>
        ))}
      </div>
    </div>
  );
}
