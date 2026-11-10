import { Activity, Film, Pause, Play, SkipBack } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { TimelineResult } from "@/engine/timeline";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { TimelineStrip } from "./TimelineStrip";
import type { PreviewController } from "./use-preview-player";

/**
 * Palco do editor: o vídeo ocupa todo o espaço livre, sempre na proporção escolhida.
 * A caixa usa unidades de container (cqw/cqh) para caber tanto na largura quanto na altura.
 */
export function PreviewStage({
  preview,
  canvasRef,
  boxRef,
}: {
  preview: PreviewController;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const { player, state, empty, unsupported } = preview;
  const [aw, ah] = preview.aspect;

  return (
    <div className="[container-type:size] relative flex min-h-[26dvh] flex-1 items-center justify-center bg-zinc-950 p-3 sm:p-5">
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
    </div>
  );
}

/** Controles de reprodução + faixa das mídias, sempre visíveis abaixo do palco. */
export function TimelineDock({
  preview,
  timeline,
  onOpenItem,
}: {
  preview: PreviewController;
  timeline: TimelineResult;
  onOpenItem: (mediaId: string) => void;
}) {
  const { t } = useTranslation();
  const { player, state, empty } = preview;

  return (
    <div className="shrink-0 space-y-2 border-t bg-card px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-2">
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
          <p className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Activity className="size-3.5" aria-hidden />
            {t("preview.onBeat", { snapped: timeline.beatSync.snapped, cuts: timeline.beatSync.cuts })}
          </p>
        )}
      </div>
      {empty ? (
        <div className="h-12 rounded-md bg-muted" />
      ) : (
        <TimelineStrip
          timeline={timeline}
          timeSec={state.timeSec}
          onSeek={(v) => player?.seek(v)}
          onOpenItem={onOpenItem}
          beats={preview.beats}
        />
      )}
    </div>
  );
}
