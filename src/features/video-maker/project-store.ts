import { createStore, type StoreApi } from "zustand/vanilla";

import { DEFAULT_AUDIO_MIX, type AudioMix } from "@/engine/audio";
import { DEFAULT_FILTER, NEUTRAL_ADJUST, type FilterAdjust, type FilterSettings } from "@/engine/render/filters";
import { DEFAULT_TIMELINE_SETTINGS, type ClipOverrides, type TimelineSettings } from "@/engine/timeline";
import type { AspectRatio, FitBackground, FitMode, FrameRate, QualityPreset } from "@/engine/types";

/** Tudo o que define o vídeo além das mídias e da música — é o que vai para o arquivo do projeto. */
export interface VideoProjectSettings {
  aspect: AspectRatio;
  fit: FitMode;
  background: FitBackground;
  timeline: TimelineSettings;
  mix: AudioMix;
  /** Ajustes por mídia (duração, enquadramento, trecho e áudio dos vídeos). */
  overrides: Record<string, ClipOverrides>;
  /** Filtro de cor aplicado ao vídeo inteiro. */
  filter: FilterSettings;
  exportQuality: QualityPreset;
  exportFps: FrameRate;
  /** Desktop: perguntar onde salvar (senão vai para Vídeos/SusuEdition). */
  askDestination: boolean;
}

export interface VideoProjectState extends VideoProjectSettings {
  setAspect: (aspect: AspectRatio) => void;
  setFit: (fit: FitMode) => void;
  setBackground: (background: FitBackground) => void;
  patchTimeline: (patch: Partial<TimelineSettings>) => void;
  patchMix: (patch: Partial<AudioMix>) => void;
  patchOverride: (id: string, patch: Partial<ClipOverrides>) => void;
  clearOverride: (id: string) => void;
  patchFilter: (patch: Partial<Omit<FilterSettings, "adjust">>) => void;
  setFilterAdjust: (key: keyof FilterAdjust, value: number) => void;
  resetFilter: () => void;
  setExport: (patch: Partial<Pick<VideoProjectState, "exportQuality" | "exportFps" | "askDestination">>) => void;
  /** Carrega um projeto salvo (campos ausentes ficam no padrão). */
  hydrate: (settings: Partial<VideoProjectSettings>) => void;
  /** Volta tudo ao padrão (novo projeto). */
  reset: () => void;
}

export type VideoProjectStore = StoreApi<VideoProjectState>;

export const DEFAULT_VIDEO_PROJECT: VideoProjectSettings = {
  aspect: "9:16",
  fit: "fit",
  background: { kind: "blur", strength: 1 },
  timeline: DEFAULT_TIMELINE_SETTINGS,
  mix: DEFAULT_AUDIO_MIX,
  overrides: {},
  filter: DEFAULT_FILTER,
  exportQuality: "1080p",
  exportFps: 30,
  askDestination: false,
};

export const PROJECT_SETTING_KEYS = Object.keys(DEFAULT_VIDEO_PROJECT) as (keyof VideoProjectSettings)[];

/** Só os dados do projeto (sem as ações do store). */
export function pickSettings(state: VideoProjectSettings): VideoProjectSettings {
  return Object.fromEntries(PROJECT_SETTING_KEYS.map((k) => [k, state[k]])) as unknown as VideoProjectSettings;
}

/**
 * Completa um projeto salvo com os padrões atuais: arquivos de versões antigas (ou
 * editados à mão) nunca deixam o editor com campos faltando.
 */
export function withDefaults(saved: Partial<VideoProjectSettings>): VideoProjectSettings {
  const d = DEFAULT_VIDEO_PROJECT;
  return {
    ...d,
    ...saved,
    timeline: {
      ...d.timeline,
      ...saved.timeline,
      beatSync: { ...d.timeline.beatSync, ...saved.timeline?.beatSync },
    },
    mix: { ...d.mix, ...saved.mix },
    overrides: { ...saved.overrides },
    filter: {
      ...d.filter,
      ...saved.filter,
      adjust: { ...NEUTRAL_ADJUST, ...saved.filter?.adjust },
    },
  };
}

/** Remove chaves `undefined` para que "voltar ao padrão" não deixe lixo no objeto. */
function compact(o: ClipOverrides): ClipOverrides {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as ClipOverrides;
}

export function createVideoProjectStore(): VideoProjectStore {
  return createStore<VideoProjectState>()((set) => ({
    ...DEFAULT_VIDEO_PROJECT,

    setAspect: (aspect) => set({ aspect }),
    setFit: (fit) => set({ fit }),
    setBackground: (background) => set({ background }),
    patchTimeline: (patch) => set((s) => ({ timeline: { ...s.timeline, ...patch } })),
    patchMix: (patch) => set((s) => ({ mix: { ...s.mix, ...patch } })),
    patchOverride: (id, patch) =>
      set((s) => {
        const next = compact({ ...s.overrides[id], ...patch });
        const overrides = { ...s.overrides };
        if (Object.keys(next).length === 0) delete overrides[id];
        else overrides[id] = next;
        return { overrides };
      }),
    setExport: (patch) => set(patch),
    clearOverride: (id) =>
      set((s) => {
        if (!s.overrides[id]) return s;
        const overrides = { ...s.overrides };
        delete overrides[id];
        return { overrides };
      }),
    patchFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
    setFilterAdjust: (key, value) =>
      set((s) => ({ filter: { ...s.filter, adjust: { ...s.filter.adjust, [key]: value } } })),
    resetFilter: () => set({ filter: DEFAULT_FILTER }),
    hydrate: (settings) => set(withDefaults(settings)),
    reset: () => set(DEFAULT_VIDEO_PROJECT),
  }));
}
