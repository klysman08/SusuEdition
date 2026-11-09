import { getPlatform, isMobilePlatform, isTauri } from "../index";
import { createTauriBackend } from "./tauri-backend";
import type { MediaBackend } from "./types";
import { createWebBackend } from "./web-backend";

export * from "./formats";
export { releaseMedia, trackMediaUsage } from "./usage";
export type * from "./types";

let backend: Promise<MediaBackend> | null = null;

/** Backend de mídia da plataforma atual (singleton). */
export function getMediaBackend(): Promise<MediaBackend> {
  backend ??= (async () => {
    if (!isTauri()) return createWebBackend();
    return createTauriBackend(isMobilePlatform(await getPlatform()));
  })();
  return backend;
}
