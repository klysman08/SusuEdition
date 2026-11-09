import { createStore, type StoreApi } from "zustand/vanilla";

import {
  clampCrop,
  isDefaultCrop,
  type CellCrop,
  type CollageDesign,
  type CollageQuality,
  type ImageFormat,
} from "@/engine/collage";
import { DEFAULT_FILTER, type FilterAdjust, type FilterSettings } from "@/engine/render";

export interface CollageProjectState extends CollageDesign {
  exportFormat: ImageFormat;
  /** JPEG, 0.6..1 */
  jpegQuality: number;
  exportQuality: CollageQuality;
  /** Desktop: perguntar onde salvar (senão vai para Imagens/SusuEdition). */
  askDestination: boolean;

  patch: (patch: Partial<Omit<CollageDesign, "crops" | "filter">>) => void;
  setCrop: (id: string, crop: CellCrop | null) => void;
  patchFilter: (patch: Partial<Omit<FilterSettings, "adjust">>) => void;
  setAdjust: (key: keyof FilterAdjust, value: number) => void;
  resetFilter: () => void;
  setExport: (
    patch: Partial<Pick<CollageProjectState, "exportFormat" | "jpegQuality" | "exportQuality" | "askDestination">>,
  ) => void;
}

export type CollageProjectStore = StoreApi<CollageProjectState>;

export const DEFAULT_DESIGN: CollageDesign = {
  aspect: "4:5",
  layoutId: "auto",
  margin: 0,
  spacing: 0,
  radius: 0,
  background: "#ffffff",
  crops: {},
  filter: DEFAULT_FILTER,
};

export function createCollageProjectStore(): CollageProjectStore {
  return createStore<CollageProjectState>()((set) => ({
    ...DEFAULT_DESIGN,
    exportFormat: "jpeg",
    jpegQuality: 0.92,
    exportQuality: "high",
    askDestination: false,

    patch: (patch) => set(patch),
    setCrop: (id, crop) =>
      set((s) => {
        const crops = { ...s.crops };
        if (!crop || isDefaultCrop(crop)) delete crops[id];
        else crops[id] = crop;
        return { crops };
      }),
    patchFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
    setAdjust: (key, value) => set((s) => ({ filter: { ...s.filter, adjust: { ...s.filter.adjust, [key]: value } } })),
    resetFilter: () => set({ filter: DEFAULT_FILTER }),
    setExport: (patch) => set(patch),
  }));
}

/** Enquadramento válido para a célula atual (ou `null` se for o padrão). */
export function normalizedCrop(
  src: { width: number; height: number },
  cell: { width: number; height: number },
  crop: CellCrop,
) {
  const c = clampCrop(src, cell, crop);
  return isDefaultCrop(c) ? null : c;
}
