import { createStore, type StoreApi } from "zustand/vanilla";

import { defaultSelection, type AudioAnalysis, type Selection } from "@/engine/audio";
import { trackMediaUsage } from "@/platform/media/usage";

export interface MusicTrack {
  id: string;
  name: string;
  size: number;
  /** URL reproduzível pelo WebView (`susu://media/<id>` ou blob:). */
  url: string;
}

export type MusicStatus = "idle" | "loading" | "ready" | "error";

export interface MusicState {
  track: MusicTrack | null;
  status: MusicStatus;
  error?: string;
  analysis: AudioAnalysis | null;
  selection: Selection | null;
  /** "Grudar" as bordas do trecho nas batidas. */
  snapToBeats: boolean;

  startLoading: (track: MusicTrack) => void;
  setAnalysis: (analysis: AudioAnalysis) => void;
  setError: (error: string) => void;
  setSelection: (selection: Selection) => void;
  setSnapToBeats: (on: boolean) => void;
  clear: () => void;
}

export type MusicStore = StoreApi<MusicState>;

export function createMusicStore(): MusicStore {
  const store = createStore<MusicState>()((set) => ({
    track: null,
    status: "idle",
    analysis: null,
    selection: null,
    snapToBeats: true,

    startLoading: (track) => set({ track, status: "loading", error: undefined, analysis: null, selection: null }),
    setAnalysis: (analysis) =>
      set({ analysis, status: "ready", selection: defaultSelection(analysis.durationSec, analysis.beats) }),
    setError: (error) => set({ status: "error", error }),
    setSelection: (selection) => set({ selection }),
    setSnapToBeats: (snapToBeats) => set({ snapToBeats }),
    clear: () => set({ track: null, status: "idle", error: undefined, analysis: null, selection: null }),
  }));
  trackMediaUsage(() => {
    const id = store.getState().track?.id;
    return id ? [id] : [];
  });
  return store;
}
