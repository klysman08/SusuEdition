import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Lista numerada dos passos de um fluxo (Video Maker, Photo Collage). */
export function WorkflowSteps({ steps }: { steps: readonly WorkflowStep[] }) {
  const { t } = useTranslation();

  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="group relative flex gap-4 rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:border-primary/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <step.icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{t("common.step", { n: index + 1 })}</p>
              <Badge variant="secondary">{t("common.comingSoon")}</Badge>
            </div>
            <h3 className="mt-0.5 font-medium">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
