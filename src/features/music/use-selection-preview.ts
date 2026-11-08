import { useCallback, useEffect, useRef, useState } from "react";

import type { Selection } from "@/engine/audio";

/**
 * Toca o trecho selecionado com um elemento <audio> (o WebView lê o arquivo por
 * HTTP Range via `susu://`, sem carregar tudo na memória). Para no fim do trecho.
 */
export function useSelectionPreview(url: string | undefined, selection: Selection | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const selRef = useRef(selection);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    selRef.current = selection;
  }, [selection]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!url) return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    audioRef.current = audio;
    const onEnded = () => stop();
    audio.addEventListener("ended", onEnded);
    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      setPlaying(false);
      setPosition(null);
    };
  }, [url, stop]);

  /** Atualiza a posição a cada quadro e para ao chegar no fim do trecho. */
  const startLoop = useCallback(() => {
    const step = () => {
      const audio = audioRef.current;
      const sel = selRef.current;
      if (!audio || !sel) return;
      setPosition(audio.currentTime);
      if (audio.currentTime >= sel.outSec) {
        stop();
        setPosition(sel.inSec);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [stop]);

  const play = useCallback(
    async (from?: number) => {
      const audio = audioRef.current;
      const sel = selRef.current;
      if (!audio || !sel) return;
      const start = from !== undefined && from >= sel.inSec && from < sel.outSec ? from : sel.inSec;
      audio.currentTime = start;
      setPosition(start);
      try {
        await audio.play();
        setPlaying(true);
        startLoop();
      } catch {
        setPlaying(false);
      }
    },
    [startLoop],
  );

  const toggle = useCallback(() => {
    if (playing) stop();
    else void play(position ?? undefined);
  }, [playing, play, stop, position]);

  const seek = useCallback(
    (t: number) => {
      setPosition(t);
      if (audioRef.current) audioRef.current.currentTime = t;
      if (!playing) return;
      void play(t);
    },
    [playing, play],
  );

  return { playing, position, toggle, seek, stop };
}
