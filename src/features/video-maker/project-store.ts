import { createStore, type StoreApi } from "zustand/vanilla";

import { DEFAULT_AUDIO_MIX, type AudioMix } from "@/engine/audio";
import { DEFAULT_TIMELINE_SETTINGS, type ClipOverrides, type TimelineSettings } from "@/engine/timeline";
import type { AspectRatio, FitBackground, FitMode, FrameRate, QualityPreset } from "@/engine/types";

export interface VideoProjectState {
  aspect: AspectRatio;
  fit: FitMode;
  background: FitBackground;
  timeline: TimelineSettings;
  mix: AudioMix;
  /** Ajustes por mídia (duração, enquadramento, trecho e áudio dos vídeos). */
  overrides: Record<string, ClipOverrides>;
  exportQuality: QualityPreset;
  exportFps: FrameRate;
  /** Desktop: perguntar onde salvar (senão vai para Vídeos/SusuEdition). */
  askDestination: boolean;

  setAspect: (aspect: AspectRatio) => void;
  setFit: (fit: FitMode) => void;
  setBackground: (background: FitBackground) => void;
  patchTimeline: (patch: Partial<TimelineSettings>) => void;
  patchMix: (patch: Partial<AudioMix>) => void;
  patchOverride: (id: string, patch: Partial<ClipOverrides>) => void;
  clearOverride: (id: string) => void;
  setExport: (patch: Partial<Pick<VideoProjectState, "exportQuality" | "exportFps" | "askDestination">>) => void;
}

export type VideoProjectStore = StoreApi<VideoProjectState>;

/** Remove chaves `undefined` para que "voltar ao padrão" não deixe lixo no objeto. */
function compact(o: ClipOverrides): ClipOverrides {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as ClipOverrides;
}

export function createVideoProjectStore(): VideoProjectStore {
  return createStore<VideoProjectState>()((set) => ({
    aspect: "9:16",
    fit: "fit",
    background: { kind: "blur", strength: 1 },
    timeline: DEFAULT_TIMELINE_SETTINGS,
    mix: DEFAULT_AUDIO_MIX,
    overrides: {},
    exportQuality: "1080p",
    exportFps: 30,
    askDestination: false,

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
  }));
}
