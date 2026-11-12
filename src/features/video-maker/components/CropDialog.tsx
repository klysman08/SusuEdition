import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cropForRatio, FULL_CROP, isFullCrop, MIN_CROP, normalizeCrop } from "@/engine/render";
import type { ClipCrop } from "@/engine/timeline";
import type { LibraryItem } from "@/features/media-library";
import { cn } from "@/lib/utils";

import { useMediaUrl, useProject } from "../hooks";
import { videoMediaStore, videoProjectStore } from "../store";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Ratio = "free" | "frame" | "square";

/** Alças: canto ou lado do corte que cada uma move (−1 = esquerda/cima, 1 = direita/baixo). */
const HANDLES: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/**
 * Corte depois de arrastar uma alça `dx, dy` (fração da mídia). Com `k` (proporção
 * largura/altura em fração da mídia) o corte mantém a proporção, preso ao canto oposto.
 */
function resizeCrop(start: ClipCrop, hx: number, hy: number, dx: number, dy: number, k: number | null): ClipCrop {
  let x0 = start.x;
  let y0 = start.y;
  let x1 = start.x + start.w;
  let y1 = start.y + start.h;
  if (k === null) {
    if (hx < 0) x0 = clamp(x0 + dx, 0, x1 - MIN_CROP);
    if (hx > 0) x1 = clamp(x1 + dx, x0 + MIN_CROP, 1);
    if (hy < 0) y0 = clamp(y0 + dy, 0, y1 - MIN_CROP);
    if (hy > 0) y1 = clamp(y1 + dy, y0 + MIN_CROP, 1);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const ax = hx < 0 ? x1 : x0;
  const ay = hy < 0 ? y1 : y0;
  const availW = hx < 0 ? ax : 1 - ax;
  const availH = hy < 0 ? ay : 1 - ay;
  const maxW = Math.min(availW, availH * k);
  const minW = Math.min(maxW, Math.max(MIN_CROP, MIN_CROP * k));
  const w = clamp(start.w + hx * dx, minW, maxW);
  const h = w / k;
  return { x: hx < 0 ? ax - w : ax, y: hy < 0 ? ay - h : ay, w, h };
}

function CropBody({ id, item, onClose }: { id: string; item: LibraryItem; onClose: () => void }) {
  const { t } = useTranslation();
  const saved = useProject((s) => s.overrides[id]?.crop);
  const startSec = useProject((s) => s.overrides[id]?.sourceInSec ?? 0);
  const aspect = useProject((s) => s.aspect);
  const url = useMediaUrl(item.sourceId ?? id);
  const [crop, setCrop] = useState<ClipCrop>(() => normalizeCrop(saved) ?? FULL_CROP);
  const [ratio, setRatio] = useState<Ratio>("free");
  const [imageFailed, setImageFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ hx: number; hy: number; move: boolean; x: number; y: number; start: ClipCrop } | null>(null);

  const isVideo = item.kind === "video";
  const width = item.meta?.width ?? 1;
  const height = item.meta?.height ?? 1;
  const [aw, ah] = aspect.split(":").map(Number) as [number, number];
  const pixelRatio = ratio === "frame" ? aw / ah : ratio === "square" ? 1 : null;
  /** Proporção travada, em fração da mídia. */
  const k = pixelRatio === null ? null : (pixelRatio * height) / width;

  // O vídeo mostra o quadro em que o trecho usado começa.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url) return;
    const show = () => {
      v.currentTime = Math.min(Math.max(0, startSec) + 0.05, Math.max(0, (v.duration || 0) - 0.05));
    };
    if (v.readyState >= 1) show();
    v.addEventListener("loadedmetadata", show);
    return () => v.removeEventListener("loadedmetadata", show);
  }, [url, startSec]);

  const pickRatio = (next: Ratio) => {
    setRatio(next);
    if (next === "free") return;
    setCrop((c) => cropForRatio({ width, height }, next === "frame" ? aw / ah : 1, c));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-hx]");
    drag.current = {
      hx: Number(handle?.dataset.hx ?? 0),
      hy: Number(handle?.dataset.hy ?? 0),
      move: !handle,
      x: e.clientX,
      y: e.clientY,
      start: crop,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const r = boxRef.current?.getBoundingClientRect();
    if (!d || !r || r.width <= 0 || r.height <= 0) return;
    const dx = (e.clientX - d.x) / r.width;
    const dy = (e.clientY - d.y) / r.height;
    if (d.move) {
      setCrop({
        ...d.start,
        x: clamp(d.start.x + dx, 0, 1 - d.start.w),
        y: clamp(d.start.y + dy, 0, 1 - d.start.h),
      });
    } else {
      setCrop(resizeCrop(d.start, d.hx, d.hy, dx, dy, k));
    }
  };
  const endDrag = () => (drag.current = null);

  /** Setas movem o corte; com Shift mudam o tamanho (canto inferior direito). */
  const onKeyDown = (e: KeyboardEvent) => {
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const step = 0.01;
    if (e.shiftKey) setCrop((c) => resizeCrop(c, 1, 1, dx * step, k === null ? dy * step : 0, k));
    else setCrop((c) => ({ ...c, x: clamp(c.x + dx * step, 0, 1 - c.w), y: clamp(c.y + dy * step, 0, 1 - c.h) }));
  };

  const apply = () => {
    videoProjectStore.getState().patchOverride(id, { crop: normalizeCrop(crop) });
    onClose();
  };
  const reset = () => {
    setRatio("free");
    setCrop(FULL_CROP);
  };

  const pct = (v: number) => `${v * 100}%`;
  const ratios: Ratio[] = aw === ah ? ["free", "square"] : ["free", "frame", "square"];
  const imageUrl = imageFailed ? item.thumbUrl : (url ?? item.thumbUrl);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("crop.title")}</DialogTitle>
        <DialogDescription className="truncate">{item.name}</DialogDescription>
      </DialogHeader>

      {/* A folga em volta deixa as alças inteiras visíveis quando o corte encosta na borda. */}
      <div className="flex justify-center overflow-hidden rounded-lg bg-black p-3">
        <div
          ref={boxRef}
          className="relative touch-none select-none"
          style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(50dvh * ${width / height}))` }}
        >
          {isVideo ? (
            url && (
              <video
                ref={videoRef}
                src={url}
                poster={item.thumbUrl}
                muted
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                className="pointer-events-none block size-full object-fill"
              />
            )
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onError={() => setImageFailed(true)}
              className="pointer-events-none block size-full object-fill"
            />
          ) : null}

          <div
            role="group"
            tabIndex={0}
            aria-label={t("crop.area")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="absolute cursor-move shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] ring-2 ring-white outline-none focus-visible:ring-primary"
            style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
          >
            {/* Regra dos terços */}
            <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
            <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
            <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
            <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />
            {HANDLES.filter(([hx, hy]) => k === null || (hx !== 0 && hy !== 0)).map(([hx, hy]) => (
              <span
                key={`${hx}:${hy}`}
                data-hx={hx}
                data-hy={hy}
                className={cn(
                  "absolute flex size-8 -translate-1/2 items-center justify-center",
                  hx === 0 ? "cursor-ns-resize" : hy === 0 ? "cursor-ew-resize" : null,
                  hx !== 0 && hy !== 0 && (hx === hy ? "cursor-nwse-resize" : "cursor-nesw-resize"),
                )}
                style={{ left: pct((hx + 1) / 2), top: pct((hy + 1) / 2) }}
              >
                <span
                  className={cn(
                    "rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]",
                    hx === 0 ? "h-1.5 w-5" : hy === 0 ? "h-5 w-1.5" : "size-3",
                  )}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={ratio}
          onValueChange={(v) => v && pickRatio(v as Ratio)}
          aria-label={t("crop.ratio")}
        >
          {ratios.map((r) => (
            <ToggleGroupItem key={r} value={r} className="px-3 text-xs">
              {r === "free" ? t("crop.free") : r === "frame" ? t("crop.frame", { aspect }) : "1:1"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(width * crop.w)} × {Math.round(height * crop.h)} px
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("crop.hint")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={reset} disabled={isFullCrop(crop)}>
          <RotateCcw />
          {t("crop.reset")}
        </Button>
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
 * Corte de uma foto ou vídeo: escolhe a parte que aparece no quadro. O enquadramento
 * (inteira, preencher, esticar) passa a valer para essa parte, na prévia e na exportação.
 */
export function CropDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const item = useStore(videoMediaStore, (s) => (id ? s.items[id] : undefined));
  const open = !!id && !!item?.meta;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] gap-3 overflow-y-auto sm:max-w-2xl">
        {open && item && <CropBody key={id} id={id} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
