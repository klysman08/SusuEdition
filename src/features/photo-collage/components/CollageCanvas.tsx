import { ArrowLeftRight, ImagePlus, Move, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  cellAt,
  collageGeometry,
  createCollageRenderer,
  DEFAULT_CROP,
  MAX_ZOOM,
  panCrop,
  previewSize,
  zoomCrop,
  type CellCrop,
  type CellRect,
  type CollageRenderer,
  type SceneCell,
} from "@/engine/collage";
import { ImageCache } from "@/engine/decode/image-cache";
import { resolveFilter } from "@/engine/render";
import type { Size } from "@/engine/types";
import { cn } from "@/lib/utils";
import { getMediaBackend, releaseMedia, type MediaBackend } from "@/platform/media";

import { useCollageDesign, useCollagePhotos } from "../hooks";
import { collageMediaStore, collageProjectStore } from "../store";

const LONG_PRESS_MS = 420;
const MOVE_SLOP = 6;

type Gesture =
  | { kind: "idle" }
  | { kind: "outside"; x: number; y: number }
  | {
      kind: "press" | "pan";
      id: string;
      slot: number;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      moved: boolean;
      timer: ReturnType<typeof setTimeout> | null;
    }
  | {
      kind: "pinch";
      id: string;
      slot: number;
      startDist: number;
      startCrop: CellCrop;
      anchor: { x: number; y: number };
    }
  | { kind: "swap"; id: string; slot: number };

/** Tamanho em px CSS que cabe na largura disponível e na altura máxima. */
function fitBox(aspect: string, width: number, maxHeight: number): Size {
  const [rw, rh] = aspect.split(":").map(Number) as [number, number];
  const s = Math.min(width / rw, maxHeight / rh);
  return { width: Math.max(1, Math.floor(rw * s)), height: Math.max(1, Math.floor(rh * s)) };
}

/**
 * Prévia interativa da colagem (RF-C5): toque numa foto para selecioná-la; arraste
 * para reposicionar, pinça/roda/slider para zoom; segure e arraste (ou "Trocar")
 * para trocar duas fotos de célula.
 */
