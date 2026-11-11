import { Check, ChevronDown, CircleAlert, FilePlus2, FolderOpen, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { deleteProject, newProject, projectSession, renameProject } from "../project-session";
import { ProjectList } from "./ProjectList";

function RenameDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(name);
  return (
    <DialogContent>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          renameProject(value);
          onClose();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("projects.rename")}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          maxLength={80}
          aria-label={t("projects.nameLabel")}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("projects.cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={!value.trim()}>
            {t("projects.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/**
 * Nome do projeto na barra do editor, com o estado do salvamento automático e o menu:
 * renomear, novo projeto, abrir outro e apagar.
 */
export function ProjectMenu() {
  const { t } = useTranslation();
  const id = useStore(projectSession, (s) => s.id);
  const name = useStore(projectSession, (s) => s.name);
  const status = useStore(projectSession, (s) => s.status);
  const [dialog, setDialog] = useState<"rename" | "open" | "delete" | null>(null);
  const label = name || t("projects.untitled");

  const statusLabel =
    status === "saving" || status === "loading"
      ? t("projects.saving")
      : status === "error"
        ? t("projects.saveError")
        : status === "saved"
          ? t("projects.saved")
          : t("projects.notSaved");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-[46vw] min-w-0 gap-1 px-2 sm:max-w-xs" title={label}>
            <span className="truncate text-sm font-semibold tracking-tight">{label}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuItem disabled={!id} onSelect={() => setDialog("rename")}>
            <Pencil />
            {t("projects.rename")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void newProject()}>
            <FilePlus2 />
            {t("projects.new")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("open")}>
            <FolderOpen />
            {t("projects.openOther")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!id} variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 />
            {t("projects.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span
        role="status"
        aria-label={statusLabel}
        title={statusLabel}
        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
      >
        {status === "saving" || status === "loading" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : status === "error" ? (
          <CircleAlert className="size-3.5 text-destructive" aria-hidden />
        ) : status === "saved" ? (
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : null}
        <span className="max-md:hidden">{statusLabel}</span>
      </span>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog === "rename" && <RenameDialog name={label} onClose={() => setDialog(null)} />}
      </Dialog>

      <Dialog open={dialog === "open"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("projects.openOther")}</DialogTitle>
            <DialogDescription>{t("projects.openDescription")}</DialogDescription>
          </DialogHeader>
          {dialog === "open" && (
            <ProjectList
              onOpened={() => setDialog(null)}
              empty={<p className="py-6 text-center text-sm text-muted-foreground">{t("projects.empty")}</p>}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.deleteConfirmTitle", { name: label })}</DialogTitle>
            <DialogDescription>{t("projects.deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("projects.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setDialog(null);
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
