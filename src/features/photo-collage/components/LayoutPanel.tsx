import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AspectPicker } from "@/components/common/AspectPicker";
import { Section } from "@/components/common/Section";
import { layoutCells, layoutsFor, previewSize } from "@/engine/collage";
import { cn } from "@/lib/utils";

import { useCollage, useCollagePhotos } from "../hooks";
import { collageProjectStore } from "../store";

const THUMB = 64;

/** Passo "Layout": proporção e forma da grade (templates conforme a quantidade de fotos). */
export function LayoutPanel() {
  const { t } = useTranslation();
  const aspect = useCollage((s) => s.aspect);
  const layoutId = useCollage((s) => s.layoutId);
  const photos = useCollagePhotos();
  const { patch } = collageProjectStore.getState();

  const thumbSize = useMemo(() => previewSize(aspect, { width: THUMB, height: THUMB }), [aspect]);
  const aspectsKey = photos.map((p) => (p.size.width / p.size.height).toFixed(3)).join(",");
  const templates = useMemo(() => {
    const aspects = aspectsKey ? aspectsKey.split(",").map(Number) : [];
    return layoutsFor(aspects.length > 0 ? aspects : [1, 1, 1, 1], thumbSize);
  }, [aspectsKey, thumbSize]);
  const layoutLabel = (id: string) => {
    const m = /^(rows|cols):(.+)$/.exec(id);
    if (m) return t(`collage.layouts.${m[1] as "rows"}`, { counts: m[2]!.split("-").join(" + ") });
    if (id.startsWith("feature-")) return t(`collage.layouts.${id as "feature-left"}`);
    return id === "grid" ? t("collage.layouts.grid") : t("collage.layouts.auto");
  };
  // O id escolhido pode não existir para a quantidade atual: o motor cai no "auto".
  const active = templates.some((tpl) => tpl.id === layoutId) ? layoutId : "auto";

  return (
    <div className="space-y-4">
      <Section title={t("format.aspectTitle")} description={t("collage.aspectDescription")}>
        <AspectPicker value={aspect} onChange={(a) => patch({ aspect: a })} />
      </Section>

      <Section
        title={t("collage.layoutTitle")}
        description={
          photos.length === 0 ? t("collage.layoutEmpty") : t("collage.layoutDescription", { count: photos.length })
        }
      >
        <div role="radiogroup" aria-label={t("collage.layoutTitle")} className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {templates.map((tpl) => {
            const cells = layoutCells(tpl.node, thumbSize, { margin: 0, gap: 2 });
            const on = tpl.id === active;
            return (
              <button
                key={tpl.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={layoutLabel(tpl.id)}
                title={layoutLabel(tpl.id)}
                onClick={() => patch({ layoutId: tpl.id })}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-lg border p-1.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  on && "border-primary bg-primary/5 hover:bg-primary/10",
                )}
              >
                <span className="relative block" style={{ width: thumbSize.width, height: thumbSize.height }}>
                  {cells.map((c) => (
                    <span
                      key={c.slot}
                      className={cn("absolute rounded-[2px]", on ? "bg-primary/70" : "bg-muted-foreground/35")}
                      style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
                    />
                  ))}
                </span>
                {tpl.id === "auto" && (
                  <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                    <Sparkles className="size-2.5" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {active === "auto" && photos.length > 1 && (
          <p className="mt-3 text-xs text-muted-foreground">{t("collage.layoutAutoHint")}</p>
        )}
      </Section>
    </div>
  );
}
