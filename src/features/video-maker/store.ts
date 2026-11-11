import { createMediaLibraryStore } from "@/features/media-library";
import { createMusicStore } from "@/features/music";

import { createVideoProjectStore } from "./project-store";

/**
 * Estado do projeto de vídeo atual. Vive no módulo para sobreviver à navegação
 * entre páginas; salvar/reabrir e autosave ficam em `project-session.ts`.
 */
export const videoMediaStore = createMediaLibraryStore();

/** Música do projeto de vídeo atual (faixa, análise e trecho escolhido). */
export const videoMusicStore = createMusicStore();

/** Formato, tempos, volumes e ajustes por mídia. */
export const videoProjectStore = createVideoProjectStore();

// Os marcadores manuais são tempos da música: trocar de música os invalida.
videoMusicStore.subscribe((s, p) => {
  if (p.track && s.track && s.track.id !== p.track.id) videoProjectStore.getState().clearMarkers();
});
