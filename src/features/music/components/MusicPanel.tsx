import { Activity, AudioLines, Minus, Music2, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useStore } from "zustand";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setEdge, withLength, type Selection } from "@/engine/audio";
import { formatTime } from "@/lib/format";
import { getMediaBackend, releaseMedia } from "@/platform/media";

import { installMusicDevHooks } from "../dev-hooks";
import { loadMusic } from "../load-music";
import type { MusicStore } from "../store";
import { useSelectionPreview } from "../use-selection-preview";
import { Waveform } from "./Waveform";

const LENGTHS = [15, 30, 60] as const;

function Nudge({ label, value, onStep }: { label: string; value: number; onStep: (delta: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <span className="w-12 text-xs text-muted-foreground">{label}</span>
      <Button variant="outline" size="icon-xs" aria-label={t("music.earlier", { label })} onClick={() => onStep(-0.1)}>
        <Minus />
      </Button>
      <span className="w-14 text-center text-sm font-medium tabular-nums">{formatTime(value)}</span>
      <Button variant="outline" size="icon-xs" aria-label={t("music.later", { label })} onClick={() => onStep(0.1)}>
        <Plus />
      </Button>
    </div>
  );
}

/** Passo "Música": escolher a faixa e recortar o trecho antes de usá-la no vídeo. */
export function MusicPanel({ store }: { store: MusicStore }) {
  const { t } = useTranslation();
  const track = useStore(store, (s) => s.track);
  const status = useStore(store, (s) => s.status);
  const error = useStore(store, (s) => s.error);
  const analysis = useStore(store, (s) => s.analysis);
  const selection = useStore(store, (s) => s.selection);
  const snap = useStore(store, (s) => s.snapToBeats);
  const preview = useSelectionPreview(status === "ready" ? track?.url : undefined, selection);

  useEffect(() => installMusicDevHooks(store), [store]);

  const pick = useCallback(async () => {
    const backend = await getMediaBackend();
    const picked = await backend.pickAudio();
    preview.stop();
    const result = await loadMusic(store, backend, picked);
    if (result === "unsupported") toast.warning(t("music.unsupported"));
    else if (result === "error") toast.error(t("music.error"), { description: store.getState().error });
  }, [store, t, preview]);

  const remove = useCallback(async () => {
    preview.stop();
    const id = store.getState().track?.id;
    store.getState().clear();
    if (id) await releaseMedia([id]);
  }, [store, preview]);

  const update = (sel: Selection) => store.getState().setSelection(sel);

  if (!track) {
    return (
      <button
        type="button"
        onClick={() => void pick()}
        className="group flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors outline-none hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:ring-2 focus-visible:ring-ring md:py-24"
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <Music2 className="size-7" aria-hidden />
        </span>
        <span>
          <span className="block text-lg font-semibold">{t("music.emptyTitle")}</span>
          <span className="mx-auto mt-1 block max-w-md text-sm text-muted-foreground">
            {t("music.emptyDescription")}
          </span>
        </span>
        <Button asChild size="lg" className="pointer-events-none">
          <span>
            <Music2 />
            {t("music.choose")}
          </span>
        </Button>
      </button>
    );
  }

  const duration = analysis?.durationSec ?? 0;
  const beats = analysis?.beats ?? [];
  const selLength = selection ? selection.outSec - selection.inSec : 0;
  const activeLength = selection
    ? selLength >= duration - 0.05
      ? "full"
      : (LENGTHS.find((l) => Math.abs(selLength - l) < 0.3)?.toString() ?? "")
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-violet-500 text-white">
          <AudioLines className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{track.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {status === "loading" ? (
              <span>{t("music.analyzing")}</span>
            ) : analysis ? (
              <>
                <span className="tabular-nums">{formatTime(duration, false)}</span>
                {analysis.bpm !== null ? (
                  <Badge variant="secondary" className="gap-1">
                    <Activity className="size-3" aria-hidden />
                    {t("music.bpm", { bpm: Math.round(analysis.bpm) })}
                  </Badge>
                ) : (
                  <span>{t("music.noBeats")}</span>
                )}
                {beats.length > 0 && <span>{t("music.beats", { count: beats.length })}</span>}
              </>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void pick()}>
          <RefreshCw />
          <span className="hidden sm:inline">{t("music.replace")}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("music.remove")} onClick={() => void remove()}>
          <Trash2 />
        </Button>
      </div>

      {status === "loading" && (
        <div className="space-y-2">
          <Skeleton className="h-28 w-full rounded-lg sm:h-36" />
          <p className="text-center text-xs text-muted-foreground">{t("music.analyzingHint")}</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{t("music.error")}</p>
          {error && <p className="mt-1 text-muted-foreground">{error}</p>}
        </div>
      )}

      {status === "ready" && analysis && selection && (
        <div className="space-y-4 rounded-xl border bg-card p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("music.selectionTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("music.selectionHint")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatTime(selLength)}</p>
              <p className="text-xs text-muted-foreground">{t("music.selectionLength")}</p>
            </div>
          </div>

          <Waveform
            peaks={analysis.peaks}
            durationSec={duration}
            beats={beats}
            selection={selection}
            position={preview.position}
            snap={snap && beats.length > 0}
            onChange={update}
            onSeek={preview.seek}
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button onClick={preview.toggle} className="min-w-32">
              {preview.playing ? <Pause /> : <Play />}
              {preview.playing ? t("music.pause") : t("music.playSelection")}
            </Button>
            <Nudge
              label={t("music.start")}
              value={selection.inSec}
              onStep={(d) => update(setEdge(selection, "in", selection.inSec + d, duration))}
            />
            <Nudge
              label={t("music.end")}
              value={selection.outSec}
              onStep={(d) => update(setEdge(selection, "out", selection.outSec + d, duration))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={activeLength}
              onValueChange={(v) => {
                if (!v) return;
                update(withLength(selection, v === "full" ? null : Number(v), duration, beats, snap));
              }}
              aria-label={t("music.quickLength")}
            >
              {LENGTHS.map((l) => (
                <ToggleGroupItem key={l} value={String(l)} disabled={l >= duration} className="px-3 tabular-nums">
                  {l}s
                </ToggleGroupItem>
              ))}
              <ToggleGroupItem value="full" className="px-3">
                {t("music.full")}
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-2">
              <Switch
                id="snap-beats"
                checked={snap && beats.length > 0}
                disabled={beats.length === 0}
                onCheckedChange={(v) => store.getState().setSnapToBeats(v)}
              />
              <Label htmlFor="snap-beats" className="text-sm">
                {t("music.snap")}
              </Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
