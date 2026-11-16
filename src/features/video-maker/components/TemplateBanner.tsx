import { Check, Music2, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { loadMusic } from "@/features/music";
import { clearTemplate } from "@/features/templates/apply";
import { isTemplateId, TEMPLATES } from "@/features/templates/catalog";
import { getMediaBackend } from "@/platform/media";

import { useProject } from "../hooks";
import { videoMusicStore } from "../store";

/**
 * Projeto vazio criado a partir de um template: diz qual é, deixa escolher a música (as
 * batidas guiam os cortes) e lembra que basta adicionar as mídias.
 */
export function TemplateBanner() {
  const { t } = useTranslation();
  const templateId = useProject((s) => s.templateId);
  const track = useStore(videoMusicStore, (s) => s.track);
  const analyzing = useStore(videoMusicStore, (s) => s.status === "loading");
  if (!isTemplateId(templateId)) return null;
  const wantsBeats = TEMPLATES[templateId].timeline.beatSync?.enabled !== false;

  const pickMusic = async () => {
    const backend = await getMediaBackend();
    const result = await loadMusic(videoMusicStore, backend, await backend.pickAudio());
    if (result === "unsupported") toast.warning(t("music.unsupported"));
    else if (result === "error") toast.error(t("music.error"), { description: videoMusicStore.getState().error });
  };

  return (
    <section
      aria-label={t("templates.banner.label")}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold">
          {t("templates.banner.title", { name: t(`templates.items.${templateId}.name`) })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(wantsBeats ? "templates.banner.hintBeats" : "templates.banner.hint")}
        </p>
      </div>
      <Button variant={track ? "secondary" : "outline"} size="sm" onClick={() => void pickMusic()} className="min-w-0">
        {track && !analyzing ? <Check /> : <Music2 />}
        <span className="max-w-40 truncate">
          {track ? (analyzing ? t("music.analyzing") : track.name) : t("music.choose")}
        </span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("templates.banner.remove")}
        title={t("templates.banner.remove")}
        onClick={() => void clearTemplate()}
      >
        <X />
      </Button>
    </section>
  );
}
