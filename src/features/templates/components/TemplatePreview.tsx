import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import type { VideoTemplate } from "../catalog";
import { attachTemplatePreview, PREVIEW_SIZE } from "../preview/preview-renderer";

/**
 * Prévia animada de um template (o template de verdade, sobre imagens de exemplo).
 * Decorativa: o nome e a descrição ficam no cartão.
 */
export function TemplatePreview({ template, className }: { template: VideoTemplate; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return attachTemplatePreview(canvas, template);
  }, [template]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      width={PREVIEW_SIZE.width}
      height={PREVIEW_SIZE.height}
      className={cn("block aspect-[4/5] w-full bg-muted object-cover", className)}
    />
  );
}
