import { useTranslation } from "react-i18next";

import { ASPECT_RATIOS, type AspectRatio } from "@/engine/types";
import { cn } from "@/lib/utils";

import { frameStyle } from "./aspect-frame";

/** Escolha de proporção (9:16, 16:9, 4:3, 1:1, 4:5, 3:4) — Video Maker e Colagem. */
export function AspectPicker({
  value,
  onChange,
  compact = false,
}: {
  value: AspectRatio;
  onChange: (a: AspectRatio) => void;
  /** Painéis estreitos: sempre 3 colunas. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t("format.aspectTitle")}
      className={cn("grid grid-cols-3 gap-2", !compact && "sm:grid-cols-6")}
    >
      {ASPECT_RATIOS.map((a) => {
        const active = a === value;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(a)}
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
  );
}
