import { Activity, AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TimelineResult } from "@/engine/timeline";
import { formatTime } from "@/lib/format";

import { useProject } from "../hooks";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "../store";
import { LabeledValue, Section } from "./Section";

const QUICK = [15, 30, 60] as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

function Summary({ timeline }: { timeline: TimelineResult }) {
  const { t } = useTranslation();
  const total = useStore(videoMediaStore, (s) => s.order.length);
  const dropped = timeline.warnings.find((w) => w.kind === "itemsDropped");
  const short = timeline.warnings.find((w) => w.kind === "contentShorterThanMusic");
  const musicShort = timeline.warnings.find((w) => w.kind === "musicShorterThanVideo");

  return (
    <section className="flex items-start gap-4 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Clock className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{t("timing.summaryTitle")}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
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

/** Passo "Tempo": duração total, tempo por mídia, excesso, transição e áudio. */
export function TimingPanel({ timeline }: { timeline: TimelineResult }) {
  const { t } = useTranslation();
  const settings = useProject((s) => s.timeline);
  const mix = useProject((s) => s.mix);
  const selection = useStore(videoMusicStore, (s) => (s.status === "ready" ? s.selection : null));
  const bpm = useStore(videoMusicStore, (s) => s.analysis?.bpm ?? null);
  const beatCount = useStore(videoMusicStore, (s) => s.analysis?.beats.length ?? 0);
  const { patchTimeline, patchMix } = videoProjectStore.getState();
  const sync = settings.beatSync;
  const canSync = !!selection && beatCount > 0;
  const mode = settings.total.mode;
  const custom = settings.total.mode === "custom" ? settings.total.seconds : 30;
  const fade = settings.transition.kind === "fade" ? settings.transition.durationSec : 0.5;

  const totalHint =
    mode === "music"
      ? selection
        ? t("timing.totalHint.music", { duration: formatTime(selection.outSec - selection.inSec) })
        : t("timing.totalHint.musicMissing")
      : t(`timing.totalHint.${mode}`);

  return (
    <div className="space-y-4">
      <Summary timeline={timeline} />

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

      <Section title={t("timing.perItemTitle")} description={t("timing.videoHint")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <LabeledValue label={t("timing.photo")} value={secs(settings.photoDurationSec)}>
            <Slider
              min={0.5}
              max={10}
              step={0.5}
              value={[settings.photoDurationSec]}
              onValueChange={([v]) => v !== undefined && patchTimeline({ photoDurationSec: v })}
              aria-label={t("timing.photo")}
            />
          </LabeledValue>
          <LabeledValue label={t("timing.video")} value={secs(settings.videoDurationSec)}>
            <Slider
              min={1}
              max={30}
              step={0.5}
              value={[settings.videoDurationSec]}
              onValueChange={([v]) => v !== undefined && patchTimeline({ videoDurationSec: v })}
              aria-label={t("timing.video")}
            />
          </LabeledValue>
        </div>
      </Section>

      <Section
        title={t("timing.beatSyncTitle")}
        description={
          !selection
            ? t("timing.beatSyncNoMusic")
            : beatCount === 0
              ? t("timing.beatSyncNoBeats")
              : t("timing.beatSyncHint")
        }
        action={
          <Switch
            checked={sync.enabled && canSync}
            disabled={!canSync}
            onCheckedChange={(v) => patchTimeline({ beatSync: { ...sync, enabled: v } })}
            aria-label={t("timing.beatSync")}
          />
        }
      >
        {sync.enabled && canSync ? (
          <div className="space-y-3">
            <LabeledValue label={t("timing.maxDeviation")} value={`± ${secs(sync.maxDeviationSec)}`}>
              <Slider
                min={0.1}
                max={2}
                step={0.05}
                value={[sync.maxDeviationSec]}
                onValueChange={([v]) => v !== undefined && patchTimeline({ beatSync: { ...sync, maxDeviationSec: v } })}
                aria-label={t("timing.maxDeviation")}
              />
            </LabeledValue>
            {timeline.beatSync && (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <Activity className="size-3.5" aria-hidden />
                {t("timing.beatSyncStats", {
                  snapped: timeline.beatSync.snapped,
                  cuts: timeline.beatSync.cuts,
                  bpm: bpm !== null ? Math.round(bpm) : "—",
                })}
              </p>
            )}
          </div>
        ) : null}
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

      <Section title={t("timing.transitionTitle")}>
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={settings.transition.kind}
            onValueChange={(v) => {
              if (v === "cut") patchTimeline({ transition: { kind: "cut" } });
              else if (v === "fade") patchTimeline({ transition: { kind: "fade", durationSec: fade } });
            }}
            className="w-full"
          >
            {(["cut", "fade"] as const).map((k) => (
              <ToggleGroupItem key={k} value={k} className="flex-1">
                {t(`timing.transition.${k}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {settings.transition.kind === "fade" && (
            <LabeledValue label={t("timing.fadeDuration")} value={secs(fade)}>
              <Slider
                min={0.2}
                max={2}
                step={0.1}
                value={[fade]}
                onValueChange={([v]) =>
                  v !== undefined && patchTimeline({ transition: { kind: "fade", durationSec: v } })
                }
                aria-label={t("timing.fadeDuration")}
              />
            </LabeledValue>
          )}
        </div>
      </Section>

      <Section title={t("timing.audioTitle")}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="keep-video-audio">{t("timing.keepVideoAudio")}</Label>
            <Switch
              id="keep-video-audio"
              checked={settings.keepVideoAudio}
              onCheckedChange={(v) => patchTimeline({ keepVideoAudio: v })}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <LabeledValue label={t("timing.musicVolume")} value={pct(mix.musicGain)}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[mix.musicGain]}
                onValueChange={([v]) => v !== undefined && patchMix({ musicGain: v })}
                aria-label={t("timing.musicVolume")}
              />
            </LabeledValue>
            <LabeledValue label={t("timing.videoVolume")} value={pct(mix.videoGain)}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[mix.videoGain]}
                onValueChange={([v]) => v !== undefined && patchMix({ videoGain: v })}
                aria-label={t("timing.videoVolume")}
              />
            </LabeledValue>
            <LabeledValue label={t("timing.ducking")} value={pct(mix.duckingGain)}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[mix.duckingGain]}
                onValueChange={([v]) => v !== undefined && patchMix({ duckingGain: v })}
                aria-label={t("timing.ducking")}
              />
            </LabeledValue>
          </div>
        </div>
      </Section>
    </div>
  );
}
