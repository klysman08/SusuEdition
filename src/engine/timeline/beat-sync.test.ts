import { describe, expect, it } from "vitest";

import type { Beat, MediaItem } from "../types";
import { applyCuts, BEAT_SYNC_PRESETS, syncCutsToBeats } from "./beat-sync";
import { buildTimeline } from "./build-timeline";
import { analyzeRhythm } from "./rhythm";
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
const inf = (n: number) => new Array<number>(n).fill(Infinity);
const style = (preset: keyof typeof BEAT_SYNC_PRESETS) => ({ profile: BEAT_SYNC_PRESETS[preset], minClipSec: 0.5 });
const steady = style("steady");
/** Metade calma (pico 0,2), metade intensa (pico 0,9). */
const twoHalves = Array.from({ length: 4000 }, (_, i) => (i < 2000 ? 0.2 : 0.9));

describe("analyzeRhythm", () => {
  it("encontra a fase do compasso pelas batidas fortes", () => {
    // Fortes nos índices 2, 6, 10…
    const beats = grid(0.5, 0, 20).map((b, i) => ({ ...b, strength: i % 4 === 2 ? 1 : 0.4 }));
    const out = analyzeRhythm(beats);
    const expected = beats.filter((_, i) => i % 4 === 2).map((b) => b.timeSec);
    expect(out.filter((b) => b.bar! > 0).map((b) => b.timeSec)).toEqual(expected);
    expect(out[2]!.bar).toBe(1);
  });

  it("mede a energia pela waveform e marca a mudança de seção no compasso", () => {
    // 40 s a 120 BPM.
    const out = analyzeRhythm(grid(0.5, 0, 39.5), { peaks: twoHalves, durationSec: 40 });
    expect(out[10]!.energy).toBeLessThan(0.1);
    expect(out[70]!.energy).toBeGreaterThan(0.9);
    const marks = out.filter((b) => b.boundary! > 0);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.timeSec).toBe(20);
    expect(marks[0]!.bar).toBeGreaterThan(0);
  });

  it("sem variação de volume a energia é neutra e não há seções", () => {
    const out = analyzeRhythm(grid(0.5, 0, 20), { peaks: new Array<number>(500).fill(0.7), durationSec: 20.5 });
    expect(out.every((b) => b.energy === 0.5 && b.boundary === 0)).toBe(true);
  });
});

describe("syncCutsToBeats", () => {
  it("leva cada corte a uma batida, preferindo as fortes próximas", () => {
    // Batidas a 0,45 s; fortes a cada 4 (1,8 s): 1,8 / 3,6 / 5,4…
    const { cuts, stats } = syncCutsToBeats(photos(4), grid(0.45, 0, 10), inf(4), steady);
    // 5,4 também é forte, mas deixaria a última foto com 2,6 s (além da faixa permitida).
    expect(cuts).toEqual([1.8, 3.6, 5.85]);
    expect(stats).toEqual({ snapped: 3, cuts: 3 });
  });

  it("prefere batida forte mesmo um pouco mais distante", () => {
    const beats: Beat[] = [
      { timeSec: 1.95, strength: 0.3 },
      { timeSec: 2.3, strength: 1 },
    ];
    expect(syncCutsToBeats(photos(2), beats, inf(2), style("accents")).cuts).toEqual([2.3]);
  });

  it("não move cortes sem batida ao alcance", () => {
    const { cuts, stats } = syncCutsToBeats(photos(3), [{ timeSec: 3, strength: 1 }], inf(3), steady);
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
    expect(syncCutsToBeats(segs, beats, [2.1, Infinity], steady).cuts).toEqual([2.05]);
    // Nunca deixa um segmento menor que o mínimo.
    const tight = [seg(0, 0, 0.6), seg(1, 0.6, 0.6)];
    expect(syncCutsToBeats(tight, [{ timeSec: 0.2, strength: 1 }], inf(2), steady).cuts).toEqual([0.6]);
  });

  it("o último segmento (vídeo curto) limita o último corte", () => {
    const segs = [seg(0, 0, 3), seg(1, 3, 1, "video")];
    // Último vídeo tem só 1,2 s: recuar o corte para 2,6 exigiria 1,4 s → batida rejeitada.
    expect(syncCutsToBeats(segs, [{ timeSec: 2.6, strength: 1 }], [Infinity, 1.2], steady).cuts).toEqual([3]);
    // Uma batida em 2,85 cabe (vídeo fica com 1,15 s).
    expect(syncCutsToBeats(segs, [{ timeSec: 2.85, strength: 1 }], [Infinity, 1.2], steady).cuts).toEqual([2.85]);
  });

  it("'bars' corta no início dos compassos", () => {
    // 100 BPM: compasso de 2,4 s; fotos de 2 s.
    const beats = analyzeRhythm(grid(0.6, 0, 24));
    const bars = new Set(beats.filter((b) => b.bar! > 0).map((b) => b.timeSec));
    const { cuts } = syncCutsToBeats(photos(10), beats, inf(10), style("bars"));
    expect(cuts.filter((c) => bars.has(c)).length).toBeGreaterThanOrEqual(7);
  });

  it("'dynamic' acelera nas partes intensas e corta na mudança de seção", () => {
    // 40 s: primeira metade calma, segunda intensa; 20 fotos de 2 s.
    const beats = analyzeRhythm(grid(0.5, 0, 39.5), { peaks: twoHalves, durationSec: 40 });
    const segs = photos(20);
    const { cuts, stats } = syncCutsToBeats(segs, beats, inf(20), style("dynamic"));
    expect(stats.snapped).toBe(19);
    expect(cuts).toContain(20);
    const calm = cuts.filter((c) => c < 20).length;
    const intense = cuts.filter((c) => c > 20).length;
    expect(intense).toBeGreaterThan(calm + 3);
    // O ritmo uniforme divide igualmente.
    const even = syncCutsToBeats(segs, beats, inf(20), steady).cuts;
    expect(even.filter((c) => c < 20).length).toBe(9);
    // Durações continuam válidas e somam o total.
    const bounds = [0, ...cuts, 40];
    const durs = bounds.slice(1).map((b, i) => b - bounds[i]!);
    expect(Math.min(...durs)).toBeGreaterThanOrEqual(0.5);
    expect(durs.reduce((a, b) => a + b, 0)).toBeCloseTo(40, 6);
  });

  it("flexibilidade 0 desliga a sincronia", () => {
    const { cuts } = syncCutsToBeats(photos(3), grid(0.45, 0, 6), inf(3), { ...steady, flexibility: 0 });
    expect(cuts).toEqual([2, 4]);
  });

  it("aguenta centenas de mídias", () => {
    const beats = analyzeRhythm(grid(0.5, 0, 600));
    const t0 = performance.now();
    const { stats } = syncCutsToBeats(photos(300), beats, inf(300), style("accents"));
    expect(stats.snapped).toBe(299);
    expect(performance.now() - t0).toBeLessThan(1500);
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
    beatSync: { enabled: true, preset: "steady", flexibility: 0.3 },
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
      settings: settings({ beatSync: { enabled: false, preset: "steady", flexibility: 0.3 } }),
      music: { inSec: 0, outSec: 10 },
      beats,
    });
    expect(off.beatSync).toBeUndefined();
    expect(off.segments.map((s) => s.startSec)).toEqual([0, 2, 4, 6, 8]);
    const none = buildTimeline({ items, settings: settings(), music: { inSec: 0, outSec: 10 }, beats: [] });
    expect(none.segments.map((s) => s.startSec)).toEqual([0, 2, 4, 6, 8]);
  });
});
