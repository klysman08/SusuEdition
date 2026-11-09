import { Download, Images, LayoutDashboard, Space, Wand2, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaLibrary } from "@/features/media-library";

import { CollageCanvas } from "./components/CollageCanvas";
import { FiltersPanel } from "./components/FiltersPanel";
import { LayoutPanel } from "./components/LayoutPanel";
import { StylePanel } from "./components/StylePanel";
import { CollageExportPanel } from "./export/CollageExportPanel";
import { collageMediaStore } from "./store";

type StepId = "photos" | "layout" | "spacing" | "filters" | "export";

const STEPS: { id: StepId; icon: LucideIcon }[] = [
  { id: "photos", icon: Images },
  { id: "layout", icon: LayoutDashboard },
  { id: "spacing", icon: Space },
  { id: "filters", icon: Wand2 },
  { id: "export", icon: Download },
];

export function PhotoCollagePage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<StepId>("photos");
  const showPreview = step !== "photos";

  return (
    <>
      <PageHeader title={t("photoCollage.title")} subtitle={t("photoCollage.subtitle")} />
      <Tabs value={step} onValueChange={(v) => setStep(v as StepId)} className="gap-4">
        <div className="-mx-4 [scrollbar-width:none] overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-max">
            {STEPS.map(({ id, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="gap-2 px-3">
                <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <Icon aria-hidden />
                {t(`photoCollage.steps.${id}.title`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div
          className={
            showPreview ? "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-start" : ""
          }
        >
          {showPreview && (
            <div className="min-w-0 xl:sticky xl:top-4 xl:order-2">
              <CollageCanvas onAddPhotos={() => setStep("photos")} />
            </div>
          )}
          <div className="min-w-0">
            <TabsContent value="photos">
              <MediaLibrary store={collageMediaStore} imagesOnly />
            </TabsContent>
            <TabsContent value="layout">
              <LayoutPanel />
            </TabsContent>
            <TabsContent value="spacing">
              <StylePanel />
            </TabsContent>
            <TabsContent value="filters">
              <FiltersPanel />
            </TabsContent>
            <TabsContent value="export">
              <CollageExportPanel />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </>
  );
}
