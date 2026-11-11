import { Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TimelineResult } from "@/engine/timeline";
import type { LibraryItem } from "@/features/media-library";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useMediaUrl, useProject } from "../hooks";
import { videoMediaStore, videoProjectStore } from "../store";

const round = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Tira de quadros ao fundo da barra de recorte: um <video> auxiliar percorre o arquivo
 * e desenha um quadro por fatia. Se o dispositivo não conseguir, a barra fica lisa.
 */
function useFilmstrip(url: string | null, durationSec: number, canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url || durationSec <= 0) return;
    let alive = true;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const seek = (t: number) =>
      new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          video.removeEventListener("seeked", done);
          resolve();
        };
        const timer = setTimeout(done, 1500);
        video.addEventListener("seeked", done);
        video.currentTime = t;
      });

    const run = async () => {
      if (!alive || video.videoWidth === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const slotW = Math.max(24, Math.round((h * video.videoWidth) / video.videoHeight));
      const count = Math.min(24, Math.max(1, Math.ceil(w / slotW)));
      const step = w / count;
      for (let i = 0; i < count && alive; i++) {
        await seek(Math.min(durationSec - 0.05, ((i + 0.5) / count) * durationSec));
        if (!alive) return;
        // "cover": recorta o quadro para preencher a fatia.
        const scale = Math.max(step / video.videoWidth, h / video.videoHeight);
        const sw = step / scale;
        const sh = h / scale;
        ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, i * step, 0, step, h);
      }
    };

    video.addEventListener("loadeddata", () => void run().catch(() => {}), { once: true });
    video.src = url;
    return () => {
      alive = false;
      video.removeAttribute("src");
      video.load();
    };
  }, [url, durationSec, canvasRef]);
}

function Edge({
  label,
  value,
  onStep,
  onHere,
  hereLabel,
}: {
  label: string;
  value: number;
  onStep: (delta: number) => void;
  onHere: () => void;
  hereLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={t("music.earlier", { label })}
          onClick={() => onStep(-0.1)}
        >
          <Minus />
        </Button>
        <span className="w-14 text-center text-sm font-medium tabular-nums">{formatTime(value)}</span>
        <Button variant="outline" size="icon-xs" aria-label={t("music.later", { label })} onClick={() => onStep(0.1)}>
          <Plus />
        </Button>
      </div>
      <Button variant="ghost" size="xs" className="justify-start px-1 text-xs" onClick={onHere}>
        {hereLabel}
      </Button>
    </div>
  );
}

