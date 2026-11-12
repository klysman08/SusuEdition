import { Lock, Music, Video } from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import type { RhythmBeat, TimelineResult, TimelineSegment } from "@/engine/timeline";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useProject } from "../hooks";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "../store";
import {
  durationForEnd,
  durationLimits,
  nearestBoundary,
  reorderForBoundary,
  snapTime,
  tickStep,
} from "../timeline-edit";
import { timelineUi } from "../timeline-ui";
import { AudioLane } from "./AudioLane";

interface Props {
  timeline: TimelineResult;
  timeSec: number;
  playing: boolean;
  /** Batidas da música em tempo de timeline (0 = início do vídeo). */
  beats: readonly RhythmBeat[];
  selectedId: string | null;
  onSelect: (mediaId: string | null) => void;
  onSeek: (t: number) => void;
  /** Duplo clique/toque (ou Enter) numa mídia: abre o recorte/ajustes dela. */
  onOpenItem: (mediaId: string) => void;
  onOpenMusic: () => void;
}

type Drag =
  | { kind: "scrub" }
  | { kind: "pending"; id: string; startX: number; reorder: boolean }
  | { kind: "duration"; index: number; value: number }
  | { kind: "reorder"; id: string; boundary: number };

type Ghost =
  { kind: "duration"; x: number; label: string; snapped: boolean } | { kind: "reorder"; x: number; id: string };

const secs = (v: number) => `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s`;

const Ruler = memo(function Ruler({
  pps,
  durationSec,
  scrollX,
  viewW,
}: {
  pps: number;
  durationSec: number;
  scrollX: number;
  viewW: number;
}) {
  const step = tickStep(pps);
  const first = Math.max(0, Math.floor((scrollX - 80) / pps / step));
  const last = Math.min(Math.floor(durationSec / step), Math.ceil((scrollX + viewW + 80) / pps / step));
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) ticks.push(i * step);
  return (
    <div className="relative h-[18px] cursor-pointer touch-none border-b border-border/60 select-none">
      {ticks.map((t) => (
        <span
          key={t}
          className="pointer-events-none absolute top-0 h-full border-l border-border pl-1 text-[10px] leading-[18px] text-muted-foreground tabular-nums"
          style={{ left: t * pps }}
        >
          {formatTime(t, step < 1)}
        </span>
      ))}
    </div>
  );
});

