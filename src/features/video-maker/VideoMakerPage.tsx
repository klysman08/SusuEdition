import { Clock, Download, Images, Music, RectangleVertical, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaLibrary } from "@/features/media-library";
import { MusicPanel } from "@/features/music";

import { FormatPanel } from "./components/FormatPanel";
import { ItemSheet } from "./components/ItemSheet";
import { TimingPanel } from "./components/TimingPanel";
import { useVideoTimeline } from "./hooks";
import { PreviewPanel } from "./preview/PreviewPanel";
import { videoMediaStore, videoMusicStore } from "./store";

type StepId = "format" | "media" | "music" | "timing" | "export";

const STEPS: { id: StepId; icon: LucideIcon }[] = [
  { id: "format", icon: RectangleVertical },
  { id: "media", icon: Images },
  { id: "music", icon: Music },
  { id: "timing", icon: Clock },
  { id: "export", icon: Download },
];

/** Passos que mostram a prévia ao lado (ou acima, no celular). */
const WITH_PREVIEW: ReadonlySet<StepId> = new Set(["format", "timing"]);

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
  const [step, setStep] = useState<StepId>("media");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const timeline = useVideoTimeline();
  const showPreview = WITH_PREVIEW.has(step);

  return (
    <>
      <PageHeader title={t("videoMaker.title")} subtitle={t("videoMaker.subtitle")} />
      <Tabs value={step} onValueChange={(v) => setStep(v as StepId)} className="gap-4">
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

        <div
          className={showPreview ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] xl:items-start" : ""}
        >
          {showPreview && (
            <div className="xl:sticky xl:top-4 xl:order-2">
              <PreviewPanel timeline={timeline} />
            </div>
          )}
          <div className="min-w-0">
            <TabsContent value="format">
              <FormatPanel />
            </TabsContent>
            <TabsContent value="media">
              <MediaLibrary store={videoMediaStore} onOpenItem={setOpenItem} />
            </TabsContent>
            <TabsContent value="music">
              <MusicPanel store={videoMusicStore} />
            </TabsContent>
            <TabsContent value="timing">
              <TimingPanel timeline={timeline} />
            </TabsContent>
            <TabsContent value="export">
              <ComingSoon step="export" icon={Download} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
      <ItemSheet id={openItem} timeline={timeline} onClose={() => setOpenItem(null)} />
    </>
  );
}
