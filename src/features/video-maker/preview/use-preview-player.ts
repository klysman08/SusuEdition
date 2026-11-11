import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { useStore } from "zustand";

import { isNeutralFilter, resolveFilter } from "@/engine/render/filters";
import type { RhythmBeat, TimelineResult } from "@/engine/timeline";
import { getMediaBackend, type MediaBackend } from "@/platform/media";

import { useProject, useRhythm } from "../hooks";
import { videoMediaStore, videoMusicStore } from "../store";
import { PreviewPlayer, type PlayerState, type PreviewMedia } from "./preview-player";

/** Lado menor máximo do canvas do preview (custo de GPU constante). */
const MAX_SHORT_SIDE = 720;

declare global {
  interface Window {
    __susuPreview?: PreviewPlayer;
  }
}

export interface PreviewController {
  player: PreviewPlayer | null;
  state: PlayerState;
  unsupported: boolean;
  empty: boolean;
  /** Proporção do vídeo [largura, altura]. */
  aspect: [number, number];
  /** Batidas da música em tempo de timeline (só as que caem dentro do vídeo). */
  beats: readonly RhythmBeat[];
}

/**
 * Liga o `PreviewPlayer` ao projeto atual. O <canvas> (`canvasRef`) e a caixa na
 * proporção do vídeo (`boxRef`, que dita o tamanho do canvas) precisam estar montados
 * enquanto o hook estiver ativo.
 */
export function usePreviewPlayer(
  timeline: TimelineResult,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  boxRef: RefObject<HTMLDivElement | null>,
): PreviewController {
  const [player, setPlayer] = useState<PreviewPlayer | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [backend, setBackend] = useState<MediaBackend | null>(null);
  const [state, setState] = useState<PlayerState>({ timeSec: 0, durationSec: 0, playing: false });

  const aspect = useProject((s) => s.aspect);
  const fit = useProject((s) => s.fit);
  const background = useProject((s) => s.background);
  const mix = useProject((s) => s.mix);
  const filterSettings = useProject((s) => s.filter);
  const filter = useMemo(() => {
    const resolved = resolveFilter(filterSettings);
    return isNeutralFilter(resolved) ? null : resolved;
  }, [filterSettings]);
  const items = useStore(videoMediaStore, (s) => s.items);
  const musicUrl = useStore(videoMusicStore, (s) => (s.status === "ready" ? (s.track?.url ?? null) : null));
  const fileBeats = useRhythm();
  const [aw, ah] = aspect.split(":").map(Number) as [number, number];

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
  }, [canvasRef]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tamanho do canvas acompanha a caixa (limitado a 720 no lado menor).
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
  }, [player, boxRef, aw, ah]);

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
      filter,
      mix,
    });
  }, [player, timeline, media, musicUrl, fit, background, filter, mix]);

  // Pausa ao sair do editor.
  useEffect(() => () => player?.pause(), [player]);

  const beats = useMemo(() => {
    const plan = timeline.audio;
    if (!plan) return [];
    return fileBeats
      .map((b) => ({ ...b, timeSec: b.timeSec - plan.musicInSec }))
      .filter((b) => b.timeSec >= 0 && b.timeSec <= timeline.durationSec);
  }, [fileBeats, timeline.audio, timeline.durationSec]);

  return {
    player,
    state,
    unsupported,
    empty: timeline.segments.length === 0,
    aspect: [aw, ah],
    beats,
  };
}
