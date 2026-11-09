import { describe, expect, it } from "vitest";

import type { Beat, MediaItem } from "../types";
import { applyCuts, syncCutsToBeats } from "./beat-sync";
import { buildTimeline } from "./build-timeline";
import { DEFAULT_TIMELINE_SETTINGS, type TimelineItem, type TimelineSegment, type TimelineSettings } from "./types";

/** Batidas a cada `period` s; a cada `strongEvery` batidas uma forte (1.0), as demais 0.4. */
const grid = (period: number, from: number, to: number, strongEvery = 4): Beat[] => {
  const out: Beat[] = [];
  let k = 0;
  for (let t = from; t <= to + 1e-9; t += period, k++) {
    out.push({ timeSec: Math.round(t * 1000) / 1000, strength: k % strongEvery === 0 ? 1 : 0.4 });
  }
  return out;
};

const seg = (i: number, start: number, dur: number, kind: "image" | "video" = "image"): TimelineSegment => ({
  mediaId: `m${i}`,
  kind,
  startSec: start,
  durationSec: dur,
  sourceInSec: 0,
  sourceOutSec: dur,
  transitionIn: { kind: "cut" },
  keepAudio: false,
  gain: 1,
});

const photos = (n: number, dur = 2) => Array.from({ length: n }, (_, i) => seg(i, i * dur, dur));
const opts = { maxDeviationSec: 0.5, minClipSec: 0.5 };

describe("syncCutsToBeats", () => {
  it("leva cada corte à batida mais forte dentro do desvio", () => {
    // Batidas a 0,45 s; fortes a cada 4 (1,8 s): 1,8 / 3,6 / 5,4…
    const beats = grid(0.45, 0, 10);
    const { cuts, stats } = syncCutsToBeats(photos(4), beats, [Infinity, Infinity, Infinity, Infinity], opts);
    expect(cuts).toEqual([1.8, 3.6, 5.85]);
    expect(stats).toEqual({ snapped: 3, cuts: 3 });
  });

  it("prefere batida forte mesmo um pouco mais distante", () => {
    const beats: Beat[] = [
      { timeSec: 1.95, strength: 0.3 },
      { timeSec: 2.3, strength: 1 },
    ];
    const { cuts } = syncCutsToBeats(photos(2), beats, [Infinity, Infinity], opts);
    expect(cuts).toEqual([2.3]);
  });

  it("não move cortes sem batida dentro do desvio", () => {
    const { cuts, stats } = syncCutsToBeats(
      photos(3),
      [{ timeSec: 3, strength: 1 }],
      [Infinity, Infinity, Infinity],
      opts,
    );
    expect(cuts).toEqual([2, 4]);
    expect(stats.snapped).toBe(0);
  });

  it("respeita a duração mínima e o que resta de cada vídeo", () => {
    const segs = [seg(0, 0, 2, "video"), seg(1, 2, 2)];
    // O vídeo só tem 2,1 s disponíveis: a batida em 2,4 não serve, a de 2,05 sim.
    const beats: Beat[] = [
      { timeSec: 2.05, strength: 0.5 },
      { timeSec: 2.4, strength: 1 },
    ];
    expect(syncCutsToBeats(segs, beats, [2.1, Infinity], opts).cuts).toEqual([2.05]);
    // Nunca deixa um segmento menor que o mínimo.
    const tight = [seg(0, 0, 0.6), seg(1, 0.6, 0.6)];
    expect(syncCutsToBeats(tight, [{ timeSec: 0.2, strength: 1 }], [Infinity, Infinity], opts).cuts).toEqual([0.6]);
  });

  it("o último segmento (vídeo curto) limita o último corte", () => {
    const segs = [seg(0, 0, 3), seg(1, 3, 1, "video")];
    // Último vídeo tem só 1,2 s: recuar o corte para 2,6 exigiria 1,4 s → batida rejeitada.
    expect(syncCutsToBeats(segs, [{ timeSec: 2.6, strength: 1 }], [Infinity, 1.2], opts).cuts).toEqual([3]);
    // Uma batida em 2,85 cabe (vídeo fica com 1,15 s).
    expect(syncCutsToBeats(segs, [{ timeSec: 2.85, strength: 1 }], [Infinity, 1.2], opts).cuts).toEqual([2.85]);
  });

  it("applyCuts mantém o fim e reajusta trechos e fades", () => {
    const out = applyCuts(photos(3), [1.8, 4.5], { kind: "fade", durationSec: 0.5 });
    expect(out.map((s) => [s.startSec, s.durationSec])).toEqual([
      [0, 1.8],
      [1.8, 2.7],
      [4.5, 1.5],
    ]);
    expect(out[2]!.sourceOutSec).toBe(1.5);
    expect(out[1]!.transitionIn).toEqual({ kind: "fade", durationSec: 0.5 });
    expect(out[0]!.transitionIn).toEqual({ kind: "cut" });
  });
});

describe("buildTimeline com beat sync", () => {
  const photo = (id: string): TimelineItem => ({
    media: { id, kind: "image", uri: id, name: id, width: 1, height: 1, rotation: 0 } as MediaItem,
  });
  const settings = (patch: Partial<TimelineSettings> = {}): TimelineSettings => ({
    ...DEFAULT_TIMELINE_SETTINGS,
    beatSync: { enabled: true, maxDeviationSec: 0.5 },
    ...patch,
  });
  // Música a 124 BPM começando em 5 s do arquivo; seleção 10–30 s.
  const beats = grid(60 / 124, 5, 60);

  it("alinha os cortes às batidas no tempo da timeline (descontando o início do trecho)", () => {
    const items = Array.from({ length: 10 }, (_, i) => photo(`p${i}`));
    const res = buildTimeline({ items, settings: settings(), music: { inSec: 10, outSec: 30 }, beats });
    expect(res.durationSec).toBe(20);
    expect(res.beatSync).toEqual({ snapped: 9, cuts: 9 });
    const onTimeline = beats.map((b) => Math.round((b.timeSec - 10) * 1000) / 1000);
    for (const s of res.segments.slice(1)) expect(onTimeline).toContain(s.startSec);
    const last = res.segments.at(-1)!;
    expect(last.startSec + last.durationSec).toBeCloseTo(20, 6);
  });

  it("desligado ou sem batidas: nada muda", () => {
    const items = Array.from({ length: 5 }, (_, i) => photo(`p${i}`));
    const off = buildTimeline({
      items,
      settings: settings({ beatSync: { enabled: false, maxDeviationSec: 0.5 } }),
      music: { inSec: 0, outSec: 10 },
      beats,
    });
    expect(off.beatSync).toBeUndefined();
    expect(off.segments.map((s) => s.startSec)).toEqual([0, 2, 4, 6, 8]);
    const none = buildTimeline({ items, settings: settings(), music: { inSec: 0, outSec: 10 }, beats: [] });
    expect(none.segments.map((s) => s.startSec)).toEqual([0, 2, 4, 6, 8]);
  });
});
