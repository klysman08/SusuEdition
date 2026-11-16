import {
  AudioWaveform,
  Check,
  Clock,
  Images,
  Loader2,
  Palette,
  RectangleHorizontal,
  Sparkles,
  Volume2,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useStore } from "zustand";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ASPECT_RATIOS, type AspectRatio } from "@/engine/types";
import { projectSession } from "@/features/video-maker/project-session";
import { videoMediaStore } from "@/features/video-maker/store";
import { cn } from "@/lib/utils";

import { applyToCurrentProject, createFromTemplate } from "./apply";
import { TEMPLATE_LIST, type TemplateTag, type VideoTemplate } from "./catalog";
import { TemplatePreview } from "./components/TemplatePreview";

const TAG_ICONS: Record<TemplateTag, LucideIcon> = {
  beat: AudioWaveform,
  fast: Zap,
  calm: Clock,
  sound: Volume2,
  photos: Images,
};
const TAGS = Object.keys(TAG_ICONS) as TemplateTag[];

/** O que o template faz, lido direto dos ajustes dele (nunca fica desatualizado). */
function useTemplateFeatures(template: VideoTemplate | null): { icon: LucideIcon; text: string }[] {
  const { t } = useTranslation();
  return useMemo(() => {
    if (!template) return [];
    const tl = template.timeline;
    const out: { icon: LucideIcon; text: string }[] = [];

    const sync = tl.beatSync;
    out.push({
      icon: AudioWaveform,
      text:
        sync && !sync.enabled
          ? t("templates.feature.noBeat")
          : t("templates.feature.beat", { style: t(`timing.preset.${sync?.preset ?? "dynamic"}`) }),
    });

    const tr = tl.transition;
    if (tr && tr.kind !== "cut") {
      const kinds = tr.kind === "mix" ? [...new Set(tr.kinds)] : [tr.kind];
      out.push({
        icon: Sparkles,
        text: t("templates.feature.transitions", { list: kinds.map((k) => t(`timing.transition.${k}`)).join(", ") }),
      });
    } else {
      out.push({ icon: Sparkles, text: t("templates.feature.cuts") });
    }

    if (tl.photoMotion && tl.photoMotion !== "none") {
      const motions = tl.photoMotion === "auto" ? (tl.motionSet ?? ["zoomIn", "panLeft"]) : [tl.photoMotion];
      const list = [...new Set(motions)].map((m) => t(`motion.${m}`)).join(", ");
      out.push({
        icon: Wand2,
        text: t(tl.motionOnVideos ? "templates.feature.motionAll" : "templates.feature.motion", { list }),
      });
    }

    if (template.filter && template.filter.preset !== "none") {
      out.push({
        icon: Palette,
        text: t("templates.feature.filter", { name: t(`filters.presets.${template.filter.preset}`) }),
      });
    }

    const effects: string[] = [];
    if (template.effects?.letterbox) effects.push(t("effects.letterbox"));
    if (template.effects?.beatPulse) effects.push(t("effects.beatPulse"));
    if (effects.length > 0) {
      out.push({ icon: RectangleHorizontal, text: t("templates.feature.effects", { list: effects.join(", ") }) });
    }

    if (tl.transitionSound && tl.transitionSound !== "none") {
      out.push({ icon: Volume2, text: t("templates.feature.sound", { name: t(`sfx.${tl.transitionSound}`) }) });
    }

    out.push({
      icon: Clock,
      text:
        tl.total?.mode === "custom"
          ? t("templates.feature.total", { seconds: tl.total.seconds })
          : t("templates.feature.pace", {
              photo: (tl.photoDurationSec ?? 2).toLocaleString(),
              video: (tl.videoDurationSec ?? 5).toLocaleString(),
            }),
    });
    return out;
  }, [template, t]);
}

