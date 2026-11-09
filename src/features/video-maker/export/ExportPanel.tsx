import { AlertTriangle, CheckCircle2, Download, FolderOpen, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { estimateBytes, resolveExport } from "@/engine/export";
import type { TimelineResult } from "@/engine/timeline";
import type { FrameRate, QualityPreset } from "@/engine/types";
import { formatBytes, formatDuration } from "@/lib/format";
import { getExportPlatform, type ExportTargetInfo } from "@/platform/export";

import { Section } from "../components/Section";
import { useProject } from "../hooks";
import { videoProjectStore } from "../store";
import { cancelVideoExport, exportStore, resetExport, runVideoExport } from "./export-controller";

const QUALITIES: { value: QualityPreset; label: string }[] = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "4k", label: "4K" },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium tabular-nums">{children}</span>
    </div>
  );
}

function ExportDialog({ timeline }: { timeline: TimelineResult }) {
  const { t, i18n } = useTranslation();
  const s = useStore(exportStore);
  const [caps, setCaps] = useState({ reveal: false, open: false });
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    void getExportPlatform()
      .then((p) => p.info())
      .then((i) => setCaps({ reveal: i.canReveal, open: i.canOpen }));
  }, []);
  useEffect(() => {
    if (s.status !== "running") return;
    const id = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(id);
  }, [s.status]);

  const open = s.status !== "idle";
  const busy = s.status === "running" || s.status === "saving";
  const pct = s.totalFrames > 0 ? (s.frame / s.totalFrames) * 100 : 0;
  const elapsed = (now - s.startedAt) / 1000;
  const fps = s.used?.fps ?? 30;
  const eta = s.frame > 10 ? (elapsed / s.frame) * (s.totalFrames - s.frame) : null;
  const speed = elapsed > 0.5 && s.frame > 0 ? s.frame / fps / elapsed : null;
  const took = (s.finishedAt - s.startedAt) / 1000;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && resetExport()}>
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
                {s.status === "saving" ? t("export.saving") : t("export.running")}
              </DialogTitle>
              <DialogDescription>{t("export.keepOpen")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{Math.floor(pct)}%</span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {eta !== null && <span className="block">{t("export.eta", { time: formatDuration(eta) })}</span>}
                  {speed !== null && (
                    <span className="block">
                      {t("export.speed", { speed: speed.toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}
                    </span>
                  )}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("export.frames", { frame: s.frame, total: s.totalFrames })}
                {s.used && ` · ${s.used.size.width}×${s.used.size.height} · ${s.used.fps} fps`}
              </p>
              {s.fallback && s.used && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("export.fallback", { width: s.used.size.width, height: s.used.size.height })}
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={cancelVideoExport} disabled={s.status === "saving"}>
                {t("export.cancel")}
              </Button>
            </div>
          </>
        )}

        {s.status === "done" && (
          <>
            <DialogHeader className="items-center text-center">
              <CheckCircle2 className="size-12 text-emerald-500" aria-hidden />
              <DialogTitle>{t("export.doneTitle")}</DialogTitle>
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
            {s.fallback && s.used && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("export.fallback", { width: s.used.size.width, height: s.used.size.height })}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {caps.open && (
                <Button
                  onClick={() => s.location && void getExportPlatform().then((p) => p.open(s.location!))}
                  className={caps.reveal ? "" : "sm:col-span-2"}
                >
                  <Play />
                  {t("export.open")}
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
              <Button variant="outline" onClick={resetExport}>
                {t("export.close")}
              </Button>
              <Button
                onClick={() => {
                  resetExport();
                  void runVideoExport(timeline);
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

/** Passo "Exportar": qualidade, fps, estimativa e o botão que gera o MP4. */
export function ExportPanel({ timeline }: { timeline: TimelineResult }) {
  const { t, i18n } = useTranslation();
  const aspect = useProject((s) => s.aspect);
  const quality = useProject((s) => s.exportQuality);
  const fps = useProject((s) => s.exportFps);
  const askDestination = useProject((s) => s.askDestination);
  const status = useStore(exportStore, (s) => s.status);
  const [info, setInfo] = useState<ExportTargetInfo | null>(null);
  const { setExport } = videoProjectStore.getState();

  useEffect(() => {
    void getExportPlatform()
      .then((p) => p.info())
      .then(setInfo);
  }, [status]);

  const resolved = resolveExport({ aspect, quality, fps });
  const withAudio = !!timeline.audio || timeline.segments.some((s) => s.keepAudio);
  const estimate = estimateBytes(timeline.durationSec, resolved.videoBitrate, withAudio);
  const lowSpace = info?.freeBytes != null && info.freeBytes < estimate * 1.2;
  const empty = timeline.segments.length === 0;

  return (
    <div className="space-y-4">
      <Section title={t("export.quality")} description={quality === "4k" ? t("export.hint4k") : undefined}>
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={quality}
            onValueChange={(v) => v && setExport({ exportQuality: v as QualityPreset })}
            className="w-full"
          >
            {QUALITIES.map((q) => (
              <ToggleGroupItem key={q.value} value={q.value} className="flex-1">
                {q.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{t("export.fps")}</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={String(fps)}
              onValueChange={(v) => v && setExport({ exportFps: Number(v) as FrameRate })}
            >
              <ToggleGroupItem value="30" className="px-4">
                30
              </ToggleGroupItem>
              <ToggleGroupItem value="60" className="px-4">
                60
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </Section>

      <Section title={t("export.title")}>
        <div className="divide-y">
          <Row label={t("export.resolution")}>
            {resolved.size.width}×{resolved.size.height} · {fps} fps
          </Row>
          <Row label={t("export.duration")}>{formatDuration(timeline.durationSec)}</Row>
          <Row label={t("export.estimatedSize")}>~{formatBytes(estimate, i18n.language)}</Row>
          <Row label={t("export.destination")}>
            {info?.mustPickDestination || askDestination ? t("export.destinationPick") : (info?.defaultDir ?? "…")}
          </Row>
        </div>
        {info && !info.mustPickDestination && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <Label htmlFor="ask-destination" className="text-sm font-normal">
              {t("export.askDestination")}
            </Label>
            <Switch
              id="ask-destination"
              checked={askDestination}
              onCheckedChange={(v) => setExport({ askDestination: v })}
            />
          </div>
        )}
        {lowSpace && info?.freeBytes != null && (
          <p className="mt-3 flex gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("export.lowSpace", {
              needed: formatBytes(estimate, i18n.language),
              free: formatBytes(info.freeBytes, i18n.language),
            })}
          </p>
        )}
        {empty && <p className="mt-3 text-xs text-muted-foreground">{t("export.noMedia")}</p>}
        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={empty || lowSpace || status === "running" || status === "saving"}
          onClick={() => void runVideoExport(timeline)}
        >
          <Download />
          {t("export.start")}
        </Button>
      </Section>

      <ExportDialog timeline={timeline} />
    </div>
  );
}
