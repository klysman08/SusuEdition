import { RotateCcw, Scissors } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TimelineResult } from "@/engine/timeline";
import type { FitMode } from "@/engine/types";
import { formatTime } from "@/lib/format";

import { useMediaUrl, useProject } from "../hooks";
import { videoMediaStore, videoProjectStore } from "../store";
import { LabeledValue } from "@/components/common/Section";

const secs = (v: number) => `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/** Ajustes de uma mídia: duração, enquadramento e — para vídeos — início, som e volume. */
export function ItemSheet({
  id,
  timeline,
  onClose,
  onTrim,
}: {
  id: string | null;
  timeline: TimelineResult;
  onClose: () => void;
  /** Abre o recorte do vídeo (escolher o trecho vendo o vídeo). */
  onTrim?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const item = useStore(videoMediaStore, (s) => (id ? s.items[id] : undefined));
  const override = useProject((s) => (id ? s.overrides[id] : undefined)) ?? {};
  const settings = useProject((s) => s.timeline);
  const { patchOverride, clearOverride } = videoProjectStore.getState();
  const url = useMediaUrl(item?.kind === "video" ? (id ?? null) : null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = item?.kind === "video";
  const mediaDuration = item?.meta?.durationSec ?? 0;
  const defaultDuration = isVideo ? settings.videoDurationSec : settings.photoDurationSec;
  const start = override.sourceInSec ?? 0;
  const maxStart = Math.max(0, mediaDuration - 0.5);
  const durationMax = isVideo ? Math.max(0.5, mediaDuration - start) : 15;
  const duration = Math.min(override.durationSec ?? defaultDuration, isVideo ? durationMax : 15);
  const keepAudio = override.keepAudio ?? settings.keepVideoAudio;
  const included = !!id && timeline.segments.some((s) => s.mediaId === id);

  useEffect(() => {
    const v = videoRef.current;
    if (v && Number.isFinite(start)) v.currentTime = start;
  }, [start, url]);

  return (
    <Sheet open={!!id && !!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {item && id && (
          <>
            <SheetHeader>
              <SheetTitle>{t("item.title")}</SheetTitle>
              <SheetDescription className="truncate">
                {t(isVideo ? "item.video" : "item.photo")} · {item.name}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              <div className="overflow-hidden rounded-lg bg-muted">
                {isVideo && url ? (
                  <video
                    ref={videoRef}
                    src={url}
                    muted
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    className="aspect-video w-full bg-black object-contain"
                  />
                ) : item.thumbUrl ? (
                  <img src={item.thumbUrl} alt="" className="aspect-video w-full object-contain" />
                ) : null}
              </div>

              {!included && <p className="text-xs text-amber-600 dark:text-amber-400">{t("item.excluded")}</p>}

              {isVideo && onTrim && (
                <Button variant="secondary" className="w-full" onClick={() => onTrim(id)}>
                  <Scissors />
                  {t("item.trim")}
                </Button>
              )}

              {isVideo && (
                <LabeledValue label={t("item.start")} value={formatTime(start)}>
                  <Slider
                    min={0}
                    max={maxStart}
                    step={0.1}
                    value={[start]}
                    disabled={maxStart <= 0}
                    onValueChange={([v]) =>
                      v !== undefined && patchOverride(id, { sourceInSec: v > 0 ? v : undefined })
                    }
                    aria-label={t("item.start")}
                  />
                </LabeledValue>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="item-default-duration" className="text-sm font-normal">
                    {t("item.useDefault", { seconds: defaultDuration.toLocaleString() })}
                  </Label>
                  <Switch
                    id="item-default-duration"
                    checked={override.durationSec === undefined}
                    onCheckedChange={(v) => patchOverride(id, { durationSec: v ? undefined : defaultDuration })}
                  />
                </div>
                {override.durationSec !== undefined && (
                  <LabeledValue label={t("item.duration")} value={secs(duration)}>
                    <Slider
                      min={0.5}
                      max={durationMax}
                      step={0.1}
                      value={[duration]}
                      onValueChange={([v]) => v !== undefined && patchOverride(id, { durationSec: v })}
                      aria-label={t("item.duration")}
                    />
                  </LabeledValue>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm">{t("item.fit")}</p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={override.fit ?? "default"}
                  onValueChange={(v) => v && patchOverride(id, { fit: v === "default" ? undefined : (v as FitMode) })}
                  className="w-full"
                >
                  <ToggleGroupItem value="default" className="flex-1 px-2 text-xs">
                    {t("item.fitDefault")}
                  </ToggleGroupItem>
                  {(["fit", "cover", "fill"] as const).map((m) => (
                    <ToggleGroupItem key={m} value={m} className="flex-1 px-2 text-xs">
                      {t(`format.fit.${m}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {isVideo && item.meta?.hasAudio !== false && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="item-keep-audio" className="text-sm font-normal">
                      {t("item.keepAudio")}
                    </Label>
                    <Switch
                      id="item-keep-audio"
                      checked={keepAudio}
                      onCheckedChange={(v) =>
                        patchOverride(id, { keepAudio: v === settings.keepVideoAudio ? undefined : v })
                      }
                    />
                  </div>
                  {keepAudio && (
                    <LabeledValue label={t("item.volume")} value={`${Math.round((override.gain ?? 1) * 100)}%`}>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[override.gain ?? 1]}
                        onValueChange={([v]) => v !== undefined && patchOverride(id, { gain: v === 1 ? undefined : v })}
                        aria-label={t("item.volume")}
                      />
                    </LabeledValue>
                  )}
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => clearOverride(id)}>
                <RotateCcw />
                {t("item.reset")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
