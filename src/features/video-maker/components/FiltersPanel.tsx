import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { FilterControls } from "@/components/common/FilterControls";
import { LabeledValue, Section } from "@/components/common/Section";
import { Slider } from "@/components/ui/slider";
import { MAX_LETTERBOX } from "@/engine/render/effects";

import { useProject } from "../hooks";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "../store";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Efeitos do vídeo inteiro: barras de cinema e pulso de zoom nas batidas. */
function EffectsSection() {
  const { t } = useTranslation();
  const effects = useProject((s) => s.effects);
  const hasBeats = useStore(videoMusicStore, (s) => s.status === "ready" && (s.analysis?.beats.length ?? 0) > 0);
  const { patchEffects } = videoProjectStore.getState();

  return (
    <Section title={t("effects.title")} description={t("effects.description")}>
      <div className="space-y-5">
        <LabeledValue
          label={t("effects.letterbox")}
          value={effects.letterbox > 0 ? pct(effects.letterbox / MAX_LETTERBOX) : t("effects.off")}
        >
          <Slider
            min={0}
            max={MAX_LETTERBOX}
            step={0.01}
            value={[effects.letterbox]}
            onValueChange={([v]) => v !== undefined && patchEffects({ letterbox: v })}
            aria-label={t("effects.letterbox")}
          />
        </LabeledValue>
        <div>
          <LabeledValue
            label={t("effects.beatPulse")}
            value={effects.beatPulse > 0 ? pct(effects.beatPulse) : t("effects.off")}
          >
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[effects.beatPulse]}
              onValueChange={([v]) => v !== undefined && patchEffects({ beatPulse: v })}
              aria-label={t("effects.beatPulse")}
            />
          </LabeledValue>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(hasBeats ? "effects.beatPulseHint" : "effects.beatPulseNoMusic")}
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Ferramenta "Filtros": filtro de cor e efeitos para o vídeo inteiro (prévia e exportação). */
export function FiltersPanel() {
  const { t } = useTranslation();
  const filter = useProject((s) => s.filter);
  const { patchFilter, setFilterAdjust, resetFilter } = videoProjectStore.getState();
  // Miniaturas dos presets: a primeira mídia do projeto que já tem thumbnail.
  const sampleUrl = useStore(videoMediaStore, (s) => {
    for (const id of s.order) {
      const url = s.items[id]?.thumbUrl;
      if (url) return url;
    }
    return undefined;
  });

  return (
    <div className="@container space-y-3 sm:space-y-4">
      <FilterControls
        filter={filter}
        title={t("videoFilters.title")}
        description={t("videoFilters.description")}
        sampleUrl={sampleUrl}
        onPatch={patchFilter}
        onAdjust={setFilterAdjust}
        onReset={resetFilter}
      />
      <EffectsSection />
    </div>
  );
}