function TemplateCard({ template, onOpen }: { template: VideoTemplate; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card text-left text-card-foreground transition-all outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative w-full overflow-hidden bg-muted">
        <TemplatePreview template={template} />
        <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm">
          {template.aspect}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <h2 className="text-sm font-semibold tracking-tight sm:text-base">
          {t(`templates.items.${template.id}.name`)}
        </h2>
        <p className="flex-1 text-xs text-muted-foreground sm:text-sm">
          {t(`templates.items.${template.id}.description`)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {template.tags.map((tag) => {
            const Icon = TAG_ICONS[tag];
            return (
              <Badge key={tag} variant="secondary">
                <Icon aria-hidden />
                {t(`templates.tags.${tag}`)}
              </Badge>
            );
          })}
        </div>
      </div>
    </button>
  );
}

function TemplateDialog({ template, onClose }: { template: VideoTemplate | null; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const features = useTemplateFeatures(template);
  const hasProject = useStore(videoMediaStore, (s) => s.order.length > 0);
  const projectName = useStore(projectSession, (s) => s.name);
  const [chosen, setChosen] = useState<{ id: string; aspect: AspectRatio } | null>(null);
  const [busy, setBusy] = useState(false);
  // A proporção escolhida vale só para o template em que foi escolhida.
  const aspect = template && chosen?.id === template.id ? chosen.aspect : (template?.aspect ?? "9:16");

  const create = async () => {
    if (!template) return;
    setBusy(true);
    try {
      await createFromTemplate(template, aspect);
      onClose();
      void navigate("/video-maker");
    } catch (err) {
      toast.error(t("templates.error"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const applyHere = () => {
    if (!template) return;
    // Sem escolha explícita, o projeto mantém a proporção que já tem.
    applyToCurrentProject(template, chosen?.id === template.id ? chosen.aspect : undefined);
    toast.success(t("templates.applied", { name: t(`templates.items.${template.id}.name`) }), {
      description: t("templates.appliedHint"),
    });
    onClose();
    void navigate("/video-maker");
  };

  return (
    <Dialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {template && (
          <>
            <DialogHeader>
              <DialogTitle>{t(`templates.items.${template.id}.name`)}</DialogTitle>
              <DialogDescription>{t(`templates.items.${template.id}.description`)}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,13rem)_1fr]">
              <div className="mx-auto w-40 self-start overflow-hidden rounded-xl border sm:w-full">
                <TemplatePreview template={template} />
              </div>

              <div className="min-w-0 space-y-4">
                <div>
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("templates.whatItDoes")}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {features.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex gap-2 text-sm">
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("templates.aspect")}
                  </h3>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={aspect}
                    onValueChange={(v) => v && setChosen({ id: template.id, aspect: v as AspectRatio })}
                    aria-label={t("templates.aspect")}
                    className="mt-2 flex-wrap justify-start"
                  >
                    {ASPECT_RATIOS.map((a) => (
                      <ToggleGroupItem key={a} value={a} className="gap-1 px-2.5 tabular-nums">
                        {a}
                        {a === template.aspect && <Check className="size-3 text-primary" aria-hidden />}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("templates.aspectHint", { aspect: template.aspect })}
                  </p>
                </div>

                <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                  {t("templates.howItWorks")}
                </p>
              </div>
            </div>

            <DialogFooter>
              {hasProject && (
                <Button variant="outline" disabled={busy} onClick={applyHere} className="min-w-0">
                  <span className="truncate">
                    {t("templates.applyToCurrent", { name: projectName || t("projects.untitled") })}
                  </span>
                </Button>
              )}
              <Button disabled={busy} onClick={() => void create()}>
                {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {t("templates.create")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Templates: edições prontas para aplicar. Escolha um, adicione suas fotos e vídeos e o
 * vídeo sai montado — cortes na batida, transições, movimento, filtro e sons.
 */
export function TemplatesPage() {
  const { t } = useTranslation();
  const [tag, setTag] = useState<TemplateTag | "all">("all");
  const [open, setOpen] = useState<VideoTemplate | null>(null);
  const shown = tag === "all" ? TEMPLATE_LIST : TEMPLATE_LIST.filter((tpl) => tpl.tags.includes(tag));

  return (
    <div>
      <PageHeader title={t("templates.title")} subtitle={t("templates.subtitle")} />

      <div role="group" aria-label={t("templates.filter")} className="mb-4 flex flex-wrap gap-1.5 sm:mb-6">
        {(["all", ...TAGS] as const).map((id) => {
          const Icon = id === "all" ? null : TAG_ICONS[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={tag === id}
              onClick={() => setTag(id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                tag === id && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
              )}
            >
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {t(`templates.tags.${id}`)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((tpl) => (
          <TemplateCard key={tpl.id} template={tpl} onOpen={() => setOpen(tpl)} />
        ))}
      </div>

      <TemplateDialog template={open} onClose={() => setOpen(null)} />
    </div>
  );
}
