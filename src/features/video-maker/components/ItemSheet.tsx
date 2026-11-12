import { Crop, FileSearch, RotateCcw, Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useStore } from "zustand";

import { LabeledValue } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isFullCrop } from "@/engine/render/crop";
import { FILTER_PRESET_IDS, type FilterPresetId } from "@/engine/render/filters";
import { MOTION_KINDS, type MotionKind, type TimelineResult } from "@/engine/timeline";
import type { FitMode } from "@/engine/types";
import { formatTime } from "@/lib/format";

import { relinkClip } from "../clip-actions";
import { useMediaUrl, useProject } from "../hooks";
import { videoMediaStore, videoProjectStore } from "../store";

const secs = (v: number) => `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/**
 * Ajustes de uma mídia: corte, duração, enquadramento, movimento, filtro, transição de
 * entrada e — para vídeos — recorte do trecho, som e volume. Mídia com arquivo ausente: localizar o arquivo.
 */
export function ItemSheet({
  id,
  timeline,
  onClose,
  onTrim,
  onCrop,
  onRelinked,
}: {
  id: string | null;
  timeline: TimelineResult;
  onClose: () => void;
  /** Abre o recorte do vídeo (escolher o trecho vendo o vídeo). */
  onTrim?: (id: string) => void;
  /** Abre o corte (escolher a parte da foto/vídeo que aparece). */
  onCrop?: (id: string) => void;
  /** A mídia trocou de arquivo e de id: manter os ajustes abertos nela. */
  onRelinked?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const item = useStore(videoMediaStore, (s) => (id ? s.items[id] : undefined));
  const override = useProject((s) => (id ? s.overrides[id] : undefined)) ?? {};
  const settings = useProject((s) => s.timeline);
  const { patchOverride, clearOverride } = videoProjectStore.getState();
  const isVideo = item?.kind === "video";
  const missing = item?.error === "missing";
  const url = useMediaUrl(isVideo && !missing && item && id ? (item.sourceId ?? id) : null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [locating, setLocating] = useState(false);

  const mediaDuration = item?.meta?.durationSec ?? 0;
  const defaultDuration = isVideo ? settings.videoDurationSec : settings.photoDurationSec;
  const start = override.sourceInSec ?? 0;
  const maxStart = Math.max(0, mediaDuration - 0.5);
  const durationMax = isVideo ? Math.max(settings.minClipSec, mediaDuration - start) : 15;
  const duration = Math.min(override.durationSec ?? defaultDuration, isVideo ? durationMax : 15);
  const keepAudio = override.keepAudio ?? settings.keepVideoAudio;
  const included = !!id && timeline.segments.some((s) => s.mediaId === id);
  const isFirst = !!id && timeline.segments[0]?.mediaId === id;
  const look = override.look;
  const cropped = !isFullCrop(override.crop);

  useEffect(() => {
    const v = videoRef.current;
    if (v && Number.isFinite(start)) v.currentTime = start;
  }, [start, url]);

  const locate = async () => {
    if (!id) return;
    setLocating(true);
    try {
      const out = await relinkClip(id);
      if (out.result === "ok") {
        toast.success(t("item.relink.ok"));
        if (out.newId && out.newId !== id) onRelinked?.(out.newId);
      } else if (out.result !== "cancelled") {
        toast.warning(t(`item.relink.${out.result}`));
      }
    } catch (err) {
      toast.error(t("item.relink.error"), { description: String(err) });
    } finally {
      setLocating(false);
    }
  };

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

            {missing ? (
              <div className="space-y-4 px-4 pb-6">
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">{t("item.missingTitle")}</p>
                  <p className="mt-1 text-xs break-all text-muted-foreground">{item.uri}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{t("item.missingHint")}</p>
                </div>
                <Button className="w-full" disabled={locating} onClick={() => void locate()}>
                  <FileSearch />
                  {t("item.locate")}
                </Button>
              </div>
            ) : (
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

                {(onCrop || (isVideo && onTrim)) && (
                  <div className="flex gap-2">
                    {onCrop && (
                      <Button variant="secondary" className="min-w-0 flex-1" onClick={() => onCrop(id)}>
                        <Crop />
                        <span className="truncate">{t("item.crop")}</span>
                        {cropped && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                      </Button>
                    )}
                    {isVideo && onTrim && (
                      <Button variant="secondary" className="min-w-0 flex-1" onClick={() => onTrim(id)}>
                        <Scissors />
                        <span className="truncate">{t("item.trim")}</span>
                      </Button>
                    )}
                  </div>
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
                        min={settings.minClipSec}
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="item-motion" className="text-sm font-normal">
                      {t("item.motion")}
                    </Label>
                    <Select
                      value={override.motion ?? "default"}
                      onValueChange={(v) =>
                        patchOverride(id, { motion: v === "default" ? undefined : (v as MotionKind) })
                      }
                    >
                      <SelectTrigger id="item-motion" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{t("item.fitDefault")}</SelectItem>
                        {MOTION_KINDS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {t(`motion.${m}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-look" className="text-sm font-normal">
                      {t("item.look")}
                    </Label>
                    <Select
                      value={look?.preset ?? "none"}
                      onValueChange={(v) =>
                        patchOverride(id, {
                          look:
                            v === "none" ? undefined : { preset: v as FilterPresetId, intensity: look?.intensity ?? 1 },
                        })
                      }
                    >
                      <SelectTrigger id="item-look" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_PRESET_IDS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {t(`filters.presets.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {look && (
                  <LabeledValue label={t("filters.intensity")} value={`${Math.round(look.intensity * 100)}%`}>
                    <Slider
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={[look.intensity]}
                      onValueChange={([v]) => v !== undefined && patchOverride(id, { look: { ...look, intensity: v } })}
                      aria-label={t("filters.intensity")}
                    />
                  </LabeledValue>
                )}

                {!isFirst && (
                  <div className="space-y-2">
                    <p className="text-sm">{t("item.transition")}</p>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={override.transitionIn ?? "default"}
                      onValueChange={(v) =>
                        v && patchOverride(id, { transitionIn: v === "default" ? undefined : (v as "cut" | "fade") })
                      }
                      className="w-full"
                    >
                      <ToggleGroupItem value="default" className="flex-1 px-2 text-xs">
                        {t("item.fitDefault")}
                      </ToggleGroupItem>
                      {(["cut", "fade"] as const).map((k) => (
                        <ToggleGroupItem key={k} value={k} className="flex-1 px-2 text-xs">
                          {t(`timing.transition.${k}`)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                )}

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
                          onValueChange={([v]) =>
                            v !== undefined && patchOverride(id, { gain: v === 1 ? undefined : v })
                          }
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
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
