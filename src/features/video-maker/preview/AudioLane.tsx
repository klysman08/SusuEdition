import { memo, useEffect, useMemo, useRef } from "react";

import { peakInRange } from "@/engine/audio";
import type { RhythmBeat, TimelineResult } from "@/engine/timeline";
import { useTheme } from "@/lib/theme";

interface Props {
  height: number;
  /** Largura visível (o canvas tem sempre este tamanho e desenha só a janela rolada). */
  viewW: number;
  scrollX: number;
  pxPerSec: number;
  timeline: TimelineResult;
  /** Batidas em tempo de timeline (0 = início do vídeo). */
  beats: readonly RhythmBeat[];
  /** Picos 0..1 do arquivo de música inteiro. */
  peaks: readonly number[];
  musicDurationSec: number;
}

const BAR_W = 2;
const BAR_STEP = 3;

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * Faixa de áudio da timeline: a waveform do trecho usado da música e uma marca por
 * batida reconhecida — batidas comuns curtas, inícios de compasso mais altos, mudanças
 * de seção na altura toda. Batidas onde cai um corte ficam destacadas na cor principal;
 * cortes fora de batida aparecem como um entalhe na base.
 *
 * Canvas do tamanho da área visível, preso à esquerda (`sticky`): com zoom alto a
 * faixa pode ter dezenas de milhares de pixels sem custar memória.
 */
export const AudioLane = memo(function AudioLane({
  height,
  viewW,
  scrollX,
  pxPerSec,
  timeline,
  beats,
  peaks,
  musicDurationSec,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const plan = timeline.audio;

  // Normaliza pelo pico do trecho usado: músicas baixas também ocupam a altura toda.
  const norm = useMemo(() => {
    if (!plan || musicDurationSec <= 0 || peaks.length === 0) return 1;
    const perSec = peaks.length / musicDurationSec;
    return Math.max(0.05, peakInRange(peaks, plan.musicInSec * perSec, plan.musicOutSec * perSec));
  }, [peaks, plan, musicDurationSec]);

  const cuts = useMemo(() => timeline.segments.slice(1).map((s) => s.startSec), [timeline.segments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewW <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, height);

    const primary = cssVar(canvas, "--primary", "#e11d48");
    const fg = cssVar(canvas, "--foreground", "#111");
    const d = timeline.durationSec;
    const xOf = (t: number) => t * pxPerSec - scrollX;

    // Waveform (colunas alinhadas à grade do conteúdo: não "tremem" ao rolar).
    if (plan && musicDurationSec > 0 && peaks.length > 0) {
      const perSec = peaks.length / musicDurationSec;
      const musicLen = plan.musicOutSec - plan.musicInSec;
      const fade = plan.fadeOutSec;
      const mid = height / 2;
      ctx.fillStyle = primary;
      for (let x = -(scrollX % BAR_STEP); x < viewW; x += BAR_STEP) {
        const t0 = (scrollX + x) / pxPerSec;
        const t1 = (scrollX + x + BAR_STEP) / pxPerSec;
        if (t1 <= 0 || t0 >= musicLen) continue;
        const p = peakInRange(peaks, (plan.musicInSec + t0) * perSec, (plan.musicInSec + t1) * perSec) / norm;
        const gain = fade > 0 && t0 > d - fade ? Math.max(0, (d - t0) / fade) : 1;
        const h = Math.max(1, Math.min(1, p) * gain * (height - 6));
        ctx.globalAlpha = 0.28 + 0.34 * gain;
        ctx.fillRect(x, mid - h / 2, BAR_W, h);
      }
    }

    // Cortes fora de batida: entalhe na base.
    const beatSet = new Set(beats.map((b) => Math.round(b.timeSec * 1000)));
    const cutSet = new Set(cuts.map((c) => Math.round(c * 1000)));
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.5;
    for (const c of cuts) {
      if (beatSet.has(Math.round(c * 1000))) continue;
      const x = xOf(c);
      if (x < -2 || x > viewW + 2) continue;
      ctx.fillRect(Math.round(x), height - Math.min(8, height * 0.3), 1, Math.min(8, height * 0.3));
    }

    // Batidas. Muito juntas (zoom baixo): só compassos, seções e as que têm corte.
    let spacing = Infinity;
    if (beats.length > 1) {
      const span = beats.at(-1)!.timeSec - beats[0]!.timeSec;
      spacing = (span / (beats.length - 1)) * pxPerSec;
    }
    const dense = spacing < 4;
    for (const b of beats) {
      const x = xOf(b.timeSec);
      if (x < -4 || x > viewW + 4) continue;
      const section = (b.boundary ?? 0) > 0;
      const bar = (b.bar ?? 0) > 0;
      if (b.manual) {
        // Marcador manual: linha âmbar com uma bandeirinha (preenchida quando há corte nele).
        const xi = Math.round(x);
        ctx.fillStyle = "#f59e0b";
        ctx.globalAlpha = 1;
        ctx.fillRect(xi - 1, 0, 2, height);
        ctx.beginPath();
        ctx.moveTo(xi + 1, 0);
        ctx.lineTo(xi + 9, 4);
        ctx.lineTo(xi + 1, 8);
        ctx.closePath();
        ctx.fill();
        if (cutSet.has(Math.round(b.timeSec * 1000))) {
          ctx.beginPath();
          ctx.arc(xi, height - 4, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      if (cutSet.has(Math.round(b.timeSec * 1000))) {
        ctx.fillStyle = primary;
        ctx.globalAlpha = 1;
        ctx.fillRect(Math.round(x) - 1, 0, 2, height);
        ctx.beginPath();
        ctx.arc(Math.round(x), 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (dense && !section && !bar) continue;
      ctx.fillStyle = fg;
      ctx.globalAlpha = section ? 0.85 : bar ? 0.7 : 0.42;
      const h = section ? height : bar ? Math.max(9, height * 0.42) : Math.max(5, height * (0.16 + 0.12 * b.strength));
      ctx.fillRect(Math.round(x), 0, section ? 2 : 1, h);
    }
    ctx.globalAlpha = 1;
  }, [height, viewW, scrollX, pxPerSec, timeline, plan, beats, cuts, peaks, musicDurationSec, norm, resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none sticky left-0 block"
      style={{ width: viewW, height }}
    />
  );
});
