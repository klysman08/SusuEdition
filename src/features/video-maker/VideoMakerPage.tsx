import { Clock, Download, Images, Music, RectangleVertical, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaLibrary } from "@/features/media-library";
import { MusicPanel } from "@/features/music";

import { videoMediaStore, videoMusicStore } from "./store";

type StepId = "format" | "media" | "music" | "timing" | "export";

const STEPS: { id: StepId; icon: LucideIcon; ready: boolean }[] = [
  { id: "format", icon: RectangleVertical, ready: false },
  { id: "media", icon: Images, ready: true },
  { id: "music", icon: Music, ready: true },
  { id: "timing", icon: Clock, ready: false },
  { id: "export", icon: Download, ready: false },
];

function ComingSoon({ step, icon: Icon }: { step: StepId; icon: LucideIcon }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <p className="font-medium">{t(`videoMaker.steps.${step}.title`)}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t(`videoMaker.steps.${step}.description`)}</p>
      </div>
      <Badge variant="secondary">{t("common.comingSoon")}</Badge>
      <p className="text-xs text-muted-foreground">{t("videoMaker.comingSoonDescription")}</p>
    </div>
  );
}

export function VideoMakerPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("videoMaker.title")} subtitle={t("videoMaker.subtitle")} />
      <Tabs defaultValue="media" className="gap-4">
        <div className="-mx-4 [scrollbar-width:none] overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-max">
            {STEPS.map(({ id, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="gap-2 px-3">
                <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <Icon aria-hidden />
                {t(`videoMaker.steps.${id}.title`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {STEPS.map(({ id, icon, ready }) => (
          <TabsContent key={id} value={id}>
            {!ready ? (
              <ComingSoon step={id} icon={icon} />
            ) : id === "media" ? (
              <MediaLibrary store={videoMediaStore} />
            ) : (
              <MusicPanel store={videoMusicStore} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
