/**
 * Janela do app no desktop.
 *
 * No Windows a janela não tem a barra de título do sistema (`decorations: false` em
 * `tauri.windows.conf.json`): o próprio layout desenha os controles (minimizar,
 * maximizar, fechar) e marca as áreas vazias do topo com `data-tauri-drag-region`
 * para arrastar a janela (duplo clique maximiza). No Android e no navegador nada muda.
 */
import { useEffect, useState } from "react";

import { isTauri } from "./index";

let framelessCache: boolean | undefined;

/** `true` quando o app desenha a própria barra da janela (Tauri no Windows). */
export function isFramelessWindow(): boolean {
  if (framelessCache === undefined) {
    // O plugin `os` expõe a plataforma de forma síncrona; o user agent do WebView2 é o
    // plano B (e o caminho dos testes, que não têm o plugin).
    const os = isTauri()
      ? (globalThis as { __TAURI_OS_PLUGIN_INTERNALS__?: { platform?: string } }).__TAURI_OS_PLUGIN_INTERNALS__
          ?.platform
      : undefined;
    framelessCache =
      (isTauri() && (os ? os === "windows" : /Windows/i.test(navigator.userAgent))) || devFramelessPreview();
  }
  return framelessCache;
}

/**
 * Só no `pnpm dev`: `?frameless` na URL mostra o layout da janela do Windows no navegador
 * (para iterar na UI e tirar prints). Os botões da janela não fazem nada fora do Tauri.
 */
function devFramelessPreview(): boolean {
  if (!import.meta.env.DEV || typeof location === "undefined") return false;
  return new URLSearchParams(location.search).has("frameless");
}

/** Atributo que transforma uma área vazia em alça da janela (só onde não há barra do sistema). */
export function dragRegion(): { "data-tauri-drag-region"?: true } {
  return isFramelessWindow() ? { "data-tauri-drag-region": true } : {};
}

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export const windowControls = {
  minimize: async () => {
    if (isTauri()) await (await currentWindow()).minimize();
  },
  toggleMaximize: async () => {
    if (isTauri()) await (await currentWindow()).toggleMaximize();
  },
  close: async () => {
    if (isTauri()) await (await currentWindow()).close();
  },
};

/** Acompanha se a janela está maximizada (para trocar o ícone de maximizar/restaurar). */
export function useWindowMaximized(enabled: boolean): boolean {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!enabled || !isTauri()) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const win = await currentWindow();
      const sync = async () => {
        const value = await win.isMaximized();
        if (alive) setMaximized(value);
      };
      await sync();
      const stop = await win.onResized(() => void sync());
      if (alive) unlisten = stop;
      else stop();
    })();
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [enabled]);
  return maximized;
}
