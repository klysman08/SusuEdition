import type { CSSProperties } from "react";

import type { AspectRatio } from "@/engine/types";

function ratio(aspect: AspectRatio): [number, number] {
  const [w, h] = aspect.split(":").map(Number) as [number, number];
  return [w, h];
}

/** Miniatura de um quadro na proporção dada (lado maior = `max` px). */
export function frameStyle(aspect: AspectRatio, max: number): CSSProperties {
  const [w, h] = ratio(aspect);
  const s = max / Math.max(w, h);
  return { width: w * s, height: h * s };
}
