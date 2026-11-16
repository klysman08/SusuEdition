import { Check, Download, FolderOpen, Loader2, Music2, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useStore } from "zustand";

import { LabeledValue, Section } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sourceOf, type LibraryItem } from "@/features/media-library";
import { loadMusic } from "@/features/music";
import { formatTime } from "@/lib/format";
import { getExportPlatform } from "@/platform/export";
import { getMediaBackend } from "@/platform/media";

import { extractAudioToFile, setVideoAudioAsMusic, type AudioFileFormat } from "../extract-audio";
import { useProject } from "../hooks";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "../store";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Áudio dos vídeos do projeto: usar a trilha de um deles como a música do vídeo ou
 * salvá-la num arquivo (M4A/WAV).
 */
function ExtractAudioSection() {
  const { t } = useTranslation();
  const order = useStore(videoMediaStore, (s) => s.order);
  const items = useStore(videoMediaStore, (s) => s.items);
  const musicId = useStore(videoMusicStore, (s) => s.track?.id ?? null);
  const musicLoading = useStore(videoMusicStore, (s) => s.status === "loading");
  const [format, setFormat] = useState<AudioFileFormat>("m4a");
  const [busy, setBusy] = useState<{ id: string; progress: number } | null>(null);

  // Um por arquivo: um vídeo dividido em vários trechos aparece uma vez só.
  const videos = useMemo(() => {
    const seen = new Set<string>();
    const out: LibraryItem[] = [];
    for (const id of order) {
      const it = items[id];
      if (!it || it.kind !== "video" || it.status !== "ready" || it.meta?.hasAudio === false) continue;
      const source = sourceOf(it);
      if (seen.has(source)) continue;
      seen.add(source);
      out.push(it);
    }
    return out;
  }, [order, items]);

  const save = async (item: LibraryItem) => {
    if (busy) return;
    setBusy({ id: item.id, progress: 0 });
    try {
      const result = await extractAudioToFile(item.id, format, (progress) => setBusy({ id: item.id, progress }));
      if (result.status === "noAudio") toast.warning(t("audioExtract.noAudio"));
      else if (result.status === "saved") {
        const { location } = result;
        toast.success(t("audioExtract.saved", { name: result.fileName }), {
          description: location,
          action: result.canReveal
            ? { label: t("export.reveal"), onClick: () => void getExportPlatform().then((p) => p.reveal(location)) }
            : undefined,
        });
      }
    } catch (err) {
      toast.error(t("audioExtract.error"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const asMusic = async (item: LibraryItem) => {
    const result = await setVideoAudioAsMusic(item.id);
    if (result === "ok") toast.success(t("audioExtract.usedAsMusic", { name: item.name }));
    else if (result === "error") {
      toast.error(t("audioExtract.musicError"), { description: videoMusicStore.getState().error });
    }
  };

  /** Áudio de um vídeo que não está no projeto: vira a música, sem entrar nas mídias. */
  const pickOther = async () => {
    const backend = await getMediaBackend();
    const result = await loadMusic(videoMusicStore, backend, await backend.pickAudio());
    if (result === "unsupported") toast.warning(t("music.unsupported"));
    else if (result === "error") toast.error(t("music.error"), { description: videoMusicStore.getState().error });
  };

  return (
    <Section
      title={t("audioExtract.title")}
      description={t("audioExtract.description")}
      action={
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={format}
          onValueChange={(v) => v && setFormat(v as AudioFileFormat)}
          aria-label={t("audioExtract.format")}
        >
          <ToggleGroupItem value="m4a" className="px-2 text-xs" title={t("audioExtract.formatHint.m4a")}>
            M4A
          </ToggleGroupItem>
          <ToggleGroupItem value="wav" className="px-2 text-xs" title={t("audioExtract.formatHint.wav")}>
            WAV
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <div className="space-y-3">
        {videos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Video className="size-4 shrink-0" aria-hidden />
            {t("audioExtract.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {videos.map((item) => {
              const isMusic = musicId === sourceOf(item);
              const saving = busy?.id === item.id;
              return (
                <li key={item.id} className="space-y-2 rounded-lg border p-2">
                  <div className="flex items-center gap-2.5">
                    {item.thumbUrl ? (
                      <img src={item.thumbUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Video className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {saving
                          ? t("audioExtract.saving", { percent: Math.round((busy?.progress ?? 0) * 100) })
                          : formatTime(item.meta?.durationSec ?? 0, false)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={isMusic ? "secondary" : "outline"}
                      size="sm"
                      disabled={isMusic || musicLoading}
                      onClick={() => void asMusic(item)}
                      className="min-w-0 flex-1"
                    >
                      {isMusic ? <Check /> : <Music2 />}
                      <span className="truncate">
                        {t(isMusic ? "audioExtract.isMusic" : "audioExtract.useAsMusic")}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void save(item)}
                      className="min-w-0 flex-1"
                    >
                      {saving ? <Loader2 className="animate-spin" /> : <Download />}
                      <span className="truncate">{t("audioExtract.save", { format: format.toUpperCase() })}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="ghost" size="sm" className="w-full" onClick={() => void pickOther()}>
          <FolderOpen />
          {t("audioExtract.pickOther")}
        </Button>
      </div>
    </Section>
  );
}

/** Ferramenta "Áudio": som original dos vídeos, volumes da mixagem e extração de áudio. */
export function AudioPanel() {
  const { t } = useTranslation();
  const keepVideoAudio = useProject((s) => s.timeline.keepVideoAudio);
  const mix = useProject((s) => s.mix);
  const hasSound = useProject((s) => s.timeline.transitionSound !== "none");
  const { patchTimeline, patchMix } = videoProjectStore.getState();

  const volume = (key: "musicGain" | "videoGain" | "duckingGain" | "sfxGain", label: string) => (
    <LabeledValue label={label} value={pct(mix[key])}>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={[mix[key]]}
        onValueChange={([v]) => v !== undefined && patchMix({ [key]: v })}
        aria-label={label}
      />
    </LabeledValue>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Section title={t("timing.audioTitle")}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="keep-video-audio">{t("timing.keepVideoAudio")}</Label>
            <Switch
              id="keep-video-audio"
              checked={keepVideoAudio}
              onCheckedChange={(v) => patchTimeline({ keepVideoAudio: v })}
            />
          </div>
          {volume("musicGain", t("timing.musicVolume"))}
          {volume("videoGain", t("timing.videoVolume"))}
          {volume("duckingGain", t("timing.ducking"))}
          <div>
            {volume("sfxGain", t("timing.sfxVolume"))}
            {!hasSound && <p className="mt-2 text-xs text-muted-foreground">{t("timing.sfxVolumeHint")}</p>}
          </div>
        </div>
      </Section>
      <ExtractAudioSection />
    </div>
  );
}
