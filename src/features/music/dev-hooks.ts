import { getMediaBackend, type PickedMedia } from "@/platform/media";

import { loadMusic } from "./load-music";
import type { MusicStore } from "./store";

declare global {
  interface Window {
    __susuMusic?: {
      store: MusicStore;
      /** Carrega um caminho local (app nativo) sem abrir o seletor — testes E2E. */
      loadPath: (path: string) => Promise<string>;
      /** Carrega uma URL (modo navegador). */
      loadUrl: (url: string) => Promise<string>;
    };
  }
}

const enabled = import.meta.env.DEV || import.meta.env.VITE_SUSU_DEBUG === "1";

export function installMusicDevHooks(store: MusicStore): () => void {
  if (!enabled) return () => {};
  const run = async (picked: PickedMedia[]) => loadMusic(store, await getMediaBackend(), picked);
  window.__susuMusic = {
    store,
    loadPath: (path) => run([{ type: "native", uri: path }]),
    loadUrl: async (url) => {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], url.split("/").pop() ?? "music", { type: blob.type, lastModified: Date.now() });
      return run([{ type: "web", file }]);
    },
  };
  return () => {
    delete window.__susuMusic;
  };
}
