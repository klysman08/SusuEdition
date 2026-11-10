import { ImagePlus, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMediaBackend, releaseMedia, type PickedMedia } from "@/platform/media";

import { installDevHooks } from "../dev-hooks";
import { useLibrary } from "../hooks";
import { cancelPendingVideos, importMedia } from "../import-pipeline";
import type { MediaLibraryStore } from "../store";
import { MediaGrid } from "./MediaGrid";
import { MediaToolbar } from "./MediaToolbar";

/** Biblioteca de mídias: importar, visualizar, reordenar, ordenar e remover. */
export function MediaLibrary({
  store,
  onOpenItem,
  imagesOnly = false,
  embedded = false,
}: {
  store: MediaLibraryStore;
  onOpenItem?: (id: string) => void;
  /** Photo Collage: aceita só fotos. */
  imagesOnly?: boolean;
  /** Dentro de um painel estreito com rolagem própria (editor de vídeo). */
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const count = useLibrary(store, (s) => s.order.length);
  const [dragging, setDragging] = useState(false);

  const runImport = useCallback(
    async (picked: PickedMedia[]) => {
      if (picked.length === 0) return;
      const backend = await getMediaBackend();
      try {
        const report = await importMedia(store, backend, picked, { imagesOnly });
        const lines = [
          report.added > 0 && t("mediaLibrary.added", { count: report.added }),
          report.duplicates > 0 && t("mediaLibrary.duplicates", { count: report.duplicates }),
        ].filter(Boolean) as string[];
        if (report.failed.length > 0) {
          toast.warning(t("mediaLibrary.failed", { count: report.failed.length }), {
            description: report.failed
              .slice(0, 4)
              .map(
                (f) =>
                  `${f.name}: ${
                    f.error === "unsupported"
                      ? t("mediaLibrary.unsupported")
                      : f.error === "imagesOnly"
                        ? t("mediaLibrary.onlyPhotos")
                        : f.error
                  }`,
              )
              .join("\n"),
          });
        }
        if (lines.length > 0) toast.success(lines.join(" · "));
      } catch (err) {
        toast.error(t("mediaLibrary.error"), { description: String(err) });
      }
    },
    [store, t, imagesOnly],
  );

  const pick = useCallback(async () => {
    const backend = await getMediaBackend();
    await runImport(await backend.pick({ imagesOnly }));
  }, [runImport, imagesOnly]);

  const remove = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      cancelPendingVideos(ids);
      store.getState().remove(ids);
      store.getState().setSelectMode(false);
      await releaseMedia(ids);
    },
    [store],
  );

  // Arquivos soltos sobre a janela.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let alive = true;
    void getMediaBackend()
      .then((b) => b.onFileDrop((picked) => void runImport(picked), setDragging))
      .then((d) => {
        if (alive) dispose = d;
        else d();
      });
    return () => {
      alive = false;
      dispose?.();
    };
  }, [runImport]);

  useEffect(() => installDevHooks(store, runImport), [store, runImport]);

  return (
    <div className="relative">
      {count === 0 ? (
        <button
          type="button"
          onClick={() => void pick()}
          className="group flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors outline-none hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:ring-2 focus-visible:ring-ring md:py-24"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
            <ImagePlus className="size-7" aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-semibold">
              {imagesOnly ? t("mediaLibrary.emptyTitlePhotos") : t("mediaLibrary.emptyTitle")}
            </span>
            <span className="mx-auto mt-1 block max-w-md text-sm text-muted-foreground">
              {imagesOnly ? t("mediaLibrary.emptyDescriptionPhotos") : t("mediaLibrary.emptyDescription")}
            </span>
          </span>
          <Button asChild size="lg" className="pointer-events-none">
            <span>
              <Upload />
              {imagesOnly ? t("mediaLibrary.addPhotos") : t("mediaLibrary.addMedia")}
            </span>
          </Button>
        </button>
      ) : (
        <>
          <MediaToolbar
            store={store}
            imagesOnly={imagesOnly}
            embedded={embedded}
            onAdd={() => void pick()}
            onRemove={(ids) => void remove(ids)}
          />
          <MediaGrid store={store} onOpenItem={onOpenItem} />
        </>
      )}

      <div
        aria-hidden={!dragging}
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm transition-opacity",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary bg-card px-12 py-10 shadow-xl">
          <Upload className="size-8 text-primary" aria-hidden />
          <p className="text-lg font-semibold">{t("mediaLibrary.dropHere")}</p>
        </div>
      </div>
    </div>
  );
}
