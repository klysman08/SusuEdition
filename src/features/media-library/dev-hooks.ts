import type { PickedMedia } from "@/platform/media";

import type { MediaLibraryStore } from "./store";

declare global {
  interface Window {
    __susu?: {
      store: MediaLibraryStore;
      /** Importa caminhos locais (app nativo) sem abrir o seletor — usado nos testes E2E/benchmarks. */
      importPaths: (paths: string[]) => Promise<void>;
      /** Importa URLs (modo navegador) baixando-as como File. */
      importUrls: (urls: string[]) => Promise<void>;
    };
  }
}

const enabled = import.meta.env.DEV || import.meta.env.VITE_SUSU_DEBUG === "1";

/** Ganchos de depuração. Só existem em dev ou com `VITE_SUSU_DEBUG=1`. */
export function installDevHooks(store: MediaLibraryStore, run: (picked: PickedMedia[]) => Promise<void>): () => void {
  if (!enabled) return () => {};
  window.__susu = {
    store,
    importPaths: (paths) => run(paths.map((uri) => ({ type: "native", uri }))),
    importUrls: async (urls) => {
      const files = await Promise.all(
        urls.map(async (url) => {
          const blob = await (await fetch(url)).blob();
          return new File([blob], url.split("/").pop() ?? "file", { type: blob.type, lastModified: Date.now() });
        }),
      );
      await run(files.map((file) => ({ type: "web", file })));
    },
  };
  return () => {
    delete window.__susu;
  };
}
