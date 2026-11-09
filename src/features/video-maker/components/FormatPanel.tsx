import { Check, Mountain } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fitRect } from "@/engine/render";
import { ASPECT_RATIOS, type AspectRatio, type FitMode } from "@/engine/types";
import { cn } from "@/lib/utils";

import { useProject } from "../hooks";
import { videoProjectStore } from "../store";
import { Section } from "./Section";

const FIT_MODES: FitMode[] = ["fit", "cover", "fill"];
const SWATCHES = ["#000000", "#ffffff", "#18181b", "#f43f5e", "#a855f7", "#0ea5e9", "#f59e0b"];

function ratio(aspect: AspectRatio): [number, number] {
  const [w, h] = aspect.split(":").map(Number) as [number, number];
  return [w, h];
}

/** Miniatura de um quadro na proporção dada (lado maior = `max` px). */
function frameStyle(aspect: AspectRatio, max: number): CSSProperties {
  const [w, h] = ratio(aspect);
  const s = max / Math.max(w, h);
  return { width: w * s, height: h * s };
}

/** Ilustração do modo de enquadramento: uma foto em paisagem dentro do quadro escolhido. */
function FitIllustration({ mode, aspect, blur }: { mode: FitMode; aspect: AspectRatio; blur: boolean }) {
  const frame = frameStyle(aspect, 64);
  const r = fitRect({ width: 16, height: 10 }, { width: Number(frame.width), height: Number(frame.height) }, mode);
  const photo = "bg-gradient-to-br from-amber-300 via-rose-400 to-violet-500";
  return (
    <div className="relative overflow-hidden rounded-[5px] bg-zinc-800 ring-1 ring-border" style={frame}>
      {mode === "fit" && blur && <div className={cn("absolute inset-0 scale-125 opacity-60 blur-sm", photo)} />}
      <div
        className={cn("absolute flex items-end justify-center overflow-hidden", photo)}
        style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
      >
        <Mountain className="mb-[8%] size-1/2 text-white/80" strokeWidth={1.5} aria-hidden />
      </div>
    </div>
  );
}

/** Passo "Formato": proporção, enquadramento e fundo. */
export function FormatPanel() {
  const { t } = useTranslation();
  const aspect = useProject((s) => s.aspect);
  const fit = useProject((s) => s.fit);
  const background = useProject((s) => s.background);
  const { setAspect, setFit, setBackground } = videoProjectStore.getState();
  const color = background.kind === "color" ? background.color : "#000000";

  return (
    <div className="space-y-4">
      <Section title={t("format.aspectTitle")} description={t("format.aspectDescription")}>
        <div role="radiogroup" aria-label={t("format.aspectTitle")} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ASPECT_RATIOS.map((a) => {
            const active = a === aspect;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAspect(a)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  active && "border-primary bg-primary/5 hover:bg-primary/10",
                )}
              >
                <span className="flex h-12 items-center justify-center">
                  <span
                    className={cn(
                      "rounded-[3px] border-2",
                      active ? "border-primary bg-primary/15" : "border-muted-foreground/50",
                    )}
                    style={frameStyle(a, 40)}
                  />
                </span>
                <span className="text-sm font-semibold tabular-nums">{a}</span>
                <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                  {t(`format.aspects.${a.replace(":", "x") as "9x16"}`)}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t("format.fitTitle")} description={t("format.fitDescription")}>
        <div role="radiogroup" aria-label={t("format.fitTitle")} className="grid grid-cols-3 gap-2">
          {FIT_MODES.map((m) => {
            const active = m === fit;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFit(m)}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 rounded-lg border p-3 text-center transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  active && "border-primary bg-primary/5 hover:bg-primary/10",
                )}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                )}
                <span className="flex h-16 items-center">
                  <FitIllustration mode={m} aspect={aspect} blur={background.kind === "blur"} />
                </span>
                <span className="text-sm font-medium">{t(`format.fit.${m}`)}</span>
                <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
                  {t(`format.fitHint.${m}`)}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {fit === "fit" && (
        <Section
          title={t("format.backgroundTitle")}
          action={
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={background.kind}
              onValueChange={(v) => {
                if (v === "blur") setBackground({ kind: "blur", strength: 1 });
                else if (v === "color") setBackground({ kind: "color", color });
              }}
            >
              <ToggleGroupItem value="blur" className="px-3">
                {t("format.background.blur")}
              </ToggleGroupItem>
              <ToggleGroupItem value="color" className="px-3">
                {t("format.background.color")}
              </ToggleGroupItem>
            </ToggleGroup>
          }
        >
          {background.kind === "color" ? (
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={c === color}
                  onClick={() => setBackground({ kind: "color", color: c })}
                  className={cn(
                    "size-8 rounded-full ring-1 ring-border transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                    c === color && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={{ background: c }}
                />
              ))}
              <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-1 ring-border">
                <span className="sr-only">{t("format.customColor")}</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setBackground({ kind: "color", color: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("format.fitHint.fit")}</p>
          )}
        </Section>
      )}
    </div>
  );
}
