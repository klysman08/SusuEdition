import { useTranslation } from "react-i18next";

import { LabeledValue, Section } from "@/components/common/Section";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import { useProject } from "../hooks";
import { videoProjectStore } from "../store";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Ferramenta "Áudio": som original dos vídeos e volumes da mixagem. */
export function AudioPanel() {
  const { t } = useTranslation();
  const keepVideoAudio = useProject((s) => s.timeline.keepVideoAudio);
  const mix = useProject((s) => s.mix);
  const { patchTimeline, patchMix } = videoProjectStore.getState();

  const volume = (key: "musicGain" | "videoGain" | "duckingGain", label: string) => (
    <LabeledValue label={label} value={pct(mix[key])}>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={[mix[key]]}
        onValueChange={([v]) => v !== undefined && patchMix({ [key]: v })}
        aria-label={label}
      />
    </LabeledValue>
  );

  return (
    <Section title={t("timing.audioTitle")}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="keep-video-audio">{t("timing.keepVideoAudio")}</Label>
          <Switch
            id="keep-video-audio"
            checked={keepVideoAudio}
            onCheckedChange={(v) => patchTimeline({ keepVideoAudio: v })}
          />
        </div>
        {volume("musicGain", t("timing.musicVolume"))}
        {volume("videoGain", t("timing.videoVolume"))}
        {volume("duckingGain", t("timing.ducking"))}
      </div>
    </Section>
  );
}
