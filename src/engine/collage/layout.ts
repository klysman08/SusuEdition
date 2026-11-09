/**
 * Layouts de colagem como árvores de divisão (linhas/colunas com pesos).
 *
 * Uma árvore garante espaçamento uniforme: em cada divisão, o espaço disponível é
 * `tamanho − (filhos − 1) × espaçamento` e é repartido pelos pesos — então células
 * "iguais" ficam realmente iguais, em qualquer nível de aninhamento.
 */
import type { Size } from "../types";

export type LayoutNode = { slot: number } | { dir: "row" | "col"; children: { weight: number; node: LayoutNode }[] };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Retângulo de uma célula em px da saída, já com margem e espaçamento. */
export interface CellRect extends Rect {
  slot: number;
}

export interface Spacing {
  /** Margem externa (px da saída). */
  margin: number;
  /** Espaço entre células (px da saída). */
  gap: number;
}

export const leaf = (slot: number): LayoutNode => ({ slot });

/** Divisão com pesos iguais (ou os pesos informados). */
export function split(dir: "row" | "col", nodes: LayoutNode[], weights?: number[]): LayoutNode {
  return { dir, children: nodes.map((node, i) => ({ weight: weights?.[i] ?? 1, node })) };
}

export function countSlots(node: LayoutNode): number {
  return "slot" in node ? 1 : node.children.reduce((n, c) => n + countSlots(c.node), 0);
}

/**
 * Posiciona cada célula em px. Margem e espaçamento são limitados para nunca
 * deixar uma célula com tamanho negativo (no mínimo 1 px).
 */
export function layoutCells(root: LayoutNode, size: Size, spacing: Spacing): CellRect[] {
  const margin = Math.max(0, Math.min(spacing.margin, size.width / 2 - 1, size.height / 2 - 1));
  const out: CellRect[] = [];
  const gap = Math.max(0, spacing.gap);

  const walk = (node: LayoutNode, r: Rect) => {
    if ("slot" in node) {
      out.push({ slot: node.slot, x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h) });
      return;
    }
    const n = node.children.length;
    const along = node.dir === "row" ? r.w : r.h;
    const g = n > 1 ? Math.min(gap, (along - n) / (n - 1)) : 0;
    const free = Math.max(n, along - g * (n - 1));
    const total = node.children.reduce((s, c) => s + c.weight, 0) || 1;
    let pos = node.dir === "row" ? r.x : r.y;
    for (const c of node.children) {
      const len = (free * c.weight) / total;
      walk(c.node, node.dir === "row" ? { x: pos, y: r.y, w: len, h: r.h } : { x: r.x, y: pos, w: r.w, h: len });
      pos += len + g;
    }
  };

  walk(root, { x: margin, y: margin, w: size.width - 2 * margin, h: size.height - 2 * margin });
  return out.sort((a, b) => a.slot - b.slot);
}

/** Célula sob um ponto (px da saída), ou `null` (margem/espaçamento). */
export function cellAt(cells: readonly CellRect[], x: number, y: number): CellRect | null {
  return cells.find((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) ?? null;
}
