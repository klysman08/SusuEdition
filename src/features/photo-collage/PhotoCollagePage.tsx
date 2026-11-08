import { Download, Images, LayoutDashboard, Space, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { WorkflowSteps, type WorkflowStep } from "@/components/common/WorkflowSteps";

export function PhotoCollagePage() {
  const { t } = useTranslation();

  const steps: WorkflowStep[] = [
    {
      id: "photos",
      icon: Images,
      title: t("photoCollage.steps.photos.title"),
      description: t("photoCollage.steps.photos.description"),
    },
    {
      id: "layout",
      icon: LayoutDashboard,
      title: t("photoCollage.steps.layout.title"),
      description: t("photoCollage.steps.layout.description"),
    },
    {
      id: "spacing",
      icon: Space,
      title: t("photoCollage.steps.spacing.title"),
      description: t("photoCollage.steps.spacing.description"),
    },
    {
      id: "filters",
      icon: Wand2,
      title: t("photoCollage.steps.filters.title"),
      description: t("photoCollage.steps.filters.description"),
    },
    {
      id: "export",
      icon: Download,
      title: t("photoCollage.steps.export.title"),
      description: t("photoCollage.steps.export.description"),
    },
  ];

  return (
    <>
      <PageHeader title={t("photoCollage.title")} subtitle={t("photoCollage.subtitle")} />
      <WorkflowSteps steps={steps} />
    </>
  );
}
