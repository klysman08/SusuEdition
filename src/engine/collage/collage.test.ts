import { describe, expect, it } from "vitest";

import { DEFAULT_FILTER, FILTER_PRESET_IDS, isNeutralFilter, NEUTRAL_ADJUST, resolveFilter } from "../render/filters";
import {
  cellAt,
  collageGeometry,
  collageSize,
  countSlots,
  cropWindow,
  DEFAULT_CROP,
  justified,
  layoutCells,
  layoutsFor,
  leaf,
  linearPartition,
  panCrop,
  previewSize,
  split,
  zoomCrop,
  buildLayout,
  type CollageDesign,
} from "./index";

const sq = { width: 1000, height: 1000 };

describe("layoutCells", () => {
  it("sem margem nem espaçamento, as células cobrem tudo", () => {
    const cells = layoutCells(split("row", [leaf(0), leaf(1)]), sq, { margin: 0, gap: 0 });
    expect(cells).toEqual([
      { slot: 0, x: 0, y: 0, w: 500, h: 1000 },
      { slot: 1, x: 500, y: 0, w: 500, h: 1000 },
    ]);
  });

  it("espaçamento uniforme e células iguais em qualquer nível", () => {
    // 3 colunas; a do meio dividida em 2 linhas.
    const tree = split("row", [leaf(0), split("col", [leaf(1), leaf(2)]), leaf(3)]);
    const cells = layoutCells(tree, { width: 1040, height: 1000 }, { margin: 20, gap: 10 });
    const [a, b, c, d] = cells;
    expect(a).toMatchObject({ x: 20, y: 20, h: 960 });
    expect(a!.w).toBeCloseTo(980 / 3, 6); // (1000 − 2×10)/3
    expect(b!.x - (a!.x + a!.w)).toBeCloseTo(10, 6);
    expect(c!.y - (b!.y + b!.h)).toBeCloseTo(10, 6);
    expect(b!.h).toBeCloseTo(c!.h, 6);
    expect(a!.w).toBeCloseTo(d!.w, 6);
    expect(d!.x + d!.w).toBeCloseTo(1020, 6);
  });

  it("margem e espaçamento exagerados não geram tamanhos negativos", () => {
    const cells = layoutCells(
      split("row", [leaf(0), leaf(1), leaf(2)]),
      { width: 100, height: 100 },
      { margin: 500, gap: 500 },
    );
    for (const c of cells) {
      expect(c.w).toBeGreaterThanOrEqual(1);
      expect(c.h).toBeGreaterThanOrEqual(1);
    }
  });

  it("cellAt encontra a célula e ignora o espaçamento", () => {
    const cells = layoutCells(split("row", [leaf(0), leaf(1)]), sq, { margin: 0, gap: 20 });
    expect(cellAt(cells, 100, 500)?.slot).toBe(0);
    expect(cellAt(cells, 500, 500)).toBeNull();
    expect(cellAt(cells, 900, 500)?.slot).toBe(1);
  });
});

describe("templates", () => {
  it("partição linear equilibra as somas mantendo a ordem", () => {
    expect(linearPartition([1, 1, 1, 1, 1, 1], 3)).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(linearPartition([3, 1, 1, 1], 2)).toEqual([[0], [1, 2, 3]]);
  });

  it("auto: fotos paisagem num quadro retrato viram linhas empilhadas", () => {
    const node = justified([1.5, 1.5, 1.5], { width: 1000, height: 1500 });
    const cells = layoutCells(node, { width: 1000, height: 1500 }, { margin: 0, gap: 0 });
    // 3 fotos 3:2 em 2:3 → uma por linha (cada célula 1000×500, proporção 2 ≈ 1,5).
    expect(cells.every((c) => Math.abs(c.w - 1000) < 1e-6)).toBe(true);
  });

  it("todos os templates têm exatamente uma célula por foto, sem formas repetidas", () => {
    for (let n = 1; n <= 24; n++) {
      const aspects = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 0.75 : 1.5));
      const list = layoutsFor(aspects, sq);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]!.id).toBe("auto");
      for (const t of list) {
        expect(countSlots(t.node)).toBe(n);
        const slots = layoutCells(t.node, sq, { margin: 0, gap: 0 }).map((c) => c.slot);
        expect(slots).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it("id incompatível com a quantidade cai no auto", () => {
    const aspects = [1, 1, 1];
    expect(buildLayout("rows:2-2", aspects, sq)).toEqual(buildLayout("auto", aspects, sq));
    expect(countSlots(buildLayout("rows:1-2", aspects, sq))).toBe(3);
  });

  it("grid cobre a área sem sobreposição", () => {
    const tree = buildLayout("grid", new Array(7).fill(1), sq);
    const cells = layoutCells(tree, sq, { margin: 0, gap: 0 });
    const area = cells.reduce((s, c) => s + c.w * c.h, 0);
    expect(area).toBeCloseTo(1_000_000, 3);
  });
});

