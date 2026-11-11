import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { FilterControls } from "@/components/common/FilterControls";

import { useCollage, useCollagePhotos } from "../hooks";
import { collageMediaStore, collageProjectStore } from "../store";

/** Passo "Filtros": presets com intensidade + ajustes finos, sobre a colagem inteira (RF-C6). */
export function FiltersPanel() {
  const { t } = useTranslation();
  const filter = useCollage((s) => s.filter);
  const { patchFilter, setAdjust, resetFilter } = collageProjectStore.getState();
  const firstId = useCollagePhotos()[0]?.id;
  const sampleUrl = useStore(collageMediaStore, (s) => (firstId ? s.items[firstId]?.thumbUrl : undefined));

  return (
    <div className="@container">
      <FilterControls
        filter={filter}
        title={t("collage.filtersTitle")}
        description={t("collage.filtersDescription")}
        sampleUrl={sampleUrl}
        onPatch={patchFilter}
        onAdjust={setAdjust}
        onReset={resetFilter}
      />
    </div>
  );
}