function TrimBody({
  id,
  item,
  timeline,
  onClose,
}: {
  id: string;
  item: LibraryItem;
  timeline: TimelineResult;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const url = useMediaUrl(item.sourceId ?? id);
  const total = item.meta?.durationSec ?? 0;
  const minLen = Math.min(0.5, total);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<"in" | "out" | "seek" | null>(null);
  const [barW, setBarW] = useState(0);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Ponto de partida: o trecho que o vídeo usa hoje na timeline.
  const [range, setRange] = useState(() => {
    const o = videoProjectStore.getState().overrides[id];
    const seg = timeline.segments.find((s) => s.mediaId === id);
    const start = clamp(o?.sourceInSec ?? seg?.sourceInSec ?? 0, 0, Math.max(0, total - minLen));
    const fallback = videoProjectStore.getState().timeline.videoDurationSec;
    const length = o?.durationSec ?? seg?.durationSec ?? fallback;
    return { in: round(start), out: round(clamp(start + length, start + minLen, total)) };
  });
  const rangeRef = useRef(range);
  useEffect(() => {
    rangeRef.current = range;
  }, [range]);
  const hasOverride = useProject((s) => {
    const o = s.overrides[id];
    return o?.sourceInSec !== undefined || o?.durationSec !== undefined;
  });

  useFilmstrip(url, total, stripRef);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    setBarW(el.clientWidth);
    const ro = new ResizeObserver(() => setBarW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const seek = (time: number) => {
    const v = videoRef.current;
    const next = clamp(time, 0, total);
    if (v) v.currentTime = next;
    setPos(next);
  };

  // Mostra o início do trecho assim que o vídeo carrega.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url) return;
    const onReady = () => {
      v.currentTime = rangeRef.current.in;
      setPos(rangeRef.current.in);
    };
    v.addEventListener("loadedmetadata", onReady, { once: true });
    return () => v.removeEventListener("loadedmetadata", onReady);
  }, [url]);

  // Tocando: acompanha o cursor e para no fim do trecho.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.currentTime >= rangeRef.current.out || v.ended) {
        v.pause();
        v.currentTime = rangeRef.current.in;
        setPos(rangeRef.current.in);
        setPlaying(false);
        return;
      }
      setPos(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
      return;
    }
    if (v.currentTime < range.in - 0.05 || v.currentTime >= range.out - 0.05) v.currentTime = range.in;
    void v
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  };

  const setEdge = (edge: "in" | "out", time: number) => {
    const r = rangeRef.current;
    const next =
      edge === "in"
        ? { in: round(clamp(time, 0, r.out - minLen)), out: r.out }
        : { in: r.in, out: round(clamp(time, r.in + minLen, total)) };
    rangeRef.current = next;
    setRange(next);
    // Parado: o vídeo mostra o quadro da borda que está sendo ajustada.
    if (!playing) seek(edge === "in" ? next.in : Math.max(0, next.out - 0.03));
  };

  const timeAt = (e: PointerEvent) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return 0;
    return clamp(((e.clientX - r.left) / r.width) * total, 0, total);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const edge = (e.target as HTMLElement).closest<HTMLElement>("[data-edge]")?.dataset.edge as
      "in" | "out" | undefined;
    dragRef.current = edge ?? "seek";
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!edge) seek(timeAt(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const mode = dragRef.current;
    if (!mode) return;
    if (mode === "seek") seek(timeAt(e));
    else setEdge(mode, timeAt(e));
  };
  const onEdgeKey = (edge: "in" | "out") => (e: KeyboardEvent) => {
    const dir =
      e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    setEdge(edge, range[edge] + dir * (e.shiftKey ? 1 : 0.1));
  };

  const x = (time: number) => (total > 0 ? (time / total) * barW : 0);
  const apply = () => {
    videoProjectStore.getState().patchOverride(id, {
      sourceInSec: range.in > 0.005 ? range.in : undefined,
      durationSec: round(range.out - range.in),
    });
    onClose();
  };
  const reset = () => {
    videoProjectStore.getState().patchOverride(id, { sourceInSec: undefined, durationSec: undefined });
    onClose();
  };

  const handle =
    "absolute inset-y-0 z-10 flex w-7 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("trim.title")}</DialogTitle>
        <DialogDescription className="truncate">{item.name}</DialogDescription>
      </DialogHeader>

      <div className="relative overflow-hidden rounded-lg bg-black">
        {url && (
          <video
            ref={videoRef}
            src={url}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            onClick={toggle}
            className="mx-auto block max-h-[46dvh] w-full cursor-pointer object-contain"
          />
        )}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 flex size-12 -translate-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-opacity",
            playing ? "opacity-0" : "opacity-100",
          )}
        >
          <Play className="size-5 translate-x-0.5 fill-current" />
        </span>
      </div>

      <div
        ref={barRef}
        className="relative h-14 touch-none overflow-hidden rounded-lg bg-muted select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      >
        <canvas ref={stripRef} aria-hidden className="absolute inset-0 size-full" />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-background/75"
          style={{ width: x(range.in) }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-background/75"
          style={{ width: Math.max(0, barW - x(range.out)) }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-primary"
          style={{ left: x(range.in), width: Math.max(0, x(range.out) - x(range.in)) }}
        />
        {(["in", "out"] as const).map((edge) => (
          <div
            key={edge}
            data-edge={edge}
            role="slider"
            tabIndex={0}
            aria-label={t(edge === "in" ? "trim.start" : "trim.end")}
            aria-valuemin={0}
            aria-valuemax={round(total)}
            aria-valuenow={range[edge]}
            aria-valuetext={formatTime(range[edge])}
            onKeyDown={onEdgeKey(edge)}
            className={handle}
            style={{ left: x(range[edge]) }}
          >
            <span className="h-full w-2 rounded-full bg-primary shadow-[0_0_0_2px_var(--popover)]" />
          </div>
        ))}
        <div
          className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
          style={{ left: x(pos) }}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <Edge
          label={t("trim.start")}
          value={range.in}
          onStep={(d) => setEdge("in", range.in + d)}
          onHere={() => setEdge("in", pos)}
          hereLabel={t("trim.startHere")}
        />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("trim.length")}</span>
          <span className="text-lg leading-6 font-semibold tabular-nums">
            {(range.out - range.in).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatTime(pos)} / {formatTime(total)}
          </span>
        </div>
        <Edge
          label={t("trim.end")}
          value={range.out}
          onStep={(d) => setEdge("out", range.out + d)}
          onHere={() => setEdge("out", pos)}
          hereLabel={t("trim.endHere")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={toggle} disabled={!url}>
          {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          {playing ? t("trim.pause") : t("trim.play")}
        </Button>
        {hasOverride && (
          <Button variant="ghost" onClick={reset}>
            <RotateCcw />
            {t("trim.reset")}
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="outline" onClick={onClose}>
          {t("trim.cancel")}
        </Button>
        <Button onClick={apply}>{t("trim.apply")}</Button>
      </div>
    </>
  );
}

/**
 * Recorte de um vídeo: escolhe o trecho de interesse (início e fim) vendo o vídeo.
 * Aplicar define o ponto de início e trava a duração da mídia na timeline.
 */
export function TrimDialog({
  id,
  timeline,
  onClose,
}: {
  id: string | null;
  timeline: TimelineResult;
  onClose: () => void;
}) {
  const item = useStore(videoMediaStore, (s) => (id ? s.items[id] : undefined));
  const open = !!id && item?.kind === "video";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] gap-3 overflow-y-auto sm:max-w-2xl">
        {open && item && <TrimBody key={id} id={id} item={item} timeline={timeline} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
