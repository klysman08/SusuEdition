import { AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_TIMELINE_SETTINGS, type TimelineResult } from "@/engine/timeline";
import { formatTime } from "@/lib/format";

import { useProject } from "../hooks";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "../store";
import { LabeledValue, Section } from "@/components/common/Section";
import { BeatSyncSection, PhotoMotionSection, TransitionSection } from "./RhythmSections";

const QUICK = [15, 30, 60] as const;
/** Menor tempo padrão de uma mídia (o mesmo mínimo de qualquer trecho da timeline). */
const MIN_ITEM_SEC = DEFAULT_TIMELINE_SETTINGS.minClipSec;
const round1 = (v: number) => Math.round(v * 10) / 10;
const secs = (v: number) => `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

function Summary({ timeline }: { timeline: TimelineResult }) {
  const { t } = useTranslation();
  const total = useStore(videoMediaStore, (s) => s.order.length);
  const dropped = timeline.warnings.find((w) => w.kind === "itemsDropped");
  const short = timeline.warnings.find((w) => w.kind === "contentShorterThanMusic");
  const musicShort = timeline.warnings.find((w) => w.kind === "musicShorterThanVideo");

  return (
    <section className="flex items-start gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-3 sm:gap-4 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:size-11">
        <Clock className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{t("timing.summaryTitle")}</p>
        <p className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
          {formatTime(timeline.durationSec)}
          <span className="ml-2 inline-block text-sm font-normal text-muted-foreground">{t("timing.videoLength")}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? t("timing.noMedia") : t("timing.itemsUsed", { used: timeline.segments.length, total })}
        </p>
        {(dropped || short || musicShort) && (
          <ul className="mt-2 space-y-1 text-xs">
            {dropped?.kind === "itemsDropped" && (
              <li className="flex gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("timing.warnDropped", { count: dropped.mediaIds.length })}
              </li>
            )}
            {short?.kind === "contentShorterThanMusic" && (
              <li className="flex gap-1.5 text-muted-foreground">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("timing.warnShort", { content: formatTime(short.contentSec) })}
              </li>
            )}
            {musicShort?.kind === "musicShorterThanVideo" && (
              <li className="flex gap-1.5 text-muted-foreground">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("timing.warnMusicShort", { music: formatTime(musicShort.musicSec) })}
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Ferramenta "Ritmo e tempo": sincronia com as batidas, tempo por mídia, duração total,
 * o que fazer com o excesso, transição e movimento das fotos — tudo o que decide
 * quando cada mídia entra e sai.
 */
export function TimingPanel({ timeline, onGoToMusic }: { timeline: TimelineResult; onGoToMusic: () => void }) {
  const { t } = useTranslation();
  const settings = useProject((s) => s.timeline);
  const selection = useStore(videoMusicStore, (s) => (s.status === "ready" ? s.selection : null));
  const { patchTimeline } = videoProjectStore.getState();
  const mode = settings.total.mode;
  const custom = settings.total.mode === "custom" ? settings.total.seconds : 30;

  const totalHint =
    mode === "music"
      ? selection
        ? t("timing.totalHint.music", { duration: formatTime(selection.outSec - selection.inSec) })
        : t("timing.totalHint.musicMissing")
      : t(`timing.totalHint.${mode}`);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Summary timeline={timeline} />

      <BeatSyncSection timeline={timeline} onGoToMusic={onGoToMusic} />

      <Section title={t("timing.perItemTitle")} description={t("timing.videoHint")}>
        <div className="space-y-5">
          <LabeledValue label={t("timing.photo")} value={secs(settings.photoDurationSec)}>
            <Slider
              min={MIN_ITEM_SEC}
              max={10}
              step={0.1}
              value={[settings.photoDurationSec]}
              onValueChange={([v]) => v !== undefined && patchTimeline({ photoDurationSec: round1(v) })}
              aria-label={t("timing.photo")}
            />
          </LabeledValue>
          <LabeledValue label={t("timing.video")} value={secs(settings.videoDurationSec)}>
            <Slider
              min={MIN_ITEM_SEC}
              max={30}
              step={0.1}
              value={[settings.videoDurationSec]}
              onValueChange={([v]) => v !== undefined && patchTimeline({ videoDurationSec: round1(v) })}
              aria-label={t("timing.video")}
            />
          </LabeledValue>
        </div>
      </Section>

      <Section title={t("timing.totalTitle")} description={totalHint}>
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={mode}
            onValueChange={(v) => {
              if (v === "music" || v === "items") patchTimeline({ total: { mode: v } });
              else if (v === "custom") patchTimeline({ total: { mode: "custom", seconds: custom } });
            }}
            className="w-full"
          >
            {(["music", "custom", "items"] as const).map((m) => (
              <ToggleGroupItem
                key={m}
                value={m}
                className="h-auto min-h-8 flex-1 px-2 py-1.5 text-xs leading-tight whitespace-normal sm:text-sm"
              >
                {t(`timing.total.${m}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {mode === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => patchTimeline({ total: { mode: "custom", seconds: q } })}
                  className={
                    "h-8 rounded-md border px-3 text-sm tabular-nums transition-colors hover:bg-accent " +
                    (custom === q ? "border-primary bg-primary/10 text-primary" : "")
                  }
                >
                  {q}s
                </button>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={600}
                  step={1}
                  value={custom}
                  aria-label={t("timing.seconds")}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0)
                      patchTimeline({ total: { mode: "custom", seconds: Math.min(600, v) } });
                  }}
                  className="h-8 w-20 tabular-nums"
                />
                <span className="text-sm text-muted-foreground">{t("timing.seconds")}</span>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title={t("timing.overflowTitle")} description={t(`timing.overflowHint.${settings.overflow}`)}>
        <ToggleGroup
          type="single"
          variant="outline"
          value={settings.overflow}
          onValueChange={(v) => (v === "drop" || v === "fit") && patchTimeline({ overflow: v })}
          className="w-full"
        >
          {(["drop", "fit"] as const).map((o) => (
            <ToggleGroupItem key={o} value={o} className="flex-1">
              {t(`timing.overflow.${o}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>

      <TransitionSection />
      <PhotoMotionSection />
    </div>
  );
}
