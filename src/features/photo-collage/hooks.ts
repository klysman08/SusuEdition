import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { CollageDesign, CollagePhoto } from "@/engine/collage";

import type { CollageProjectState } from "./project-store";
import { collageMediaStore, collageProjectStore } from "./store";

export function useCollage<T>(selector: (s: CollageProjectState) => T): T {
  return useStore(collageProjectStore, selector);
}

/** Só os campos que afetam a imagem. */
export function useCollageDesign(): CollageDesign {
  return useStore(
    collageProjectStore,
    useShallow((s) => ({
      aspect: s.aspect,
      layoutId: s.layoutId,
      margin: s.margin,
      spacing: s.spacing,
      radius: s.radius,
      background: s.background,
      crops: s.crops,
      filter: s.filter,
    })),
  );
}

/** Fotos prontas, na ordem das células (pendentes/erros ficam de fora). */
export function useCollagePhotos(): CollagePhoto[] {
  const order = useStore(collageMediaStore, (s) => s.order);
  const items = useStore(collageMediaStore, (s) => s.items);
  return useMemo(() => {
    const out: CollagePhoto[] = [];
    for (const id of order) {
      const it = items[id];
      if (it?.kind === "image" && it.status === "ready" && it.meta) {
        out.push({ id, size: { width: it.meta.width, height: it.meta.height } });
      }
    }
    return out;
  }, [order, items]);
}
