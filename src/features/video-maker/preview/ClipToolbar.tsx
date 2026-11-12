import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Scissors,
  SlidersHorizontal,
  SquareSplitHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import type { TimelineResult } from "@/engine/timeline";

import { removeClip, splitClipAt, splittableAt } from "../clip-actions";
import { useProject } from "../hooks";
import { videoMediaStore, videoProjectStore } from "../store";
import { durationLimits } from "../timeline-edit";

const STEP = 0.1;

/**
 * Ações da mídia selecionada na faixa do tempo: mudar de posição, ajustar a duração
 * em passos de 0,1 s, recortar (vídeos), cortar, abrir os demais ajustes e remover.
 */
export function ClipToolbar({
  id,
  timeline,
  timeSec,
  onTrim,
  onCrop,
  onAdjust,
  onClose,
}: {
  id: string;
  timeline: TimelineResult;
  /** Posição do cursor de reprodução (onde "dividir" corta). */
  timeSec: number;
  onTrim: (id: string) => void;
  onCrop: (id: string) => void;
  onAdjust: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const item = useStore(videoMediaStore, (s) => s.items[id]);
  const manual = useProject((s) => s.overrides[id]?.durationSec !== undefined);
  const minClipSec = useProject((s) => s.timeline.minClipSec);
  const index = timeline.segments.findIndex((s) => s.mediaId === id);
  const seg = timeline.segments[index];
  if (!item || !seg) return null;

  const { patchOverride } = videoProjectStore.getState();
  const limits = durationLimits(seg, item.meta?.durationSec, minClipSec);
  const prev = timeline.segments[index - 1];
  const next = timeline.segments[index + 1];

  const nudge = (delta: number) => {
    const d = Math.round((seg.durationSec + delta) * 10) / 10;
    patchOverride(id, { durationSec: Math.min(limits.maxSec, Math.max(limits.minSec, d)) });
  };
  const remove = () => {
    onClose();
    void removeClip(id);
  };
  const canSplit = splittableAt(timeline, timeSec, minClipSec)?.mediaId === id;

  return (
    <div
      role="toolbar"
      aria-label={t("timeline.clipTools", { name: item.name })}
      className="flex [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-lg border bg-background px-1.5 py-1"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!prev}
        aria-label={t("timeline.moveEarlier")}
        title={t("timeline.moveEarlier")}
        onClick={() => prev && videoMediaStore.getState().move(id, prev.mediaId)}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-8 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
        {index + 1}/{timeline.segments.length}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!next}
        aria-label={t("timeline.moveLater")}
        title={t("timeline.moveLater")}
        onClick={() => next && videoMediaStore.getState().move(id, next.mediaId)}
      >
        <ChevronRight />
      </Button>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={seg.durationSec <= limits.minSec + 1e-6}
        aria-label={t("timeline.shorter")}
        title={t("timeline.shorter")}
        onClick={() => nudge(-STEP)}
      >
        <Minus />
      </Button>
      <span
        className="min-w-12 shrink-0 text-center text-sm font-medium tabular-nums"
        aria-label={t("timeline.duration")}
      >
        {seg.durationSec.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={seg.durationSec >= limits.maxSec - 1e-6}
        aria-label={t("timeline.longer")}
        title={t("timeline.longer")}
        onClick={() => nudge(STEP)}
      >
        <Plus />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!manual}
        aria-pressed={manual}
        aria-label={t(manual ? "timeline.unlock" : "timeline.automatic")}
        title={t(manual ? "timeline.unlock" : "timeline.automatic")}
        onClick={() => patchOverride(id, { durationSec: undefined })}
        className={manual ? "text-amber-600 dark:text-amber-400" : undefined}
      >
        {manual ? <Lock /> : <LockOpen />}
      </Button>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!canSplit}
        aria-label={t("timeline.split")}
        title={t("timeline.split")}
        onClick={() => splitClipAt(timeline, timeSec)}
      >
        <SquareSplitHorizontal />
      </Button>
      {seg.kind === "video" && (
        <Button variant="secondary" size="sm" onClick={() => onTrim(id)}>
          <Scissors />
          {t("timeline.trim")}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("timeline.crop")}
        title={t("timeline.crop")}
        onClick={() => onCrop(id)}
        className={seg.crop ? "text-primary" : undefined}
      >
        <Crop />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("timeline.adjust")}
        title={t("timeline.adjust")}
        onClick={() => onAdjust(id)}
      >
        <SlidersHorizontal />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("timeline.remove")}
        title={t("timeline.remove")}
        onClick={remove}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </Button>

      <span className="min-w-0 flex-1 truncate pl-1 text-xs text-muted-foreground max-sm:hidden">{item.name}</span>
      <span className="flex-1 sm:hidden" />
      <Button variant="ghost" size="icon-sm" aria-label={t("timeline.deselect")} onClick={onClose}>
        <X />
      </Button>
    </div>
  );
}
