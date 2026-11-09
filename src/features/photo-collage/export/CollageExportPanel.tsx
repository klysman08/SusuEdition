import { CheckCircle2, Download, FolderOpen, ImageIcon, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { LabeledValue, Section } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { COLLAGE_QUALITIES, collageSize, type CollageQuality, type ImageFormat } from "@/engine/collage";
import { formatBytes, formatDuration } from "@/lib/format";
import { getExportPlatform, type ExportTargetInfo } from "@/platform/export";

import { useCollage, useCollagePhotos } from "../hooks";
import { collageProjectStore } from "../store";
import {
  cancelCollageExport,
  collageExportStore,
  gpuMaxSize,
  resetCollageExport,
  runCollageExport,
} from "./collage-export";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium tabular-nums">{children}</span>
    </div>
  );
}

function ExportDialog() {
  const { t, i18n } = useTranslation();
  const s = useStore(collageExportStore);
  const photos = useCollagePhotos();
  const [caps, setCaps] = useState({ reveal: false, open: false });

  useEffect(() => {
    void getExportPlatform()
      .then((p) => p.info("image"))
      .then((i) => setCaps({ reveal: i.canReveal, open: i.canOpen }));
  }, []);

  const open = s.status !== "idle";
  const busy = s.status === "loading" || s.status === "encoding" || s.status === "saving";
  const pct = s.status === "loading" && s.total > 0 ? (s.loaded / s.total) * 85 : s.status === "encoding" ? 92 : 98;
  const took = (s.finishedAt - s.startedAt) / 1000;
  const stage =
    s.status === "loading"
      ? t("collage.export.loading", { done: s.loaded, total: s.total })
      : s.status === "encoding"
        ? t("collage.export.encoding")
        : t("export.saving");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && resetCollageExport()}>
      <DialogContent
        showCloseButton={!busy}
        onInteractOutside={(e) => busy && e.preventDefault()}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        className="sm:max-w-md"
      >
        {busy && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
                {t("collage.export.running")}
              </DialogTitle>
              <DialogDescription>{stage}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Progress value={pct} className="h-2" />
              {s.size && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {s.size.width}×{s.size.height}
                </p>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={cancelCollageExport}
                disabled={s.status === "saving"}
              >
                {t("export.cancel")}
              </Button>
            </div>
          </>
        )}

        {s.status === "done" && (
          <>
            <DialogHeader className="items-center text-center">
              <CheckCircle2 className="size-12 text-emerald-500" aria-hidden />
              <DialogTitle>{t("collage.export.doneTitle")}</DialogTitle>
              <DialogDescription>
                {t("export.doneDescription", { size: formatBytes(s.bytes, i18n.language), time: formatDuration(took) })}
              </DialogDescription>
            </DialogHeader>
            <p
              className="truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
              title={s.location ?? ""}
            >
              {s.location}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {caps.open && (
                <Button
                  onClick={() => s.location && void getExportPlatform().then((p) => p.open(s.location!))}
                  className={caps.reveal ? "" : "sm:col-span-2"}
                >
                  <ImageIcon />
                  {t("collage.export.open")}
                </Button>
              )}
              {caps.reveal && (
                <Button
                  variant="outline"
                  onClick={() => s.location && void getExportPlatform().then((p) => p.reveal(s.location!))}
                >
                  <FolderOpen />
                  {t("export.reveal")}
                </Button>
              )}
            </div>
          </>
        )}

        {(s.status === "error" || s.status === "cancelled") && (
          <>
            <DialogHeader className="items-center text-center">
              <XCircle
                className={s.status === "error" ? "size-12 text-destructive" : "size-12 text-muted-foreground"}
                aria-hidden
              />
              <DialogTitle>{s.status === "error" ? t("export.errorTitle") : t("export.cancelledTitle")}</DialogTitle>
              {s.error && <DialogDescription className="break-words">{s.error}</DialogDescription>}
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={resetCollageExport}>
                {t("export.close")}
              </Button>
              <Button
                onClick={() => {
                  resetCollageExport();
                  void runCollageExport(photos);
                }}
              >
                <RotateCcw />
                {t("export.retry")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Passo "Exportar": formato, qualidade, resolução e destino (RF-C7). */
export function CollageExportPanel() {
  const { t, i18n } = useTranslation();
  const aspect = useCollage((s) => s.aspect);
  const format = useCollage((s) => s.exportFormat);
  const jpegQuality = useCollage((s) => s.jpegQuality);
  const quality = useCollage((s) => s.exportQuality);
  const askDestination = useCollage((s) => s.askDestination);
  const photos = useCollagePhotos();
  const status = useStore(collageExportStore, (s) => s.status);
  const [info, setInfo] = useState<ExportTargetInfo | null>(null);
  const { setExport } = collageProjectStore.getState();
  const max = gpuMaxSize();

  useEffect(() => {
    void getExportPlatform()
      .then((p) => p.info("image"))
      .then(setInfo);
  }, [status]);

  const size = collageSize(aspect, quality, max);
  // Estimativa grosseira: JPEG ~0,2–0,5 B/px conforme a qualidade; PNG ~2 B/px em fotos.
  const bpp = format === "png" ? 2 : 0.12 + (jpegQuality - 0.6) * 1.1;
  const estimate = size.width * size.height * bpp;
  const empty = photos.length === 0;
  const busy = status === "loading" || status === "encoding" || status === "saving";

  return (
    <div className="space-y-4">
      <Section title={t("collage.export.formatTitle")} description={t(`collage.export.formatHint.${format}`)}>
        <div className="space-y-5">
          <ToggleGroup
            type="single"
            variant="outline"
            value={format}
            onValueChange={(v) => v && setExport({ exportFormat: v as ImageFormat })}
            className="w-full"
          >
            <ToggleGroupItem value="jpeg" className="flex-1">
              JPEG
            </ToggleGroupItem>
            <ToggleGroupItem value="png" className="flex-1">
              PNG
            </ToggleGroupItem>
          </ToggleGroup>
          {format === "jpeg" && (
            <LabeledValue label={t("collage.export.jpegQuality")} value={`${Math.round(jpegQuality * 100)}%`}>
              <Slider
                min={0.6}
                max={1}
                step={0.01}
                value={[jpegQuality]}
                onValueChange={([v]) => setExport({ jpegQuality: v ?? 0.92 })}
              />
            </LabeledValue>
          )}
        </div>
      </Section>

      <Section title={t("collage.export.sizeTitle")}>
        <ToggleGroup
          type="single"
          variant="outline"
          value={quality}
          onValueChange={(v) => v && setExport({ exportQuality: v as CollageQuality })}
          className="grid w-full grid-cols-3"
        >
          {COLLAGE_QUALITIES.map((q) => {
            const s = collageSize(aspect, q, max);
            return (
              <ToggleGroupItem key={q} value={q} className="h-auto flex-col gap-0.5 py-2">
                <span>{t(`collage.export.quality.${q}`)}</span>
                <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                  {s.width}×{s.height}
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {max < 4096 && <p className="mt-3 text-xs text-muted-foreground">{t("collage.export.gpuLimit", { max })}</p>}
      </Section>

      <Section title={t("collage.export.summaryTitle")}>
        <div className="divide-y">
          <Row label={t("export.resolution")}>
            {size.width}×{size.height}
          </Row>
          <Row label={t("collage.export.photos")}>{photos.length}</Row>
          <Row label={t("export.estimatedSize")}>~{formatBytes(estimate, i18n.language)}</Row>
          <Row label={t("export.destination")}>
            {info?.mustPickDestination || askDestination
              ? t("export.destinationPick")
              : info && !info.defaultDir
                ? t("collage.export.download")
                : (info?.defaultDir ?? "…")}
          </Row>
        </div>
        {info && !info.mustPickDestination && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <Label htmlFor="collage-ask-destination" className="text-sm font-normal">
              {t("export.askDestination")}
            </Label>
            <Switch
              id="collage-ask-destination"
              checked={askDestination}
              onCheckedChange={(v) => setExport({ askDestination: v })}
            />
          </div>
        )}
        {empty && <p className="mt-3 text-xs text-muted-foreground">{t("collage.export.noPhotos")}</p>}
        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={empty || busy}
          onClick={() => void runCollageExport(photos)}
        >
          <Download />
          {t("collage.export.start")}
        </Button>
      </Section>

      <ExportDialog />
    </div>
  );
}
