import { RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

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
  type FilterPresetId,
} from "@/engine/render";
import { cn } from "@/lib/utils";

import { useCollage, useCollagePhotos } from "../hooks";
import { collageMediaStore, collageProjectStore } from "../store";

const THUMB = 72;

/**
 * Miniaturas dos presets aplicadas à primeira foto: um único contexto WebGL
 * desenha cada preset e copia para um canvas 2D pequeno.
 */
function usePresetThumbs(canvases: React.RefObject<Map<FilterPresetId, HTMLCanvasElement>>) {
  const firstId = useCollagePhotos()[0]?.id;
  const thumbUrl = useStore(collageMediaStore, (s) => (firstId ? s.items[firstId]?.thumbUrl : undefined));

  useEffect(() => {
    if (!thumbUrl) return;
    let alive = true;
    void (async () => {
      const blob = await (await fetch(thumbUrl)).blob();
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
  }, [thumbUrl, canvases]);

  return !!firstId;
}

/** Passo "Filtros": presets com intensidade + ajustes finos, sobre a colagem inteira (RF-C6). */
export function FiltersPanel() {
  const { t } = useTranslation();
  const filter = useCollage((s) => s.filter);
  const { patchFilter, setAdjust, resetFilter } = collageProjectStore.getState();
  const canvases = useRef(new Map<FilterPresetId, HTMLCanvasElement>());
  const hasPhoto = usePresetThumbs(canvases);
  const active = !isNeutralFilter(resolveFilter(filter));

  return (
    <div className="space-y-4">
      <Section
        title={t("collage.filtersTitle")}
        description={t("collage.filtersDescription")}
        action={
          active && (
            <Button variant="ghost" size="sm" onClick={resetFilter}>
              <RotateCcw />
              {t("collage.reset")}
            </Button>
          )
        }
      >
        <div
          role="radiogroup"
          aria-label={t("collage.filtersTitle")}
          className="-mx-1 flex snap-x [scrollbar-width:thin] gap-2 overflow-x-auto px-1 pb-2"
        >
          {FILTER_PRESET_IDS.map((id) => {
            const on = filter.preset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => patchFilter({ preset: id, intensity: on ? filter.intensity : 1 })}
                className="group flex shrink-0 snap-start flex-col items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "block overflow-hidden rounded-lg ring-1 ring-border transition-all",
                    on ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "group-hover:ring-foreground/40",
                  )}
                  style={{ width: THUMB, height: THUMB }}
                >
                  {hasPhoto ? (
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
                  {t(`collage.presets.${id}`)}
                </span>
              </button>
            );
          })}
        </div>
        {filter.preset !== "none" && (
          <div className="mt-4">
            <LabeledValue label={t("collage.intensity")} value={`${Math.round(filter.intensity * 100)}%`}>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[filter.intensity]}
                onValueChange={([v]) => patchFilter({ intensity: v ?? 1 })}
              />
            </LabeledValue>
          </div>
        )}
      </Section>

      <Section title={t("collage.adjustTitle")} description={t("collage.adjustDescription")}>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FILTER_KEYS.map((key) => {
            const v = filter.adjust[key];
            const signed = SIGNED_KEYS.has(key);
            const label = `${v > 0 && signed ? "+" : ""}${Math.round(v * 100)}`;
            return (
              <LabeledValue key={key} label={t(`collage.adjust.${key}`)} value={label}>
                <Slider
                  min={signed ? -1 : 0}
                  max={1}
                  step={0.01}
                  value={[v]}
                  onValueChange={([x]) => setAdjust(key, x ?? 0)}
                  onDoubleClick={() => setAdjust(key, 0)}
                />
              </LabeledValue>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
