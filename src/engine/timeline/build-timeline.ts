import type {
  AudioPlan,
  BuildTimelineInput,
  TimelineItem,
  TimelineResult,
  TimelineSegment,
  TimelineSettings,
  TimelineWarning,
  Transition,
} from "./types";

const EPS = 1e-6;

/** Evita acúmulo de erro de ponto flutuante (resolução de microssegundos). */
const r = (n: number) => Math.round(n * 1e6) / 1e6;

interface Planned {
  item: TimelineItem;
  sourceInSec: number;
  /** Duração planejada. */
  durationSec: number;
  /** Máximo que este item pode durar (vídeos: o que resta do clipe). */
  maxSec: number;
}

function plan(item: TimelineItem, s: TimelineSettings): Planned {
  const { media, overrides } = item;
  if (media.kind === "image") {
    const d = overrides?.durationSec ?? s.photoDurationSec;
    return { item, sourceInSec: 0, durationSec: Math.max(s.minClipSec, d), maxSec: Number.POSITIVE_INFINITY };
  }
  const total = media.durationSec ?? 0;
  const sourceIn = Math.min(Math.max(0, overrides?.sourceInSec ?? 0), total);
  const available = Math.max(0, total - sourceIn);
  const wanted = overrides?.durationSec ?? s.videoDurationSec;
  return { item, sourceInSec: sourceIn, durationSec: Math.min(wanted, available), maxSec: available };
}

function targetDuration(input: BuildTimelineInput, contentSec: number): number {
  const { total } = input.settings;
  switch (total.mode) {
    case "custom":
      return Math.max(0, total.seconds);
    case "music":
      return input.music ? Math.max(0, input.music.outSec - input.music.inSec) : contentSec;
    case "items":
      return contentSec;
  }
}

/** Mantém itens em ordem enquanto couberem; o último pode ser encurtado. */
function dropOverflow(items: Planned[], target: number, minClip: number): { kept: Planned[]; dropped: Planned[] } {
  const kept: Planned[] = [];
  let acc = 0;
  let i = 0;
  for (; i < items.length; i++) {
    const p = items[i]!;
    const remaining = target - acc;
    if (p.durationSec <= remaining + EPS) {
      kept.push(p);
      acc += p.durationSec;
      continue;
    }
    if (remaining >= minClip - EPS) {
      kept.push({ ...p, durationSec: remaining });
      i++;
    }
    break;
  }
  return { kept, dropped: items.slice(i) };
}

/**
 * Redistribui proporcionalmente para caber em `target`, respeitando `minClip`
 * (water-filling: itens que ficariam abaixo do mínimo são fixados no mínimo).
 */
function fitOverflow(items: Planned[], target: number, minClip: number): { kept: Planned[]; dropped: Planned[] } {
  const maxCount = Math.max(0, Math.floor((target + EPS) / minClip));
  const kept = items.slice(0, maxCount).map((p) => ({ ...p }));
  const dropped = items.slice(maxCount);
  const fixed = new Set<number>();

  for (let guard = 0; guard <= kept.length; guard++) {
    const fixedSum = [...fixed].reduce((a, idx) => a + kept[idx]!.durationSec, 0);
    const freeIdx = kept.map((_, idx) => idx).filter((idx) => !fixed.has(idx));
    const freeSum = freeIdx.reduce((a, idx) => a + items[idx]!.durationSec, 0);
    if (freeSum <= EPS) break;
    const factor = (target - fixedSum) / freeSum;
    let changed = false;
    for (const idx of freeIdx) {
      const scaled = items[idx]!.durationSec * factor;
      if (scaled < minClip) {
        kept[idx]!.durationSec = minClip;
        fixed.add(idx);
        changed = true;
      } else {
        kept[idx]!.durationSec = scaled;
      }
    }
    if (!changed) break;
  }
  return { kept, dropped };
}

function clampTransition(t: Transition, prev: number, cur: number): Transition {
  if (t.kind === "cut") return t;
  // Fade centrado no corte: consome no máximo metade de cada segmento vizinho.
  const d = Math.min(t.durationSec, prev, cur);
  return d > EPS ? { kind: "fade", durationSec: r(d) } : { kind: "cut" };
}

/**
 * Constrói a timeline do Video Maker. Função pura e determinística (SPEC §2.6).
 *
 * A sincronização com batidas (M5) é aplicada depois, sobre os segmentos
 * produzidos aqui.
 */
export function buildTimeline(input: BuildTimelineInput): TimelineResult {
  const { settings: s, music } = input;
  const warnings: TimelineWarning[] = [];

  const planned = input.items.map((it) => plan(it, s)).filter((p) => p.durationSec > EPS);
  const contentSec = planned.reduce((a, p) => a + p.durationSec, 0);
  const target = targetDuration(input, contentSec);

  let kept = planned;
  if (contentSec > target + EPS) {
    const res =
      s.overflow === "fit" ? fitOverflow(planned, target, s.minClipSec) : dropOverflow(planned, target, s.minClipSec);
    kept = res.kept;
    if (res.dropped.length > 0) {
      warnings.push({ kind: "itemsDropped", mediaIds: res.dropped.map((p) => p.item.media.id) });
    }
  }

  const segments: TimelineSegment[] = [];
  let cursor = 0;
  for (const p of kept) {
    const duration = r(Math.min(p.durationSec, p.maxSec));
    const prev = segments.at(-1);
    const keepAudio =
      p.item.media.kind === "video" &&
      (p.item.media.hasAudio ?? true) &&
      (p.item.overrides?.keepAudio ?? s.keepVideoAudio);
    segments.push({
      mediaId: p.item.media.id,
      kind: p.item.media.kind,
      startSec: r(cursor),
      durationSec: duration,
      sourceInSec: r(p.sourceInSec),
      sourceOutSec: r(p.sourceInSec + duration),
      transitionIn: prev ? clampTransition(s.transition, prev.durationSec, duration) : { kind: "cut" },
      fit: p.item.overrides?.fit,
      keepAudio,
      gain: p.item.overrides?.gain ?? 1,
    });
    cursor += duration;
  }

  const durationSec = r(cursor);
  let audio: AudioPlan | null = null;

  if (music && durationSec > EPS) {
    const musicSec = r(music.outSec - music.inSec);
    if (durationSec < musicSec - EPS) {
      // Conteúdo insuficiente (ou duração personalizada menor): corta a música com fade-out.
      if (s.total.mode !== "custom" || contentSec < target - EPS) {
        warnings.push({ kind: "contentShorterThanMusic", contentSec: durationSec, musicSec });
      }
      audio = {
        musicInSec: music.inSec,
        musicOutSec: r(music.inSec + durationSec),
        fadeOutSec: r(Math.min(s.musicFadeOutSec, durationSec)),
      };
    } else {
      if (durationSec > musicSec + EPS) {
        warnings.push({ kind: "musicShorterThanVideo", musicSec, videoSec: durationSec });
      }
      audio = { musicInSec: music.inSec, musicOutSec: music.outSec, fadeOutSec: 0 };
    }
  }

  return { segments, durationSec, audio, warnings };
}
