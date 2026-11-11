/**
 * Ações sobre uma mídia da timeline que mexem em mais de um store ao mesmo tempo
 * (biblioteca + ajustes do projeto).
 */
import type { ClipOverrides, TimelineResult, TimelineSegment } from "@/engine/timeline";
import { relinkMedia, removeMedia, sourceOf } from "@/features/media-library";
import { getMediaBackend } from "@/platform/media";

import { videoMediaStore, videoProjectStore } from "./store";

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Segmento que contém `timeSec` e dá para dividir ali (as duas partes com pelo menos `minSec`). */
export function splittableAt(timeline: TimelineResult, timeSec: number, minSec: number): TimelineSegment | null {
  const seg = timeline.segments.findLast((s) => s.startSec <= timeSec + 1e-6);
  if (!seg) return null;
  const local = timeSec - seg.startSec;
  return local >= minSec - 1e-6 && seg.durationSec - local >= minSec - 1e-6 ? seg : null;
}

/** Ajustes das duas partes quando `seg` é dividido `localSec` depois do início dele. */
export function splitOverrides(
  seg: TimelineSegment,
  current: ClipOverrides | undefined,
  localSec: number,
): [ClipOverrides, ClipOverrides] {
  const video = seg.kind === "video";
  const first: ClipOverrides = { ...current, durationSec: round3(localSec) };
  const second: ClipOverrides = {
    ...current,
    durationSec: round3(seg.durationSec - localSec),
    // A segunda parte continua exatamente de onde a primeira parou, sem transição.
    ...(video ? { sourceInSec: round3(seg.sourceInSec + localSec) } : {}),
    transitionIn: "cut",
  };
  if (video && seg.sourceInSec > 0) first.sourceInSec = seg.sourceInSec;
  return [first, second];
}

/**
 * Divide em duas a mídia que está sob `timeSec`: dois trechos do mesmo arquivo, que
 * depois podem ser movidos, recortados ou removidos separadamente. O vídeo final não
 * muda até você mexer em uma das partes. Devolve o id da segunda parte.
 */
export function splitClipAt(timeline: TimelineResult, timeSec: number): string | null {
  const project = videoProjectStore.getState();
  const seg = splittableAt(timeline, timeSec, project.timeline.minClipSec);
  const item = seg ? videoMediaStore.getState().items[seg.mediaId] : undefined;
  if (!seg || !item) return null;

  const newId = `${sourceOf(item)}~${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const [first, second] = splitOverrides(seg, project.overrides[seg.mediaId], timeSec - seg.startSec);
  videoMediaStore.getState().duplicate(seg.mediaId, newId);
  if (!videoMediaStore.getState().items[newId]) return null;
  project.setOverride(seg.mediaId, first);
  project.setOverride(newId, second);
  return newId;
}

/** Tira uma mídia do projeto (o arquivo original não é tocado). */
export async function removeClip(id: string): Promise<void> {
  videoProjectStore.getState().clearOverride(id);
  await removeMedia(videoMediaStore, [id]);
}

/**
 * Pede outro arquivo para uma mídia (ex.: arquivo não encontrado ao reabrir o projeto)
 * e mantém os ajustes dela. Devolve o resultado e o id novo da mídia.
 */
export async function relinkClip(id: string) {
  const backend = await getMediaBackend();
  const item = videoMediaStore.getState().items[id];
  const picked = await backend.pick({ imagesOnly: item?.kind === "image" });
  const out = await relinkMedia(videoMediaStore, backend, id, picked);
  if (out.result === "ok" && out.newId && out.newId !== id) {
    videoProjectStore.getState().moveOverride(id, out.newId);
  }
  return out;
}
