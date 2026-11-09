import { createMediaLibraryStore } from "@/features/media-library";

import { createCollageProjectStore } from "./project-store";

/**
 * Estado da colagem atual (vive no módulo para sobreviver à navegação).
 * A ordem da biblioteca = ordem das células.
 */
export const collageMediaStore = createMediaLibraryStore();

/** Layout, espaçamento, enquadramentos, filtro e opções de export. */
export const collageProjectStore = createCollageProjectStore();
