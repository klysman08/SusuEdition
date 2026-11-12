import { Activity, Film, Flag, Maximize2, Minimize2, Pause, Play, SkipBack, ZoomIn, ZoomOut } from "lucide-react";
import { useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import type { TimelineResult } from "@/engine/timeline";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useProject } from "../hooks";
import { MARKER_TOLERANCE_SEC } from "../project-store";
import { videoMusicStore, videoProjectStore } from "../store";
import { AUDIO_HEIGHT, timelineUi, ZOOM } from "../timeline-ui";
import { ClipToolbar } from "./ClipToolbar";
import { Timeline } from "./Timeline";
import type { PreviewController } from "./use-preview-player";

/**
 * Palco do editor: o vídeo ocupa todo o espaço livre, sempre na proporção escolhida.
 * A caixa usa unidades de container (cqw/cqh) para caber tanto na largura quanto na altura.
 */
export function PreviewStage({
  preview,
  canvasRef,
  boxRef,
  focus,
  onToggleFocus,
}: {
  preview: PreviewController;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  /** Prévia ampliada: as ferramentas ficam escondidas. */
  focus: boolean;
  onToggleFocus: () => void;
}) {
  const { t } = useTranslation();
  const { player, state, empty, unsupported } = preview;
  const [aw, ah] = preview.aspect;

  return (
    <div className="[container-type:size] relative flex min-h-[34dvh] flex-1 items-center justify-center bg-zinc-950 p-1.5 sm:p-4 lg:min-h-[26dvh]">
      <div
        ref={boxRef}
        className="group relative overflow-hidden rounded-md bg-black shadow-2xl ring-1 ring-white/10"
        style={{ aspectRatio: `${aw} / ${ah}`, width: `min(100cqw, calc(100cqh * ${aw / ah}))` }}
      >
        <canvas ref={canvasRef} className="block size-full" onClick={() => player?.toggle()} />
        {empty || unsupported ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/70">
            <Film className="size-7" aria-hidden />
            <p className="text-xs">{unsupported ? t("preview.unsupported") : t("preview.empty")}</p>
          </div>
        ) : (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 flex size-14 -translate-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity duration-200",
              state.playing ? "opacity-0" : "opacity-100",
            )}
          >
            <Play className="size-6 translate-x-0.5 fill-current" />
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-pressed={focus}
        aria-label={t(focus ? "preview.exitFocus" : "preview.focus")}
        title={t(focus ? "preview.exitFocus" : "preview.focus")}
        onClick={onToggleFocus}
        className="absolute top-1.5 right-1.5 rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 hover:text-white"
      >
        {focus ? <Minimize2 /> : <Maximize2 />}
      </Button>
    </div>
  );
}

/** Divisor entre a prévia e a faixa do tempo: arrastar muda a altura da faixa de áudio. */
function ResizeGrip() {
  const { t } = useTranslation();
  const height = useStore(timelineUi, (s) => s.audioHeight);
  const start = useRef<{ y: number; h: number } | null>(null);
  const { setAudioHeight } = timelineUi.getState();
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={t("timeline.resize")}
      aria-valuemin={AUDIO_HEIGHT.min}
      aria-valuemax={AUDIO_HEIGHT.max}
      aria-valuenow={height}
      tabIndex={0}
      title={t("timeline.resize")}
      className="group absolute inset-x-0 -top-2.5 z-10 flex h-5 cursor-ns-resize touch-none items-center justify-center outline-none"
      onPointerDown={(e) => {
        start.current = { y: e.clientY, h: timelineUi.getState().audioHeight };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => start.current && setAudioHeight(start.current.h + (start.current.y - e.clientY))}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onDoubleClick={() => setAudioHeight(AUDIO_HEIGHT.default)}
      onKeyDown={(e) => {
        const dir = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        setAudioHeight(height + dir * 12);
      }}
    >
      <span className="h-1.5 w-12 rounded-full border bg-card shadow-sm transition-colors group-hover:border-primary group-hover:bg-primary group-focus-visible:border-primary group-focus-visible:bg-primary group-active:bg-primary" />
    </div>
  );
}

