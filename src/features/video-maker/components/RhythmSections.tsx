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
  Scissors,
  Shuffle,
  Volume2,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { LabeledValue, Section } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SFX_KINDS, type SfxKind } from "@/engine/audio";
import {
  BEAT_SYNC_PRESETS,
  isTransitionKind,
  MOTION_KINDS,
  TRANSITION_CATEGORIES,
  TRANSITIONS,
  transitionsIn,
  type BeatSyncPreset,
  type MotionKind,
  type TimelineResult,
  type TransitionCategory,
  type TransitionKind,
  type TransitionSound,
} from "@/engine/timeline";
import { cn } from "@/lib/utils";

import { useProject } from "../hooks";
import { playSfx } from "../preview/sfx-player";
import { videoMusicStore, videoProjectStore } from "../store";
import { sameKinds, TRANSITION_ICONS } from "./transition-ui";

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

/** Duração usada quando se escolhe "misturar" um grupo de transições. */
const MIX_DURATION_SEC = 0.45;
const SOUNDS: readonly TransitionSound[] = ["none", "auto", ...SFX_KINDS];

const tile =
  "flex min-h-13 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-[11px] leading-tight transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";
const tileOn = "border-primary bg-primary/5 text-primary hover:bg-primary/10";

/**
 * Transição padrão entre as mídias (cada mídia pode ter a sua): corte seco, uma das
 * transições dos grupos ou "misturar", que alterna entre as de um grupo. Junto vem o
 * efeito sonoro que toca em cada troca.
 */
export function TransitionSection() {
  const { t } = useTranslation();
  const transition = useProject((s) => s.timeline.transition);
  const sound = useProject((s) => s.timeline.transitionSound);
  const sfxGain = useProject((s) => s.mix.sfxGain);
  const { patchTimeline } = videoProjectStore.getState();
  const current: TransitionKind | null =
    transition.kind === "cut" || transition.kind === "mix" ? null : transition.kind;
  const [picked, setPicked] = useState<TransitionCategory | null>(null);
  const group =
    picked ??
    (current
      ? TRANSITIONS[current].category
      : transition.kind === "mix"
        ? (TRANSITION_CATEGORIES.find((c) => sameKinds(transition.kinds, transitionsIn(c))) ??
          TRANSITIONS[transition.kinds.find(isTransitionKind) ?? "fade"].category)
        : "smooth");
  const kinds = transitionsIn(group);
  const mixed = transition.kind === "mix" && sameKinds(transition.kinds, kinds);
  const customMix =
    transition.kind === "mix" && !TRANSITION_CATEGORIES.some((c) => sameKinds(transition.kinds, transitionsIn(c)));
  const duration = transition.kind === "cut" ? 0.5 : transition.durationSec;
  /** Som de exemplo do botão "ouvir": o escolhido ou, no automático, o da transição atual. */
  const audible: SfxKind | null =
    sound === "none" ? null : sound === "auto" ? TRANSITIONS[current ?? kinds[0]!].sound : sound;

  return (
    <Section title={t("timing.transitionTitle")} description={t("timing.transitionHint")}>
      <div className="space-y-4">
        <button
          type="button"
          aria-pressed={transition.kind === "cut"}
          onClick={() => patchTimeline({ transition: { kind: "cut" } })}
          className={cn(tile, "min-h-10 w-full flex-row gap-2 text-sm", transition.kind === "cut" && tileOn)}
        >
          <Scissors className="size-4" aria-hidden />
          {t("timing.transition.cut")}
        </button>

        <ToggleGroup
          type="single"
          variant="outline"
          value={group}
          onValueChange={(v) => v && setPicked(v as TransitionCategory)}
          aria-label={t("timing.transitionGroup")}
          className="w-full"
        >
          {TRANSITION_CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c} className="flex-1 px-1 text-xs">
              {t(`timing.transitionCategory.${c}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div
          role="radiogroup"
          aria-label={t("timing.transitionTitle")}
          className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mixed}
            title={t("timing.transitionMixHint")}
            onClick={() => patchTimeline({ transition: { kind: "mix", kinds, durationSec: MIX_DURATION_SEC } })}
            className={cn(tile, mixed && tileOn)}
          >
            <Shuffle className={cn("size-4", !mixed && "text-muted-foreground")} aria-hidden />
            {t("timing.transition.mix")}
          </button>
          {kinds.map((k) => {
            const Icon = TRANSITION_ICONS[k];
            const selected = current === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => patchTimeline({ transition: { kind: k, durationSec: TRANSITIONS[k].durationSec } })}
                className={cn(tile, selected && tileOn)}
              >
                <Icon className={cn("size-4", !selected && "text-muted-foreground")} aria-hidden />
                {t(`timing.transition.${k}`)}
              </button>
            );
          })}
        </div>

        {customMix && transition.kind === "mix" && (
          <p className="text-xs text-primary">
            {t("timing.transitionMixCustom", {
              list: transition.kinds.map((k) => t(`timing.transition.${k}`)).join(" · "),
            })}
          </p>
        )}

        {transition.kind !== "cut" && (
          <LabeledValue label={t("timing.transitionDuration")} value={secs(duration)}>
            <Slider
              min={0.2}
              max={2}
              step={0.05}
              value={[duration]}
              onValueChange={([v]) =>
                v !== undefined && patchTimeline({ transition: { ...transition, durationSec: v } })
              }
              aria-label={t("timing.transitionDuration")}
            />
          </LabeledValue>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="transition-sound" className="text-sm font-normal">
            {t("timing.soundTitle")}
          </Label>
          <div className="flex items-center gap-2">
            <Select value={sound} onValueChange={(v) => patchTimeline({ transitionSound: v as TransitionSound })}>
              <SelectTrigger id="transition-sound" className="min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUNDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`sfx.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              disabled={!audible}
              aria-label={t("timing.soundPreview")}
              title={t("timing.soundPreview")}
              onClick={() => audible && playSfx(audible, Math.max(0.3, sfxGain))}
            >
              <Volume2 />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(sound === "auto" ? "timing.soundAutoHint" : "timing.soundHint")}
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Movimento padrão das fotos (cada mídia pode ter o seu nos ajustes dela). */
export function PhotoMotionSection() {
  const { t } = useTranslation();
  const photoMotion = useProject((s) => s.timeline.photoMotion);
  const onVideos = useProject((s) => s.timeline.motionOnVideos);
  const { patchTimeline } = videoProjectStore.getState();

  return (
    <Section title={t("timing.photoMotionTitle")} description={t("timing.photoMotionHint")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label htmlFor="motion-on-videos" className="text-sm font-normal">
          {t("timing.motionOnVideos")}
        </Label>
        <Switch
          id="motion-on-videos"
          checked={onVideos}
          onCheckedChange={(v) => patchTimeline({ motionOnVideos: v })}
        />
      </div>
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
              onClick={() => patchTimeline({ photoMotion: m, motionSet: undefined })}
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
