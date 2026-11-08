import { Clock, Download, Images, Music, RectangleVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { WorkflowSteps, type WorkflowStep } from "@/components/common/WorkflowSteps";

export function VideoMakerPage() {
  const { t } = useTranslation();

  const steps: WorkflowStep[] = [
    {
      id: "format",
      icon: RectangleVertical,
      title: t("videoMaker.steps.format.title"),
      description: t("videoMaker.steps.format.description"),
    },
    {
      id: "media",
      icon: Images,
      title: t("videoMaker.steps.media.title"),
      description: t("videoMaker.steps.media.description"),
    },
    {
      id: "music",
      icon: Music,
      title: t("videoMaker.steps.music.title"),
      description: t("videoMaker.steps.music.description"),
    },
    {
      id: "timing",
      icon: Clock,
      title: t("videoMaker.steps.timing.title"),
      description: t("videoMaker.steps.timing.description"),
    },
    {
      id: "export",
      icon: Download,
      title: t("videoMaker.steps.export.title"),
      description: t("videoMaker.steps.export.description"),
    },
  ];

  return (
    <>
      <PageHeader title={t("videoMaker.title")} subtitle={t("videoMaker.subtitle")} />
      <WorkflowSteps steps={steps} />
    </>
  );
}
