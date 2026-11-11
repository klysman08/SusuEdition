import { Clapperboard, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMediaBackend, type MediaBackend } from "@/platform/media";

import { deleteProject, listProjects, projectSession, type ProjectListItem } from "../project-session";
import { useOpenProject } from "./use-open-project";

function Cover({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Clapperboard className="size-5 text-muted-foreground" aria-hidden />;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
  );
}

/**
 * Projetos de vídeo salvos, do mais recente para o mais antigo. Um toque abre o
 * projeto (as mídias são reabertas dos caminhos originais).
 */
export function ProjectList({
  onOpened,
  limit,
  empty = null,
  header = null,
  className,
}: {
  onOpened?: () => void;
  limit?: number;
  /** Título mostrado acima da lista (só quando há projetos). */
  header?: ReactNode;
  /** Mostrado quando não há projetos. */
  empty?: ReactNode;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const revision = useStore(projectSession, (s) => s.revision);
  const currentId = useStore(projectSession, (s) => s.id);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [backend, setBackend] = useState<MediaBackend | null>(null);
  const [toDelete, setToDelete] = useState<ProjectListItem | null>(null);
  const { open, opening } = useOpenProject();

  useEffect(() => {
    let alive = true;
    void listProjects()
      .then((p) => alive && setProjects(p))
      .catch(() => alive && setProjects([]));
    return () => {
      alive = false;
    };
  }, [revision]);

  useEffect(() => {
    void getMediaBackend().then(setBackend);
  }, []);

  if (!projects) return null;
  if (projects.length === 0) return <>{empty}</>;

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const shown = limit ? projects.slice(0, limit) : projects;

  return (
    <>
      {header}
      <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
        {shown.map((p) => {
          const name = p.name || t("projects.untitled");
          const current = p.id === currentId;
          return (
            <li key={p.id} className="group relative">
              <button
                type="button"
                disabled={opening !== null}
                onClick={() => {
                  if (current) onOpened?.();
                  else void open(p.id).then((ok) => ok && onOpened?.());
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 pr-11 text-left transition-colors outline-none hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  current && "border-primary/60",
                )}
              >
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {opening === p.id ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                  ) : (
                    <Cover url={p.coverId && backend ? backend.thumbUrl(p.coverId) : ""} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{name}</span>
                    {current && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {t("projects.current")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">
                    {t("projects.items", { count: p.mediaCount })} · {formatTime(p.durationSec, false)} · {p.aspect}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.updatedAt > 0 ? dateFormat.format(p.updatedAt) : ""}
                  </span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("projects.deleteNamed", { name })}
                title={t("projects.delete")}
                disabled={opening !== null}
                onClick={() => setToDelete(p)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("projects.deleteConfirmTitle", { name: toDelete?.name || t("projects.untitled") })}
            </DialogTitle>
            <DialogDescription>{t("projects.deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("projects.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                const id = toDelete?.id;
                setToDelete(null);
                if (id) void deleteProject(id);
              }}
            >
              {t("projects.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
