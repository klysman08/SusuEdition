import type { Selection } from "@/engine/audio";
import { releaseMedia, type MediaBackend, type PickedMedia, type RegisterOutcome } from "@/platform/media";

import type { MusicStore } from "./store";

export type LoadMusicResult = "ok" | "cancelled" | "unsupported" | "error";

/**
 * Registra o arquivo escolhido e analisa (waveform + batidas). A UI mostra o nome
 * imediatamente e a waveform quando a análise termina.
 */
export async function loadMusic(
  store: MusicStore,
  backend: MediaBackend,
  picked: PickedMedia[],
): Promise<LoadMusicResult> {
  if (picked.length === 0) return "cancelled";
  const [outcome] = await backend.register(picked.slice(0, 1));
  return loadRegistered(store, backend, outcome);
}

/** Música de um projeto salvo. */
export interface SavedMusic {
  id: string;
  uri: string;
  selection: Selection | null;
  snapToBeats: boolean;
}

/**
 * Reabre a música de um projeto salvo pelo caminho guardado e devolve o trecho
 * escolhido (a análise vem do cache, então costuma ser imediato).
 */
export async function restoreMusic(
  store: MusicStore,
  backend: MediaBackend,
  saved: SavedMusic,
  /** `false` se o projeto foi trocado enquanto o arquivo era reaberto. */
  isCurrent: () => boolean = () => true,
): Promise<LoadMusicResult> {
  const [outcome] = await backend.reopen([saved]);
  if (!isCurrent()) return "cancelled";
  const result = await loadRegistered(store, backend, outcome);
  if (result !== "ok" || !isCurrent()) return result;
  const state = store.getState();
  const duration = state.analysis?.durationSec ?? 0;
  const sel = saved.selection;
  if (sel && sel.outSec <= duration + 0.05) state.setSelection({ ...sel, outSec: Math.min(sel.outSec, duration) });
  state.setSnapToBeats(saved.snapToBeats);
  return "ok";
}

async function loadRegistered(
  store: MusicStore,
  backend: MediaBackend,
  outcome: RegisterOutcome | undefined,
): Promise<LoadMusicResult> {
  if (!outcome || outcome.status === "error") {
    store.getState().setError(outcome?.status === "error" ? outcome.error : "unknown");
    return "error";
  }
  // Áudio ou vídeo (a trilha de áudio de MP4/MOV também serve como música).
  if (outcome.kind !== "audio" && outcome.kind !== "video") {
    return "unsupported";
  }

  const previous = store.getState().track;
  store.getState().startLoading({
    id: outcome.id,
    name: outcome.name,
    uri: outcome.uri,
    size: outcome.size,
    url: backend.mediaUrl(outcome.id),
  });
  if (previous && previous.id !== outcome.id) void releaseMedia([previous.id]);

  try {
    const analysis = await backend.analyzeAudio(outcome.id);
    // Usuário trocou de música enquanto analisava? Descarta.
    if (store.getState().track?.id !== outcome.id) return "cancelled";
    store.getState().setAnalysis(analysis);
    return "ok";
  } catch (err) {
    const message = typeof err === "object" && err && "message" in err ? String(err.message) : String(err);
    store.getState().setError(message);
    return "error";
  }
}
