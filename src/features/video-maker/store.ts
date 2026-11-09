import { createMediaLibraryStore } from "@/features/media-library";
import { createMusicStore } from "@/features/music";

import { createVideoProjectStore } from "./project-store";

/**
 * Estado do projeto de vídeo atual. Vive no módulo para sobreviver à navegação
 * entre páginas; projetos salvos/autosave chegam no M7.
 */
export const videoMediaStore = createMediaLibraryStore();

/** Música do projeto de vídeo atual (faixa, análise e trecho escolhido). */
export const videoMusicStore = createMusicStore();

/** Formato, tempos, volumes e ajustes por mídia. */
export const videoProjectStore = createVideoProjectStore();
