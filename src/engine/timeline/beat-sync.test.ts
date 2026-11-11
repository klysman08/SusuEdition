import { describe, expect, it } from "vitest";

import type { Beat, MediaItem } from "../types";
import { applyCuts, BEAT_SYNC_PRESETS, syncCutsToBeats } from "./beat-sync";
import { buildTimeline } from "./build-timeline";
import { analyzeRhythm, mergeMarkers } from "./rhythm";
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

describe("durações travadas (ajuste manual)", () => {
  // Batidas a cada 0,5 s; 6 fotos de 2 s com os cortes deslocados 0,2 s das batidas.
  const beats = grid(0.5, 0, 30);
  const off = (n: number, dur = 2.2) => Array.from({ length: n }, (_, i) => seg(i, i * dur, dur));
  const durations = (cuts: number[], end: number) =>
    [0, ...cuts, end].slice(1).map((c, i, a) => c - (i ? a[i - 1]! : 0));

  it("um segmento travado mantém a duração exata; os vizinhos continuam indo às batidas", () => {
    const segments = off(6);
    const locked = [false, false, true, false, false, false];
    const { cuts } = syncCutsToBeats(segments, beats, inf(6), { ...steady, locked });
    const d = durations(cuts, 13.2);
    expect(d[2]).toBeCloseTo(2.2, 6);
    // O corte que abre o travado é livre (cai numa batida); o que fecha é início + 2,2.
    expect(cuts[1]! % 0.5).toBeCloseTo(0, 6);
    expect(cuts[2]).toBeCloseTo(cuts[1]! + 2.2, 6);
    // Sem o travamento, o mesmo segmento seria ajustado para caber nas batidas.
    const free = syncCutsToBeats(segments, beats, inf(6), steady);
    expect(durations(free.cuts, 13.2)[2]).not.toBeCloseTo(2.2, 3);
  });

  it("travados no começo e no fim ficam ancorados nas pontas do vídeo", () => {
    const segments = off(6);
    const locked = [true, false, false, false, false, true];
    const { cuts } = syncCutsToBeats(segments, beats, inf(6), { ...steady, locked });
    expect(cuts[0]).toBeCloseTo(2.2, 6);
    expect(cuts[4]).toBeCloseTo(13.2 - 2.2, 6);
    expect(cuts.slice(1, 4).every((c) => Math.abs((c % 0.5) - 0) < 1e-6 || Math.abs((c % 0.5) - 0.5) < 1e-6)).toBe(
      true,
    );
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]!).toBeGreaterThan(cuts[i - 1]!);
  });

  it("tudo travado (ou só um livre): os cortes não saem do lugar", () => {
    const segments = off(4);
    const ideal = segments.slice(1).map((s) => s.startSec);
    expect(syncCutsToBeats(segments, beats, inf(4), { ...steady, locked: [true, true, true, true] }).cuts).toEqual(
      ideal,
    );
    expect(syncCutsToBeats(segments, beats, inf(4), { ...steady, locked: [true, false, true, true] }).cuts).toEqual(
      ideal,
    );
  });

  it("conta como alinhado o corte de um travado que termina numa batida", () => {
    // Travado de 2 s começando numa batida termina em outra batida.
    const segments = photos(4);
    const { stats } = syncCutsToBeats(segments, beats, inf(4), { ...steady, locked: [true, true, true, true] });
    expect(stats).toEqual({ snapped: 3, cuts: 3 });
  });

  it("buildTimeline: a duração definida à mão sobrevive à sincronia", () => {
    const photo = (id: string, durationSec?: number): TimelineItem => ({
      media: { id, kind: "image", uri: id, name: id, width: 4000, height: 3000, rotation: 0 } as MediaItem,
      ...(durationSec ? { overrides: { durationSec } } : {}),
    });
    const items = [photo("a"), photo("b"), photo("c", 3.37), photo("d"), photo("e"), photo("f")];
    const res = buildTimeline({
      items,
      settings: { ...DEFAULT_TIMELINE_SETTINGS, total: { mode: "items" } },
      music: { inSec: 0, outSec: 60 },
      beats: grid(60 / 124, 0, 60),
    });
    expect(res.segments.find((s) => s.mediaId === "c")!.durationSec).toBeCloseTo(3.37, 6);
    expect(res.durationSec).toBeCloseTo(13.37, 6);
    expect(res.beatSync!.snapped).toBeGreaterThanOrEqual(3);
  });
});

describe("mergeMarkers", () => {
  const detected = analyzeRhythm(grid(0.5, 0, 10));

  it("marcadores viram as batidas mais fortes e substituem a batida detectada colada neles", () => {
    const out = mergeMarkers(detected, [3.02, 7.3]);
    expect(out).toHaveLength(detected.length + 1); // 3.02 substitui a batida de 3.0
    const manual = out.filter((b) => b.manual);
    expect(manual.map((b) => b.timeSec)).toEqual([3.02, 7.3]);
    expect(manual.every((b) => b.strength === 1 && b.bar === 1 && b.boundary === 1)).toBe(true);
    expect(out.some((b) => b.timeSec === 3)).toBe(false);
    expect(out.map((b) => b.timeSec)).toEqual([...out.map((b) => b.timeSec)].sort((a, b) => a - b));
  });

  it("funciona sem batidas detectadas e ignora repetidos e negativos", () => {
    const out = mergeMarkers([], [5, 5, -1, 2]);
    expect(out.map((b) => b.timeSec)).toEqual([2, 5]);
    expect(mergeMarkers(detected, [])).toEqual(detected);
  });

  it("a sincronia leva um corte até o marcador, mesmo fora das batidas", () => {
    // Batidas a cada 0,5 s; um marcador em 4,27 s (entre duas batidas).
    const beats = mergeMarkers(analyzeRhythm(grid(0.5, 0, 12)), [4.27]);
    const { cuts } = syncCutsToBeats(photos(6), beats, inf(6), style("dynamic"));
    expect(cuts).toContain(4.27);
  });
});
