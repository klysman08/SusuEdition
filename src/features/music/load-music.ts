import type { MediaBackend, PickedMedia } from "@/platform/media";

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
    size: outcome.size,
    url: backend.mediaUrl(outcome.id),
  });
  if (previous && previous.id !== outcome.id) void backend.unregister([previous.id]);

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