describe("crop", () => {
  const photo = { width: 4000, height: 3000 }; // 4:3
  const cell = { width: 500, height: 500 };

  it("padrão: cover centralizado", () => {
    const w = cropWindow(photo, cell, DEFAULT_CROP);
    expect(w.w).toBeCloseTo(0.75, 6);
    expect(w.h).toBeCloseTo(1, 6);
    expect(w.x).toBeCloseTo(0.125, 6);
  });

  it("arrastar move a foto com o dedo e para nas bordas", () => {
    const moved = panCrop(photo, cell, DEFAULT_CROP, 100, 0); // dedo para a direita
    expect(cropWindow(photo, cell, moved).x).toBeLessThan(0.125);
    const edge = panCrop(photo, cell, DEFAULT_CROP, 10_000, 10_000);
    expect(cropWindow(photo, cell, edge)).toMatchObject({ x: 0, y: 0 });
  });

  it("zoom mantém fixo o ponto sob o cursor", () => {
    const before = cropWindow(photo, cell, DEFAULT_CROP);
    const anchor = { x: 0.25, y: 0.25 };
    const z = zoomCrop(photo, cell, DEFAULT_CROP, 2, anchor);
    const after = cropWindow(photo, cell, z);
    expect(after.w).toBeCloseTo(before.w / 2, 6);
    expect(after.x + anchor.x * after.w).toBeCloseTo(before.x + anchor.x * before.w, 6);
    expect(after.y + anchor.y * after.h).toBeCloseTo(before.y + anchor.y * before.h, 6);
  });
});

describe("tamanhos", () => {
  it("export: 1080 no lado menor, 2160 em alta, 4096 no lado maior em máxima", () => {
    expect(collageSize("4:5", "standard")).toEqual({ width: 1080, height: 1350 });
    expect(collageSize("16:9", "standard")).toEqual({ width: 1920, height: 1080 });
    expect(collageSize("9:16", "high")).toEqual({ width: 2160, height: 3840 });
    expect(collageSize("1:1", "max")).toEqual({ width: 4096, height: 4096 });
    expect(collageSize("3:4", "max")).toEqual({ width: 3072, height: 4096 });
    expect(collageSize("1:1", "max", 2048)).toEqual({ width: 2048, height: 2048 });
  });

  it("preview cabe na caixa com a mesma proporção", () => {
    expect(previewSize("9:16", { width: 900, height: 900 })).toEqual({ width: 506, height: 900 });
  });

  it("medidas acompanham a resolução: preview e export ficam proporcionais", () => {
    const design: CollageDesign = {
      aspect: "1:1",
      layoutId: "grid",
      margin: 40,
      spacing: 20,
      radius: 16,
      background: "#fff",
      crops: {},
      filter: DEFAULT_FILTER,
    };
    const photos = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, size: { width: 1200, height: 800 } }));
    const small = collageGeometry(design, photos, { width: 540, height: 540 });
    const big = collageGeometry(design, photos, { width: 2160, height: 2160 });
    expect(small.cells[0]!.x).toBeCloseTo(20, 6);
    expect(big.cells[0]!.x).toBeCloseTo(80, 6);
    expect(big.cells[1]!.w / big.cells[1]!.h).toBeCloseTo(small.cells[1]!.w / small.cells[1]!.h, 6);
    expect(big.windows).toEqual(small.windows);
    expect(big.radius).toBeCloseTo(32, 6);
  });
});

describe("filtros", () => {
  it("nenhum filtro = neutro (sem passe extra)", () => {
    expect(isNeutralFilter(resolveFilter(DEFAULT_FILTER))).toBe(true);
  });

  it("intensidade escala o preset e os ajustes somam por cima, com limites", () => {
    const half = resolveFilter({ preset: "mono", intensity: 0.5, adjust: NEUTRAL_ADJUST });
    expect(half.grayscale).toBeCloseTo(0.5, 6);
    const over = resolveFilter({ preset: "vivid", intensity: 1, adjust: { ...NEUTRAL_ADJUST, saturation: 0.9 } });
    expect(over.saturation).toBe(1);
    expect(isNeutralFilter(resolveFilter({ preset: "warm", intensity: 0, adjust: NEUTRAL_ADJUST }))).toBe(true);
  });

  it("todo preset (exceto none) altera a imagem", () => {
    for (const id of FILTER_PRESET_IDS.filter((p) => p !== "none")) {
      expect(isNeutralFilter(resolveFilter({ preset: id, intensity: 1, adjust: NEUTRAL_ADJUST }))).toBe(false);
    }
  });
});