const Clips = memo(function Clips({
  segments,
  pps,
  selectedId,
  draggingId,
  zoomed,
}: {
  segments: readonly TimelineSegment[];
  pps: number;
  selectedId: string | null;
  draggingId: string | null;
  zoomed: boolean;
}) {
  const items = useStore(videoMediaStore, (s) => s.items);
  const overrides = useProject((s) => s.overrides);
  return (
    <>
      {segments.map((seg) => {
        const w = seg.durationSec * pps;
        const thumb = items[seg.mediaId]?.thumbUrl;
        const selected = seg.mediaId === selectedId;
        const manual = overrides[seg.mediaId]?.durationSec !== undefined;
        return (
          <div
            key={seg.mediaId}
            data-clip={seg.mediaId}
            className={cn(
              "absolute inset-y-0 overflow-hidden bg-muted bg-[length:auto_100%] bg-left bg-repeat-x",
              selected
                ? "z-[1] cursor-grab rounded-md ring-2 ring-primary ring-inset active:cursor-grabbing"
                : "cursor-pointer border-r border-background/80",
              seg.mediaId === draggingId && "opacity-40",
            )}
            style={{
              left: seg.startSec * pps,
              width: w,
              backgroundImage: thumb ? `url("${thumb}")` : undefined,
              // Selecionada: arrastar move a mídia. Com zoom, o resto da faixa rola com o dedo.
              touchAction: selected || !zoomed ? "none" : "pan-x",
            }}
          >
            {seg.transitionIn.kind === "fade" && (
              <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-background/80 to-transparent" />
            )}
            {w >= 40 && (
              <span className="pointer-events-none absolute bottom-0.5 left-0.5 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] leading-4 font-medium text-white tabular-nums">
                {seg.kind === "video" && <Video className="size-2.5" aria-hidden />}
                {manual && <Lock className="size-2.5" aria-hidden />}
                {seg.durationSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s
              </span>
            )}
            {w < 40 && manual && <span className="absolute bottom-0.5 left-0.5 size-1.5 rounded-full bg-amber-400" />}
            {seg.keepAudio && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-emerald-400" />}
          </div>
        );
      })}
    </>
  );
});

/**
 * Faixa do tempo do editor: régua, mídias proporcionais à duração e a faixa de áudio
 * com waveform e batidas.
 *
 * - Régua e faixa de áudio: tocar/arrastar posiciona a reprodução.
 * - Mídia: um toque seleciona. Selecionada, arrastar o corpo muda a posição dela no
 *   vídeo e arrastar uma das alças muda onde o corte acontece (imanta nas batidas;
 *   Alt desliga o imã). A duração escolhida à mão fica travada.
 * - Zoom (botões, Ctrl + roda): a faixa passa a rolar na horizontal.
 */
export function Timeline({
  timeline,
  timeSec,
  playing,
  beats,
  selectedId,
  onSelect,
  onSeek,
  onOpenItem,
  onOpenMusic,
}: Props) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  /** Último toque simples numa mídia: dois seguidos na mesma abrem o recorte/ajustes. */
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const [viewW, setViewW] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const zoom = useStore(timelineUi, (s) => s.zoom);
  const audioHeight = useStore(timelineUi, (s) => s.audioHeight);
  const analysis = useStore(videoMusicStore, (s) => (s.status === "ready" ? s.analysis : null));
  const minClipSec = useProject((s) => s.timeline.minClipSec);

  const { segments } = timeline;
  const d = Math.max(0.001, timeline.durationSec);
  const contentW = Math.max(1, Math.round(viewW * zoom));
  const pps = contentW / d;
  const fade = timeline.audio?.fadeOutSec ?? 0;
  const selectedIndex = selectedId ? segments.findIndex((s) => s.mediaId === selectedId) : -1;
  const selected = selectedIndex >= 0 ? segments[selectedIndex] : undefined;
  const beatTimes = useMemo(() => beats.map((b) => b.timeSec), [beats]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewW(el.clientWidth);
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ao mudar o zoom, o cursor de reprodução fica onde estava na tela.
  const timeRef = useRef(timeSec);
  useEffect(() => {
    timeRef.current = timeSec;
  }, [timeSec]);
  const prevPps = useRef(pps);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (el && prevPps.current !== pps && viewW > 0) {
      const before = timeRef.current * prevPps.current - el.scrollLeft;
      const anchor = before >= 0 && before <= viewW ? before : viewW / 2;
      el.scrollLeft = Math.max(0, timeRef.current * pps - anchor);
    }
    prevPps.current = pps;
  }, [pps, viewW]);

  // Tocando com zoom: a faixa acompanha o cursor.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !playing || zoom <= 1) return;
    const x = timeSec * pps;
    if (x < el.scrollLeft || x > el.scrollLeft + viewW - 32) el.scrollLeft = Math.max(0, x - viewW * 0.12);
  }, [timeSec, playing, pps, viewW, zoom]);

  // Ctrl + roda = zoom; roda sozinha rola a faixa quando há zoom.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const z = timelineUi.getState().zoom;
        timelineUi.getState().setZoom(z * (e.deltaY < 0 ? 1.25 : 0.8));
      } else if (timelineUi.getState().zoom > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** Tempo sob o ponteiro (sem limitar ao fim: a última mídia pode crescer além dele). */
  const rawTimeAt = (clientX: number) => {
    const el = viewportRef.current;
    if (!el) return 0;
    return Math.max(0, (clientX - el.getBoundingClientRect().left + el.scrollLeft) / pps);
  };
  const timeAt = (clientX: number) => Math.min(d, rawTimeAt(clientX));

  const updateDuration = (e: PointerEvent, st: Extract<Drag, { kind: "duration" }>) => {
    const seg = segments[st.index];
    if (!seg) return;
    const raw = rawTimeAt(e.clientX);
    const points = [...beatTimes, timeRef.current].sort((a, b) => a - b);
    const snap = e.altKey ? { time: raw, snapped: false } : snapTime(raw, points, 7 / pps);
    const media = videoMediaStore.getState().items[seg.mediaId];
    const value = durationForEnd(seg, snap.time, durationLimits(seg, media?.meta?.durationSec, minClipSec));
    st.value = value;
    const end = seg.startSec + value;
    setGhost({
      kind: "duration",
      x: end * pps,
      label: secs(value),
      snapped: snap.snapped && Math.abs(end - snap.time) < 0.011,
    });
  };

  const updateReorder = (e: PointerEvent, st: Extract<Drag, { kind: "reorder" }>) => {
    const boundary = nearestBoundary(segments, rawTimeAt(e.clientX));
    st.boundary = boundary;
    const seg = segments[boundary];
    const last = segments.at(-1);
    const time = seg ? seg.startSec : last ? last.startSec + last.durationSec : 0;
    setGhost({ kind: "reorder", x: time * pps, id: st.id });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-handle]");
    if (handle) {
      const index = Number(handle.dataset.handle);
      const seg = segments[index];
      if (!seg) return;
      const st: Drag = { kind: "duration", index, value: seg.durationSec };
      drag.current = st;
      e.currentTarget.setPointerCapture(e.pointerId);
      updateDuration(e, st);
      return;
    }
    const clip = target.closest<HTMLElement>("[data-clip]");
    if (clip?.dataset.clip) {
      const id = clip.dataset.clip;
      drag.current = { kind: "pending", id, startX: e.clientX, reorder: id === selectedId };
      // Toque numa mídia não selecionada com zoom: o navegador rola a faixa.
      if (e.pointerType === "mouse" || id === selectedId || zoom <= 1) e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (target.closest("[data-no-seek]")) return;
    drag.current = { kind: "scrub" };
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(timeAt(e.clientX));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    if (!st) return;
    if (st.kind === "scrub") onSeek(timeAt(e.clientX));
    else if (st.kind === "duration") updateDuration(e, st);
    else if (st.kind === "reorder") updateReorder(e, st);
    else if (Math.abs(e.clientX - st.startX) >= 5) {
      if (st.reorder) {
        const next: Drag = { kind: "reorder", id: st.id, boundary: -1 };
        drag.current = next;
        updateReorder(e, next);
      } else if (e.pointerType === "mouse" || zoom <= 1) {
        drag.current = { kind: "scrub" };
        onSeek(timeAt(e.clientX));
      }
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    drag.current = null;
    setGhost(null);
    if (!st) return;
    if (st.kind === "pending") {
      // Com o ponteiro capturado o navegador não entrega "dblclick" na mídia: conta aqui.
      const now = performance.now();
      const double = lastTap.current?.id === st.id && now - lastTap.current.at < 400;
      lastTap.current = double ? null : { id: st.id, at: now };
      onSelect(st.id);
      if (double) onOpenItem(st.id);
      else onSeek(timeAt(e.clientX));
    } else if (st.kind === "duration") {
      const seg = segments[st.index];
      if (seg && Math.abs(st.value - seg.durationSec) > 0.004) {
        videoProjectStore.getState().patchOverride(seg.mediaId, { durationSec: st.value });
      }
    } else if (st.kind === "reorder" && st.boundary >= 0) {
      const next = reorderForBoundary(videoMediaStore.getState().order, segments, st.id, st.boundary);
      if (next) videoMediaStore.getState().setOrder(next);
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
    setGhost(null);
  };

  const selectIndex = (i: number) => {
    const seg = segments[Math.min(segments.length - 1, Math.max(0, i))];
    if (!seg) return;
    onSelect(seg.mediaId);
    onSeek(seg.startSec);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const current = selectedIndex >= 0 ? selectedIndex : segments.findLastIndex((s) => s.startSec <= timeSec + 1e-6);
    if (e.key === "ArrowRight") selectIndex(selectedIndex >= 0 ? current + 1 : current);
    else if (e.key === "ArrowLeft") selectIndex(selectedIndex >= 0 ? current - 1 : current);
    else if (e.key === "Home") onSeek(0);
    else if (e.key === "End") onSeek(d);
    else if (e.key === "Enter" && selected) onOpenItem(selected.mediaId);
    else if (e.key === "Escape" && selected) onSelect(null);
    else if ((e.key === "+" || e.key === "=") && !selected) timelineUi.getState().setZoom(zoom * 1.5);
    else if (e.key === "-" && !selected) timelineUi.getState().setZoom(zoom / 1.5);
    else return;
    e.preventDefault();
  };

  const handleClass =
    "group/handle absolute inset-y-0 z-[2] flex w-4 cursor-ew-resize touch-none items-center justify-center pointer-coarse:w-6";
  const handleGrip =
    "h-full w-1.5 rounded-full bg-primary shadow-[0_0_0_1.5px_var(--card)] transition-transform group-hover/handle:scale-x-150";

  return (
    <div
      ref={viewportRef}
      role="group"
      tabIndex={0}
      aria-label={t("timeline.label")}
      aria-keyshortcuts="ArrowLeft ArrowRight Enter Escape"
      onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
      onKeyDown={onKeyDown}
      className="relative overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="relative select-none"
        style={{ width: contentW }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // Captura perdida sem "pointerup" (soltou fora da janela, gesto do sistema): desfaz o arraste.
        onLostPointerCapture={onPointerCancel}
      >
        <Ruler pps={pps} durationSec={d} scrollX={scrollX} viewW={viewW} />

        <div className="relative h-12 sm:h-14">
          <Clips
            segments={segments}
            pps={pps}
            selectedId={selectedId}
            draggingId={ghost?.kind === "reorder" ? ghost.id : null}
            zoomed={zoom > 1}
          />
          {fade > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-r from-transparent to-black/60"
              style={{ width: fade * pps }}
            />
          )}
          {selected && (
            <>
              {selectedIndex > 0 && (
                <span
                  data-handle={selectedIndex - 1}
                  role="presentation"
                  title={t("timeline.dragCut")}
                  className={cn(handleClass, "-translate-x-[70%]")}
                  style={{ left: selected.startSec * pps }}
                >
                  <span className={handleGrip} />
                </span>
              )}
              <span
                data-handle={selectedIndex}
                role="presentation"
                title={t("timeline.dragCut")}
                className={cn(handleClass, "-translate-x-[30%]")}
                style={{ left: (selected.startSec + selected.durationSec) * pps }}
              >
                <span className={handleGrip} />
              </span>
            </>
          )}
        </div>

        {analysis && timeline.audio ? (
          <div className="relative cursor-pointer touch-none border-t border-border/60" style={{ height: audioHeight }}>
            <AudioLane
              height={audioHeight}
              viewW={viewW}
              scrollX={scrollX}
              pxPerSec={pps}
              timeline={timeline}
              beats={beats}
              peaks={analysis.peaks}
              musicDurationSec={analysis.durationSec}
            />
          </div>
        ) : (
          <div className="border-t border-border/60" data-no-seek>
            <button
              type="button"
              onClick={onOpenMusic}
              className="sticky left-0 flex h-7 items-center gap-1.5 px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
            >
              <Music className="size-3.5" aria-hidden />
              {t("timeline.noMusic")}
            </button>
          </div>
        )}

        {ghost?.kind === "duration" && (
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 z-[4] w-0.5 -translate-x-1/2",
              ghost.snapped ? "bg-emerald-400" : "bg-primary",
            )}
            style={{ left: ghost.x }}
          >
            <span
              className={cn(
                "absolute top-5 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums shadow",
                ghost.snapped ? "bg-emerald-600" : "bg-primary",
              )}
            >
              {ghost.label}
            </span>
          </div>
        )}
        {ghost?.kind === "reorder" && (
          <div
            className="pointer-events-none absolute top-[18px] z-[4] h-12 w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_2px_var(--card)] sm:h-14"
            style={{ left: ghost.x }}
          />
        )}

        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-px bg-foreground"
          style={{ transform: `translateX(${timeSec * pps}px)` }}
        >
          <span className="absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-b-sm bg-foreground" />
        </div>
      </div>
    </div>
  );
}
