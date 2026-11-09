import { Film, Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { TimelineResult } from "@/engine/timeline";
import { formatTime } from "@/lib/format";
import { getMediaBackend, type MediaBackend } from "@/platform/media";

import { useProject } from "../hooks";
import { videoMediaStore, videoMusicStore } from "../store";
import { PreviewPlayer, type PlayerState, type PreviewMedia } from "./preview-player";
import { TimelineStrip } from "./TimelineStrip";

/** Lado menor máximo do canvas do preview (custo de GPU constante). */
const MAX_SHORT_SIDE = 720;

declare global {
  interface Window {
    __susuPreview?: PreviewPlayer;
  }
}

function aspectNumbers(aspect: string): [number, number] {
  const [w, h] = aspect.split(":").map(Number) as [number, number];
  return [w, h];
}

export function PreviewPanel({ timeline }: { timeline: TimelineResult }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<PreviewPlayer | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [backend, setBackend] = useState<MediaBackend | null>(null);
  const [state, setState] = useState<PlayerState>({ timeSec: 0, durationSec: 0, playing: false });

  const aspect = useProject((s) => s.aspect);
  const fit = useProject((s) => s.fit);
  const background = useProject((s) => s.background);
  const mix = useProject((s) => s.mix);
  const items = useStore(videoMediaStore, (s) => s.items);
  const musicUrl = useStore(videoMusicStore, (s) => (s.status === "ready" ? (s.track?.url ?? null) : null));
  const [aw, ah] = aspectNumbers(aspect);

  useEffect(() => {
    void getMediaBackend().then(setBackend);
  }, []);

  // Cria o player uma vez por montagem. Ele depende do <canvas> no DOM, por isso nasce
  // num efeito e vai para o estado (objeto externo, criado uma única vez).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let p: PreviewPlayer;
    try {
      p = new PreviewPlayer(canvas);
    } catch {
      setUnsupported(true);
      return;
    }
    setPlayer(p);
    const unsub = p.subscribe(setState);
    if (import.meta.env.DEV || import.meta.env.VITE_SUSU_DEBUG === "1") window.__susuPreview = p;
    return () => {
      unsub();
      p.dispose();
      setPlayer(null);
      if (window.__susuPreview === p) delete window.__susuPreview;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tamanho do canvas acompanha o contêiner (limitado a 720 no lado menor).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !player) return;
    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = box.clientWidth * dpr;
      const h = (w * ah) / aw;
      const s = Math.min(1, MAX_SHORT_SIDE / Math.max(1, Math.min(w, h)));
      player.resize({ width: Math.max(2, Math.round(w * s)), height: Math.max(2, Math.round(h * s)) });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [player, aw, ah]);

  const media = useMemo(() => {
    const map = new Map<string, PreviewMedia>();
    if (!backend) return map;
    for (const seg of timeline.segments) {
      const it = items[seg.mediaId];
      if (!it?.meta || (it.kind !== "image" && it.kind !== "video")) continue;
      map.set(seg.mediaId, {
        id: seg.mediaId,
        kind: it.kind,
        url: backend.mediaUrl(seg.mediaId),
        thumbUrl: it.thumbUrl,
        size: { width: it.meta.width, height: it.meta.height },
      });
    }
    return map;
  }, [backend, timeline.segments, items]);

  useEffect(() => {
    player?.setInput({
      segments: timeline.segments,
      durationSec: timeline.durationSec,
      audio: timeline.audio,
      media,
      musicUrl,
      fit,
      background,
      mix,
    });
  }, [player, timeline, media, musicUrl, fit, background, mix]);

  // Pausa ao sair da página.
  useEffect(() => () => player?.pause(), [player]);

  const empty = timeline.segments.length === 0;

  return (
    <div
      className="space-y-3 rounded-xl border bg-card p-3 outline-none sm:p-4"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault();
          player?.toggle();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("preview.title")}</p>
        <span className="text-xs text-muted-foreground tabular-nums">{aspect}</span>
      </div>

      <div
        ref={boxRef}
        className="relative mx-auto overflow-hidden rounded-lg bg-black [--preview-h:42vh] xl:[--preview-h:min(56vh,560px)]"
        style={{ aspectRatio: `${aw} / ${ah}`, width: `min(100%, calc(var(--preview-h) * ${aw / ah}))` }}
      >
        <canvas ref={canvasRef} className="block size-full" onClick={() => player?.toggle()} />
        {(empty || unsupported) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/70">
            <Film className="size-7" aria-hidden />
            <p className="text-xs">{unsupported ? t("preview.unsupported") : t("preview.empty")}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="icon"
          onClick={() => player?.toggle()}
          disabled={empty || !player}
          aria-label={state.playing ? t("preview.pause") : t("preview.play")}
        >
          {state.playing ? <Pause /> : <Play />}
        </Button>
        <Slider
          min={0}
          max={Math.max(0.01, state.durationSec)}
          step={0.01}
          value={[state.timeSec]}
          onValueChange={([v]) => v !== undefined && player?.seek(v)}
          disabled={empty}
          aria-label={t("preview.seek")}
          className="flex-1"
        />
        <span className="w-[88px] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {formatTime(state.timeSec, false)} / {formatTime(state.durationSec, false)}
        </span>
      </div>

      {!empty && <TimelineStrip timeline={timeline} timeSec={state.timeSec} onSeek={(v) => player?.seek(v)} />}
    </div>
  );
}
