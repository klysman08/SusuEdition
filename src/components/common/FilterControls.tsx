import { RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { LabeledValue, Section } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { createCollageRenderer, cropWindow, DEFAULT_CROP } from "@/engine/collage";
import {
  FILTER_KEYS,
  FILTER_PRESET_IDS,
  isNeutralFilter,
  NEUTRAL_ADJUST,
  resolveFilter,
  SIGNED_KEYS,
  type FilterAdjust,
  type FilterPresetId,
  type FilterSettings,
} from "@/engine/render/filters";
import { cn } from "@/lib/utils";

const THUMB = 72;

/**
 * Miniaturas dos presets aplicadas a uma imagem de exemplo: um único contexto WebGL
 * desenha cada preset e copia para um canvas 2D pequeno.
 */
function usePresetThumbs(
  sampleUrl: string | undefined,
  canvases: React.RefObject<Map<FilterPresetId, HTMLCanvasElement>>,
) {
  useEffect(() => {
    if (!sampleUrl) return;
    let alive = true;
    void (async () => {
      const blob = await (await fetch(sampleUrl)).blob();
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      if (!alive) return bmp.close();
      const gl = document.createElement("canvas");
      const size = { width: THUMB * 2, height: THUMB * 2 };
      let renderer;
      try {
        renderer = createCollageRenderer(gl, { preserveDrawingBuffer: true });
      } catch {
        return bmp.close();
      }
      const window_ = cropWindow({ width: bmp.width, height: bmp.height }, size, DEFAULT_CROP);
      for (const id of FILTER_PRESET_IDS) {
        const target = canvases.current.get(id);
        if (!target) continue;
        renderer.render({
          size,
          background: "#000000",
          radius: 0,
          cells: [{ rect: { x: 0, y: 0, w: size.width, h: size.height }, key: "thumb", source: bmp, window: window_ }],
          filter: resolveFilter({ preset: id, intensity: 1, adjust: NEUTRAL_ADJUST }),
        });
        target.width = size.width;
        target.height = size.height;
        target.getContext("2d")?.drawImage(gl, 0, 0);
      }
      renderer.dispose({ releaseContext: true });
      bmp.close();
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [sampleUrl, canvases]);
}

/**
 * Filtro de cor global: presets com intensidade + ajustes finos somados por cima.
 * Usado pela colagem (RF-C6) e pelo Video Maker (filtro do vídeo inteiro).
 */
export function FilterControls({
  filter,
  title,
  description,
  sampleUrl,
  onPatch,
  onAdjust,
  onReset,
}: {
  filter: FilterSettings;
  title: string;
  description: string;
  /** Imagem usada nas miniaturas dos presets (ex.: a primeira mídia do projeto). */
  sampleUrl?: string;
  onPatch: (patch: Partial<Omit<FilterSettings, "adjust">>) => void;
  onAdjust: (key: keyof FilterAdjust, value: number) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const canvases = useRef(new Map<FilterPresetId, HTMLCanvasElement>());
  usePresetThumbs(sampleUrl, canvases);
  const active = !isNeutralFilter(resolveFilter(filter));

  return (
    <div className="space-y-4">
      <Section
        title={title}
        description={description}
        action={
          active && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw />
              {t("filters.reset")}
            </Button>
          )
        }
      >
        <div
          role="radiogroup"
          aria-label={title}
          className="-mx-1 flex snap-x [scrollbar-width:thin] gap-2 overflow-x-auto px-1 pt-1 pb-2"
        >
          {FILTER_PRESET_IDS.map((id) => {
            const on = filter.preset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onPatch({ preset: id, intensity: on ? filter.intensity : 1 })}
                className="group flex shrink-0 snap-start flex-col items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "block overflow-hidden rounded-lg ring-1 ring-border transition-all",
                    on ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "group-hover:ring-foreground/40",
                  )}
                  style={{ width: THUMB, height: THUMB }}
                >
                  {sampleUrl ? (
                    <canvas
                      ref={(el) => {
                        if (el) canvases.current.set(id, el);
                        else canvases.current.delete(id);
                      }}
                      className="size-full bg-muted"
                    />
                  ) : (
                    <span className="block size-full bg-gradient-to-br from-amber-300 via-rose-400 to-violet-500" />
                  )}
                </span>
                <span className={cn("text-xs", on ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {t(`filters.presets.${id}`)}
                </span>
              </button>
            );
          })}
        </div>
        {filter.preset !== "none" && (
          <div className="mt-4">
            <LabeledValue label={t("filters.intensity")} value={`${Math.round(filter.intensity * 100)}%`}>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[filter.intensity]}
                onValueChange={([v]) => onPatch({ intensity: v ?? 1 })}
                aria-label={t("filters.intensity")}
              />
            </LabeledValue>
          </div>
        )}
      </Section>

      <Section title={t("filters.adjustTitle")} description={t("filters.adjustDescription")}>
        <div className="grid gap-x-8 gap-y-6 @md:grid-cols-2">
          {FILTER_KEYS.map((key) => {
            const v = filter.adjust[key];
            const signed = SIGNED_KEYS.has(key);
            const label = `${v > 0 && signed ? "+" : ""}${Math.round(v * 100)}`;
            return (
              <LabeledValue key={key} label={t(`filters.adjust.${key}`)} value={label}>
                <Slider
                  min={signed ? -1 : 0}
                  max={1}
                  step={0.01}
                  value={[v]}
                  onValueChange={([x]) => onAdjust(key, x ?? 0)}
                  onDoubleClick={() => onAdjust(key, 0)}
                  aria-label={t(`filters.adjust.${key}`)}
                />
              </LabeledValue>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
