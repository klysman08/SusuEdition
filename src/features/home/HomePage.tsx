import { ArrowRight, Clapperboard, FolderOpen, LayoutGrid, type LucideIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A lista de projetos traz o estado do editor de vídeo: carrega depois da tela inicial.
const ProjectList = lazy(() =>
  import("@/features/video-maker/projects/ProjectList").then((m) => ({ default: m.ProjectList })),
);

interface FeatureCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  accentClassName: string;
}

function FeatureCard({ to, icon: Icon, title, description, cta, accentClassName }: FeatureCardProps) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 text-card-foreground transition-all outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring md:p-7"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-16 -right-16 size-48 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-40",
          accentClassName,
        )}
      />
      <div className={cn("flex size-12 items-center justify-center rounded-xl text-white shadow-sm", accentClassName)}>
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-primary">{t("app.tagline")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{t("home.greeting")}</h1>
        <p className="mt-2 text-muted-foreground">{t("home.subtitle")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <FeatureCard
          to="/video-maker"
          icon={Clapperboard}
          title={t("home.videoMaker.title")}
          description={t("home.videoMaker.description")}
          cta={t("home.videoMaker.cta")}
          accentClassName="bg-gradient-to-br from-rose-500 to-orange-400"
        />
        <FeatureCard
          to="/photo-collage"
          icon={LayoutGrid}
          title={t("home.photoCollage.title")}
          description={t("home.photoCollage.description")}
          cta={t("home.photoCollage.cta")}
          accentClassName="bg-gradient-to-br from-violet-500 to-sky-400"
        />
      </section>

      <section>
        <h2 className="text-base font-semibold">{t("home.recent")}</h2>
        <Suspense fallback={null}>
          <ProjectList
            limit={8}
            className="mt-3"
            onOpened={() => void navigate("/video-maker")}
            empty={
              <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FolderOpen className="size-5" aria-hidden />
                </div>
                <p className="text-sm text-muted-foreground">{t("home.noRecent")}</p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/video-maker">{t("home.videoMaker.cta")}</Link>
                </Button>
              </div>
            }
          />
        </Suspense>
      </section>
    </div>
  );
}