/** Controles de reprodução + faixa do tempo (mídias e áudio), sempre visíveis abaixo do palco. */
export function TimelineDock({
  preview,
  timeline,
  selectedId,
  onSelect,
  onOpenItem,
  onTrim,
  onCrop,
  onAdjust,
  onOpenMusic,
}: {
  preview: PreviewController;
  timeline: TimelineResult;
  selectedId: string | null;
  onSelect: (mediaId: string | null) => void;
  onOpenItem: (mediaId: string) => void;
  onTrim: (mediaId: string) => void;
  onCrop: (mediaId: string) => void;
  onAdjust: (mediaId: string) => void;
  onOpenMusic: () => void;
}) {
  const { t } = useTranslation();
  const { player, state, empty } = preview;
  const zoom = useStore(timelineUi, (s) => s.zoom);
  const hasAudioLane = useStore(videoMusicStore, (s) => s.status === "ready") && timeline.audio !== null;
  const { setZoom } = timelineUi.getState();
  const markers = useProject((s) => s.markers);
  // Marcadores ficam no tempo da música: cursor do vídeo + início do trecho usado.
  const musicTime = timeline.audio ? timeline.audio.musicInSec + state.timeSec : null;
  const onMarker = musicTime !== null && markers.some((m) => Math.abs(m - musicTime) <= MARKER_TOLERANCE_SEC);

  return (
    <div className="relative shrink-0 space-y-1.5 border-t bg-card px-2 py-2 sm:px-4">
      {hasAudioLane && !empty && <ResizeGrip />}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => player?.seek(0)}
          disabled={empty || !player}
          aria-label={t("preview.restart")}
        >
          <SkipBack />
        </Button>
        <Button
          size="icon-lg"
          className="rounded-full"
          onClick={() => player?.toggle()}
          disabled={empty || !player}
          aria-label={state.playing ? t("preview.pause") : t("preview.play")}
        >
          {state.playing ? <Pause className="fill-current" /> : <Play className="translate-x-px fill-current" />}
        </Button>
        <p className="ml-1 text-sm font-medium tabular-nums">
          {formatTime(state.timeSec, false)}
          <span className="font-normal text-muted-foreground"> / {formatTime(state.durationSec, false)}</span>
        </p>
        <span className="flex-1" />
        {timeline.beatSync && (
          <p
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
            title={t("preview.onBeat", { snapped: timeline.beatSync.snapped, cuts: timeline.beatSync.cuts })}
          >
            <Activity className="size-3.5" aria-hidden />
            <span className="sm:hidden">
              {timeline.beatSync.snapped}/{timeline.beatSync.cuts}
            </span>
            <span className="max-sm:hidden">
              {t("preview.onBeat", { snapped: timeline.beatSync.snapped, cuts: timeline.beatSync.cuts })}
            </span>
          </p>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={empty || musicTime === null}
          aria-pressed={onMarker}
          aria-label={t(onMarker ? "timeline.removeMarker" : "timeline.addMarker")}
          title={t(onMarker ? "timeline.removeMarker" : "timeline.addMarker")}
          onClick={() => musicTime !== null && videoProjectStore.getState().toggleMarker(musicTime)}
          className={cn(onMarker && "text-amber-500")}
        >
          <Flag className={cn(onMarker && "fill-current")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={empty || zoom <= ZOOM.min}
          aria-label={t("timeline.zoomOut")}
          title={t("timeline.zoomOut")}
          onClick={() => setZoom(zoom / 1.5 < 1.2 ? 1 : zoom / 1.5)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={empty || zoom >= ZOOM.max}
          aria-label={t("timeline.zoomIn")}
          title={t("timeline.zoomIn")}
          onClick={() => setZoom(zoom * 1.5)}
        >
          <ZoomIn />
        </Button>
      </div>

      {selectedId && (
        <ClipToolbar
          id={selectedId}
          timeline={timeline}
          timeSec={state.timeSec}
          onTrim={onTrim}
          onCrop={onCrop}
          onAdjust={onAdjust}
          onClose={() => onSelect(null)}
        />
      )}

      {empty ? (
        <div className="h-12 rounded-md bg-muted" />
      ) : (
        <Timeline
          timeline={timeline}
          timeSec={state.timeSec}
          playing={state.playing}
          beats={preview.beats}
          selectedId={selectedId}
          onSelect={onSelect}
          onSeek={(v) => player?.seek(v)}
          onOpenItem={onOpenItem}
          onOpenMusic={onOpenMusic}
        />
      )}
    </div>
  );
}