export function CollageCanvas({ onAddPhotos }: { onAddPhotos: () => void }) {
  const { t } = useTranslation();
  const design = useCollageDesign();
  const photos = useCollagePhotos();
  const items = useStore(collageMediaStore, (s) => s.items);
  const pendingCount = useStore(collageMediaStore, (s) => s.progress.total - s.progress.done);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<Size>({ width: 0, height: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number; over: number | null } | null>(null);

  // Área disponível: largura do contêiner e altura limitada pela janela.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () =>
      setAvail({ width: el.clientWidth, height: Math.max(240, Math.round(window.innerHeight * 0.62)) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const css = fitBox(design.aspect, avail.width, avail.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = useMemo(
    () => previewSize(design.aspect, { width: css.width * dpr, height: css.height * dpr }),
    [design.aspect, css.width, css.height, dpr],
  );
  const geo = useMemo(() => collageGeometry(design, photos, size), [design, photos, size]);
  const toCss = css.width / size.width;

  // ---- renderização -------------------------------------------------------
  const rendererRef = useRef<CollageRenderer | null>(null);
  const cacheRef = useRef<ImageCache | null>(null);
  const backendRef = useRef<MediaBackend | null>(null);
  const frameRef = useRef(0);
  const latest = useRef({ geo, design, photos, items, size });
  useLayoutEffect(() => {
    latest.current = { geo, design, photos, items, size };
  });

  const draw = useCallback(() => {
    frameRef.current = 0;
    const renderer = rendererRef.current;
    const cache = cacheRef.current;
    if (!renderer || !cache) return;
    const { geo, design, photos, items, size } = latest.current;
    const backend = backendRef.current;
    const cells: SceneCell[] = geo.cells.map((c, i) => {
      const photo = photos[c.slot]!;
      const zoom = (design.crops[photo.id] ?? DEFAULT_CROP).zoom;
      const bmp = backend
        ? cache.get(
            { id: photo.id, url: backend.mediaUrl(photo.id), thumbUrl: items[photo.id]?.thumbUrl, size: photo.size },
            { width: c.w * zoom, height: c.h * zoom },
            true,
          )
        : null;
      return { rect: c, key: bmp ? photo.id : null, source: bmp, window: geo.windows[i]! };
    });
    renderer.render({
      size,
      background: design.background,
      radius: geo.radius,
      cells,
      filter: resolveFilter(design.filter),
      placeholder: "#d4d4d8",
    });
    renderer.retain(new Set(photos.map((p) => p.id)));
  }, []);

  const schedule = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = createCollageRenderer(canvas);
    } catch {
      rendererRef.current = null;
    }
    cacheRef.current = new ImageCache(schedule, 160 * 1024 * 1024, 3);
    let alive = true;
    void getMediaBackend().then((b) => {
      if (!alive) return;
      backendRef.current = b;
      schedule();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      cacheRef.current?.dispose();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      cacheRef.current = null;
    };
    // O canvas só existe quando há fotos.
  }, [schedule, photos.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(schedule, [schedule, geo, design, items, size]);

  // Seleção some se a foto sair da colagem.
  const ids = useMemo(() => new Set(photos.map((p) => p.id)), [photos]);
  const sel = selected && ids.has(selected) ? selected : null;
  const from = swapFrom && ids.has(swapFrom) ? swapFrom : null;

  // ---- interação ----------------------------------------------------------
  const gesture = useRef<Gesture>({ kind: "idle" });
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.width, y: ((e.clientY - r.top) / r.height) * size.height };
  };
  const cellOf = (id: string): CellRect | null => {
    const slot = photos.findIndex((p) => p.id === id);
    return geo.cells.find((c) => c.slot === slot) ?? null;
  };
  const cropOf = (id: string) => collageProjectStore.getState().crops[id] ?? DEFAULT_CROP;
  const photoOf = (id: string) => photos.find((p) => p.id === id)!;

  const applyCrop = (id: string, next: (cell: CellRect, crop: CellCrop) => CellCrop) => {
    const cell = cellOf(id);
    if (!cell) return;
    collageProjectStore.getState().setCrop(id, next(cell, cropOf(id)));
  };
  const zoomTo = (id: string, zoom: number, anchor?: { x: number; y: number }) =>
    applyCrop(id, (cell, crop) => zoomCrop(photoOf(id).size, { width: cell.w, height: cell.h }, crop, zoom, anchor));
  const doSwap = (a: string, b: string) => {
    collageMediaStore.getState().swap(a, b);
    setSwapFrom(null);
  };
  const endGesture = () => {
    const g = gesture.current;
    if ((g.kind === "press" || g.kind === "pan") && g.timer) clearTimeout(g.timer);
    gesture.current = { kind: "idle" };
    setDragging(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const pt = toCanvas(e);
    pointers.current.set(e.pointerId, pt);
    try {
      overlayRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ponteiro já liberado (ou sintético): segue sem captura.
    }
    overlayRef.current?.focus({ preventScroll: true });
    const g = gesture.current;

    if (pointers.current.size === 2 && (g.kind === "press" || g.kind === "pan")) {
      if (g.timer) clearTimeout(g.timer);
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const cell = cellOf(g.id);
      if (!cell) return;
      setSelected(g.id);
      gesture.current = {
        kind: "pinch",
        id: g.id,
        slot: g.slot,
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startCrop: cropOf(g.id),
        anchor: { x: ((a.x + b.x) / 2 - cell.x) / cell.w, y: ((a.y + b.y) / 2 - cell.y) / cell.h },
      };
      return;
    }
    if (pointers.current.size > 1) return;

    const cell = cellAt(geo.cells, pt.x, pt.y);
    if (!cell) {
      gesture.current = { kind: "outside", x: pt.x, y: pt.y };
      return;
    }
    const id = photos[cell.slot]!.id;
    const timer = setTimeout(() => {
      const cur = gesture.current;
      if ((cur.kind === "press" || cur.kind === "pan") && !cur.moved) {
        gesture.current = { kind: "swap", id, slot: cell.slot };
        setDragging({ id, x: e.clientX, y: e.clientY, over: cell.slot });
        navigator.vibrate?.(12);
      }
    }, LONG_PRESS_MS);
    gesture.current = {
      kind: id === sel ? "pan" : "press",
      id,
      slot: cell.slot,
      startX: pt.x,
      startY: pt.y,
      lastX: pt.x,
      lastY: pt.y,
      moved: false,
      timer,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const pt = toCanvas(e);
    pointers.current.set(e.pointerId, pt);
    const g = gesture.current;

    if (g.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cell = cellOf(g.id);
      if (!cell) return;
      const src = photoOf(g.id).size;
      collageProjectStore
        .getState()
        .setCrop(
          g.id,
          zoomCrop(
            src,
            { width: cell.w, height: cell.h },
            g.startCrop,
            (g.startCrop.zoom * dist) / g.startDist,
            g.anchor,
          ),
        );
      return;
    }
    if (g.kind === "swap") {
      const over = cellAt(geo.cells, pt.x, pt.y);
      setDragging({ id: g.id, x: e.clientX, y: e.clientY, over: over?.slot ?? null });
      return;
    }
    if (g.kind !== "press" && g.kind !== "pan") return;
    if (!g.moved && Math.hypot(pt.x - g.startX, pt.y - g.startY) > MOVE_SLOP * dpr) {
      g.moved = true;
      if (g.timer) clearTimeout(g.timer);
      g.timer = null;
      // Arrastar uma foto não selecionada a seleciona e já começa a mover.
      if (g.kind === "press") {
        setSelected(g.id);
        gesture.current = { ...g, kind: "pan" };
      }
    }
    const cur = gesture.current;
    if (cur.kind === "pan" && cur.moved) {
      const dx = pt.x - cur.lastX;
      const dy = pt.y - cur.lastY;
      cur.lastX = pt.x;
      cur.lastY = pt.y;
      applyCrop(cur.id, (cell, crop) => panCrop(photoOf(cur.id).size, { width: cell.w, height: cell.h }, crop, dx, dy));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === "pinch") {
      // Continua com o dedo que ficou, sem "pular" a foto.
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()] as [{ x: number; y: number }];
        gesture.current = {
          kind: "pan",
          id: g.id,
          slot: g.slot,
          startX: p.x,
          startY: p.y,
          lastX: p.x,
          lastY: p.y,
          moved: true,
          timer: null,
        };
      } else endGesture();
      return;
    }
    if (pointers.current.size > 0) return;

    if (g.kind === "swap") {
      const pt = toCanvas(e);
      const target = cellAt(geo.cells, pt.x, pt.y);
      const other = target ? photos[target.slot]?.id : undefined;
      if (other && other !== g.id) doSwap(g.id, other);
      setSelected(g.id);
    } else if ((g.kind === "press" || g.kind === "pan") && !g.moved) {
      if (from && from !== g.id) {
        doSwap(from, g.id);
        setSelected(from);
      } else setSelected(g.id);
    } else if (g.kind === "outside") {
      setSelected(null);
      setSwapFrom(null);
    }
    endGesture();
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) endGesture();
  };

  // Roda do mouse: zoom na foto selecionada, ancorado no cursor.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!sel) return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * size.width;
      const y = ((e.clientY - r.top) / r.height) * size.height;
      const cell = cellOf(sel);
      if (!cell || x < cell.x || y < cell.y || x > cell.x + cell.w || y > cell.y + cell.h) return;
      e.preventDefault();
      const zoom = cropOf(sel).zoom * Math.exp(-e.deltaY * 0.0015);
      zoomTo(sel, zoom, { x: (x - cell.x) / cell.w, y: (y - cell.y) / cell.h });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelected(null);
      setSwapFrom(null);
      return;
    }
    if (!sel) return;
    const cell = cellOf(sel);
    if (!cell) return;
    const step = Math.max(cell.w, cell.h) * 0.04;
    const pan = (dx: number, dy: number) =>
      applyCrop(sel, (c, crop) => panCrop(photoOf(sel).size, { width: c.w, height: c.h }, crop, dx, dy));
    const actions: Record<string, () => void> = {
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      "+": () => zoomTo(sel, cropOf(sel).zoom * 1.15),
      "=": () => zoomTo(sel, cropOf(sel).zoom * 1.15),
      "-": () => zoomTo(sel, cropOf(sel).zoom / 1.15),
      "0": () => collageProjectStore.getState().setCrop(sel, null),
    };
    const run = actions[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  // ---- UI -----------------------------------------------------------------
  if (photos.length === 0) {
    return (
      <div ref={wrapRef} className="w-full">
        <div
          className="mx-auto flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center"
          style={{ width: css.width || "100%", height: css.height || 320 }}
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ImagePlus className="size-6" aria-hidden />
          </span>
          <p className="max-w-56 text-sm text-muted-foreground">
            {pendingCount > 0 ? t("collage.loadingPhotos") : t("collage.emptyPreview")}
          </p>
          {pendingCount === 0 && (
            <Button onClick={onAddPhotos}>
              <ImagePlus />
              {t("mediaLibrary.addPhotos")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const selCell = sel ? cellOf(sel) : null;
  const fromCell = from ? cellOf(from) : null;
  const overCell = dragging?.over != null ? geo.cells.find((c) => c.slot === dragging.over) : null;
  const radiusCss = geo.radius * toCss;
  const box = (c: CellRect) => ({
    left: c.x * toCss,
    top: c.y * toCss,
    width: c.w * toCss,
    height: c.h * toCss,
    borderRadius: Math.min(radiusCss, (Math.min(c.w, c.h) * toCss) / 2),
  });
  const zoom = sel ? cropOf(sel).zoom : 1;

  return (
    <div ref={wrapRef} className="w-full space-y-3">
      <div className="relative mx-auto" style={{ width: css.width, height: css.height }}>
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          className="absolute inset-0 size-full rounded-md shadow-sm ring-1 ring-border"
        />
        <div
          ref={overlayRef}
          role="application"
          aria-label={t("collage.canvasLabel")}
          tabIndex={0}
          className={cn(
            "absolute inset-0 touch-none rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging ? "cursor-grabbing" : sel ? "cursor-move" : "cursor-pointer",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
        >
          {fromCell && (
            <div
              className="pointer-events-none absolute animate-pulse ring-2 ring-amber-400 ring-offset-0"
              style={box(fromCell)}
            />
          )}
          {selCell && !dragging && (
            <div
              className="pointer-events-none absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.12)] ring-2 ring-primary"
              style={box(selCell)}
            />
          )}
          {overCell && dragging && (
            <div className="pointer-events-none absolute bg-primary/25 ring-2 ring-primary" style={box(overCell)} />
          )}
        </div>
        {dragging && items[dragging.id]?.thumbUrl && (
          <img
            src={items[dragging.id]!.thumbUrl}
            alt=""
            className="pointer-events-none fixed z-50 size-16 -translate-x-1/2 -translate-y-1/2 rounded-lg object-cover opacity-90 shadow-xl ring-2 ring-primary"
            style={{ left: dragging.x, top: dragging.y }}
          />
        )}
      </div>

      {sel ? (
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
          <div className="flex min-w-48 flex-1 items-center gap-2 px-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("collage.zoomOut")}
              onClick={() => zoomTo(sel, zoom / 1.25)}
              disabled={zoom <= 1.001}
            >
              <ZoomOut />
            </Button>
            <Slider
              aria-label={t("collage.zoom")}
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => v !== undefined && zoomTo(sel, v)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("collage.zoomIn")}
              onClick={() => zoomTo(sel, zoom * 1.25)}
              disabled={zoom >= MAX_ZOOM - 0.001}
            >
              <ZoomIn />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={from === sel ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={from === sel}
                  onClick={() => setSwapFrom(from === sel ? null : sel)}
                >
                  <ArrowLeftRight />
                  {t("collage.swap")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("collage.swapHint")}</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("collage.resetCrop")}
              onClick={() => collageProjectStore.getState().setCrop(sel, null)}
            >
              <RotateCcw />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("collage.removePhoto")}
              onClick={() => {
                collageMediaStore.getState().remove([sel]);
                collageProjectStore.getState().setCrop(sel, null);
                setSelected(null);
                void releaseMedia([sel]);
              }}
            >
              <Trash2 />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("collage.deselect")} onClick={() => setSelected(null)}>
              <X />
            </Button>
          </div>
          {from === sel && (
            <p className="w-full px-2 pb-1 text-xs text-amber-600 dark:text-amber-400">{t("collage.swapPick")}</p>
          )}
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Move className="size-3.5 shrink-0" aria-hidden />
          {t("collage.hint")}
        </p>
      )}
    </div>
  );
}
