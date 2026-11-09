import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LabeledValue, Section } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { useCollage } from "../hooks";
import { collageProjectStore } from "../store";

const SWATCHES = ["#ffffff", "#f4f1ea", "#000000", "#18181b", "#f43f5e", "#a855f7", "#0ea5e9", "#22c55e", "#f59e0b"];

/** Passo "Margens": margem externa, espaçamento, cantos e fundo (RF-C4). */
export function StylePanel() {
  const { t } = useTranslation();
  const margin = useCollage((s) => s.margin);
  const spacing = useCollage((s) => s.spacing);
  const radius = useCollage((s) => s.radius);
  const background = useCollage((s) => s.background);
  const { patch } = collageProjectStore.getState();
  const changed = margin !== 0 || spacing !== 0 || radius !== 0;
  const px = (v: number) => `${Math.round(v)} px`;

  return (
    <div className="space-y-4">
      <Section
        title={t("collage.spacingTitle")}
        description={t("collage.spacingDescription")}
        action={
          changed && (
            <Button variant="ghost" size="sm" onClick={() => patch({ margin: 0, spacing: 0, radius: 0 })}>
              <RotateCcw />
              {t("collage.reset")}
            </Button>
          )
        }
      >
        <div className="space-y-6">
          <LabeledValue label={t("collage.margin")} value={px(margin)}>
            <Slider min={0} max={120} step={1} value={[margin]} onValueChange={([v]) => patch({ margin: v ?? 0 })} />
          </LabeledValue>
          <LabeledValue label={t("collage.spacing")} value={px(spacing)}>
            <Slider min={0} max={80} step={1} value={[spacing]} onValueChange={([v]) => patch({ spacing: v ?? 0 })} />
          </LabeledValue>
          <LabeledValue label={t("collage.radius")} value={px(radius)}>
            <Slider min={0} max={120} step={1} value={[radius]} onValueChange={([v]) => patch({ radius: v ?? 0 })} />
          </LabeledValue>
        </div>
      </Section>

      <Section title={t("collage.backgroundTitle")} description={t("collage.backgroundDescription")}>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === background}
              onClick={() => patch({ background: c })}
              className={cn(
                "size-8 rounded-full ring-1 ring-border transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                c === background && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
              style={{ background: c }}
            />
          ))}
          <label
            className={cn(
              "relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-1 ring-border",
              !SWATCHES.includes(background) && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            )}
          >
            <span className="sr-only">{t("format.customColor")}</span>
            <input
              type="color"
              value={background}
              onChange={(e) => patch({ background: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </Section>
    </div>
  );
}
