import { createMediaLibraryStore } from "@/features/media-library";

/**
 * Mídias do projeto de vídeo atual. Vive no módulo para sobreviver à navegação
 * entre páginas; projetos salvos/autosave chegam no M7.
 */
export const videoMediaStore = createMediaLibraryStore();
