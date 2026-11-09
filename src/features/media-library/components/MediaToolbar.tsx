import { ArrowUpDown, CheckCheck, CheckSquare, Ellipsis, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
import { Progress } from "@/components/ui/progress";
import { formatDuration } from "@/lib/format";

import { useLibrary, useLibraryShallow } from "../hooks";
import { summarize, type MediaLibraryStore, type SortMode } from "../store";

interface Props {
  store: MediaLibraryStore;
  onAdd: () => void;
  onRemove: (ids: string[]) => void;
  imagesOnly?: boolean;
}

const SORTS: { mode: SortMode; key: "sortDateAsc" | "sortDateDesc" | "sortNameAsc" | "shuffle" }[] = [
  { mode: "dateAsc", key: "sortDateAsc" },
  { mode: "dateDesc", key: "sortDateDesc" },
  { mode: "nameAsc", key: "sortNameAsc" },
  { mode: "shuffle", key: "shuffle" },
];

export function MediaToolbar({ store, onAdd, onRemove, imagesOnly = false }: Props) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);
  const summary = useLibraryShallow(store, summarize);
  const progress = useLibraryShallow(store, (s) => s.progress);
  const selectMode = useLibrary(store, (s) => s.selectMode);
  const selectedCount = useLibrary(store, (s) => Object.keys(s.selected).length);
  const busy = progress.done < progress.total;
  const { setSelectMode, selectAll, sort } = store.getState();

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 border-b bg-background/85 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium">
            {imagesOnly
              ? t("mediaLibrary.summaryPhotos", { count: summary.photos })
              : t("mediaLibrary.summary", { photos: summary.photos, videos: summary.videos })}
          </p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {busy
              ? t("mediaLibrary.processing", { done: progress.done, total: progress.total })
              : summary.videos > 0
                ? t("mediaLibrary.videoTotal", { duration: formatDuration(summary.videoSeconds) })
                : " "}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {selectMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                <CheckCheck />
                <span className="hidden sm:inline">{t("mediaLibrary.selectAll")}</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0}
                onClick={() => onRemove(Object.keys(store.getState().selected))}
              >
                <Trash2 />
                {t("mediaLibrary.removeSelected", { count: selectedCount })}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t("mediaLibrary.cancel")}
                onClick={() => setSelectMode(false)}
              >
                <X />
              </Button>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown />
                    <span className="hidden sm:inline">{t("mediaLibrary.sort")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORTS.map(({ mode, key }) => (
                    <DropdownMenuItem key={mode} onSelect={() => sort(mode)}>
                      {t(`mediaLibrary.${key}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
                <CheckSquare />
                <span className="hidden sm:inline">{t("mediaLibrary.select")}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={t("mediaLibrary.more")}>
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onAdd}>
                    <Plus />
                    {imagesOnly ? t("mediaLibrary.addPhotos") : t("mediaLibrary.addMedia")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmClear(true)}>
                    <Trash2 />
                    {t("mediaLibrary.clearAll")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" onClick={onAdd}>
                <Plus />
                {t("mediaLibrary.add")}
              </Button>
            </>
          )}
        </div>
      </div>
      {busy && <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="mt-2 h-1" />}

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mediaLibrary.clearConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("mediaLibrary.clearConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("mediaLibrary.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmClear(false);
                onRemove([...store.getState().order]);
              }}
            >
              {t("mediaLibrary.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
