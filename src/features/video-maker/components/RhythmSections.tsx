import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioWaveform,
  Ban,
  Check,
  Drum,
  HeartPulse,
  Metronome,
  RotateCcw,
  RotateCw,
  Shuffle,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { LabeledValue, Section } from "@/components/common/Section";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BEAT_SYNC_PRESETS,
  MOTION_KINDS,
  type BeatSyncPreset,
  type MotionKind,
  type TimelineResult,
} from "@/engine/timeline";
import { cn } from "@/lib/utils";

import { useProject } from "../hooks";
import { videoMusicStore, videoProjectStore } from "../store";

const PRESETS: { id: BeatSyncPreset; icon: LucideIcon }[] = [
  { id: "dynamic", icon: AudioWaveform },
  { id: "steady", icon: Metronome },
  { id: "bars", icon: Drum },
  { id: "accents", icon: Zap },
];

const MOTION_ICONS: Record<MotionKind | "auto", LucideIcon> = {
  none: Ban,
  auto: Shuffle,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  panLeft: ArrowLeft,
  panRight: ArrowRight,
  panUp: ArrowUp,
  panDown: ArrowDown,
  punch: Zap,
  pulse: HeartPulse,
  tiltLeft: RotateCcw,
  tiltRight: RotateCw,
};
/** "Nenhum" e "Auto" primeiro; depois cada movimento. */
const PHOTO_MOTIONS: readonly (MotionKind | "auto")[] = ["none", "auto", ...MOTION_KINDS.filter((m) => m !== "none")];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/** Sincronia com as batidas: liga/desliga, estilo e flexibilidade. */
export function BeatSyncSection({ timeline, onGoToMusic }: { timeline: TimelineResult; onGoToMusic: () => void }) {
  const { t } = useTranslation();
  const settings = useProject((s) => s.timeline);
  const selection = useStore(videoMusicStore, (s) => (s.status === "ready" ? s.selection : null));
  const bpm = useStore(videoMusicStore, (s) => s.analysis?.bpm ?? null);
  const beatCount = useStore(videoMusicStore, (s) => s.analysis?.beats.length ?? 0);
  const { patchTimeline } = videoProjectStore.getState();
  const sync = settings.beatSync;
  const canSync = !!selection && beatCount > 0;
  const active = sync.enabled && canSync;

  return (
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
          checked={active}
          disabled={!canSync}
          onCheckedChange={(v) => patchTimeline({ beatSync: { ...sync, enabled: v } })}
          aria-label={t("timing.beatSync")}
        />
      }
    >
      {!selection ? (
        <button type="button" onClick={onGoToMusic} className="text-sm font-medium text-primary hover:underline">
          {t("timing.chooseMusic")}
        </button>
      ) : (
        <div className={cn("space-y-4", !active && "pointer-events-none opacity-50")} aria-disabled={!active}>
          <div role="radiogroup" aria-label={t("timing.syncStyle")} className="grid grid-cols-2 gap-2">
            {PRESETS.map(({ id, icon: Icon }) => {
              const selected = sync.preset === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={active ? 0 : -1}
                  onClick={() =>
                    patchTimeline({
                      beatSync: { ...sync, preset: id, flexibility: BEAT_SYNC_PRESETS[id].flex },
                    })
                  }
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:gap-1.5 sm:p-3",
                    selected && "border-primary bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                  <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <span className="text-sm font-medium">{t(`timing.preset.${id}`)}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {t(`timing.presetHint.${id}`)}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <LabeledValue label={t("timing.flexibility")} value={pct(sync.flexibility)}>
              <Slider
                min={0.1}
                max={1}
                step={0.05}
                value={[sync.flexibility]}
                disabled={!active}
                onValueChange={([v]) => v !== undefined && patchTimeline({ beatSync: { ...sync, flexibility: v } })}
                aria-label={t("timing.flexibility")}
              />
            </LabeledValue>
            <p className="mt-2 text-xs text-muted-foreground">{t("timing.flexibilityHint")}</p>
          </div>

          {active && timeline.beatSync && (
            <p className="flex items-center gap-1.5 text-xs text-primary">
              <Activity className="size-3.5 shrink-0" aria-hidden />
              {t("timing.beatSyncStats", {
                snapped: timeline.beatSync.snapped,
                cuts: timeline.beatSync.cuts,
                bpm: bpm !== null ? Math.round(bpm) : "—",
              })}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

/** Transição padrão entre as mídias (cada mídia pode ter a sua). */
export function TransitionSection() {
  const { t } = useTranslation();
  const settings = useProject((s) => s.timeline);
  const { patchTimeline } = videoProjectStore.getState();
  const fade = settings.transition.kind === "fade" ? settings.transition.durationSec : 0.5;

  return (
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
  );
}

/** Movimento padrão das fotos (cada mídia pode ter o seu nos ajustes dela). */
export function PhotoMotionSection() {
  const { t } = useTranslation();
  const photoMotion = useProject((s) => s.timeline.photoMotion);
  const { patchTimeline } = videoProjectStore.getState();

  return (
    <Section title={t("timing.photoMotionTitle")} description={t("timing.photoMotionHint")}>
      <div
        role="radiogroup"
        aria-label={t("timing.photoMotionTitle")}
        className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
      >
        {PHOTO_MOTIONS.map((m) => {
          const Icon = MOTION_ICONS[m];
          const selected = photoMotion === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => patchTimeline({ photoMotion: m })}
              className={cn(
                "flex min-h-13 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-[11px] leading-tight transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                selected && "border-primary bg-primary/5 text-primary hover:bg-primary/10",
              )}
            >
              <Icon className={cn("size-4", !selected && "text-muted-foreground")} aria-hidden />
              {t(`motion.${m}`)}
            </button>
          );
        })}
      </div>
    </Section>
  );
}
