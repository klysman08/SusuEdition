import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { FilterControls } from "@/components/common/FilterControls";

import { useProject } from "../hooks";
import { videoMediaStore, videoProjectStore } from "../store";

/** Ferramenta "Filtros": um filtro de cor para o vídeo inteiro (prévia e exportação). */
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
    <div className="@container">
      <FilterControls
        filter={filter}
        title={t("videoFilters.title")}
        description={t("videoFilters.description")}
        sampleUrl={sampleUrl}
        onPatch={patchFilter}
        onAdjust={setFilterAdjust}
        onReset={resetFilter}
      />
    </div>
  );
}
