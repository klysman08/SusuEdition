import { createStore } from "zustand/vanilla";

/** Preferências de visualização da faixa do tempo (por dispositivo, não por projeto). */
export interface TimelineUiState {
  /** Altura da faixa de áudio (px). */
  audioHeight: number;
  /** 1 = o vídeo inteiro cabe na largura. */
  zoom: number;
  setAudioHeight: (px: number) => void;
  setZoom: (zoom: number) => void;
}

export const AUDIO_HEIGHT = { min: 24, max: 220, default: 56 } as const;
export const ZOOM = { min: 1, max: 24 } as const;
const KEY = "susu.timelineUi";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function load(): { audioHeight: number; zoom: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { audioHeight?: unknown };
    if (typeof raw.audioHeight === "number") {
      return { audioHeight: clamp(raw.audioHeight, AUDIO_HEIGHT.min, AUDIO_HEIGHT.max), zoom: 1 };
    }
  } catch {
    // preferências ilegíveis: usa o padrão
  }
  return { audioHeight: AUDIO_HEIGHT.default, zoom: 1 };
}

export const timelineUi = createStore<TimelineUiState>()((set) => ({
  ...load(),
  setAudioHeight: (px) => {
    const audioHeight = Math.round(clamp(px, AUDIO_HEIGHT.min, AUDIO_HEIGHT.max));
    set({ audioHeight });
    try {
      localStorage.setItem(KEY, JSON.stringify({ audioHeight }));
    } catch {
      // sem armazenamento: vale só para esta sessão
    }
  },
  setZoom: (zoom) => set({ zoom: clamp(zoom, ZOOM.min, ZOOM.max) }),
}));
