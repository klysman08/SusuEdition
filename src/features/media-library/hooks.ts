import { useLayoutEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { MediaLibraryState, MediaLibraryStore } from "./store";

export function useLibrary<T>(store: MediaLibraryStore, selector: (s: MediaLibraryState) => T): T {
  return useStore(store, selector);
}

export function useLibraryShallow<T>(store: MediaLibraryStore, selector: (s: MediaLibraryState) => T): T {
  return useStore(store, useShallow(selector));
}

/** Largura de um elemento, atualizada por ResizeObserver. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
