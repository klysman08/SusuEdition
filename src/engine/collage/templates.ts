/**
 * Templates de layout por quantidade de fotos (RF-C3).
 *
 * Os ids são estáveis e descrevem a forma; a árvore é gerada para `n` fotos:
 * - `auto`      linhas justificadas pelas proporções das fotos (menor corte possível)
 * - `grid`      grade equilibrada para o formato de saída
 * - `rows:2-3`  linhas com 2 e 3 fotos · `cols:2-3` o mesmo em colunas
 * - `feature-left|top|right|bottom`  uma foto em destaque + as demais ao lado
 */
import type { Size } from "../types";
import { countSlots, leaf, split, type LayoutNode } from "./layout";

export interface LayoutTemplate {
  id: string;
  node: LayoutNode;
}

const MAX_TEMPLATES = 14;

/** Grupos sequenciais com somas equilibradas (partição linear, minimiza a maior soma). */
export function linearPartition(values: readonly number[], groups: number): number[][] {
  const n = values.length;
  const k = Math.max(1, Math.min(groups, n));
  const prefix = [0];
  for (const v of values) prefix.push(prefix.at(-1)! + v);
  // cost[i][j]: melhor "maior soma" dividindo os i primeiros em j grupos.
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(Infinity));
  const cut = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0));
  cost[0]![0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= Math.min(i, k); j++) {
      for (let p = j - 1; p < i; p++) {
        const c = Math.max(cost[p]![j - 1]!, prefix[i]! - prefix[p]!);
        if (c < cost[i]![j]!) {
          cost[i]![j] = c;
          cut[i]![j] = p;
        }
      }
    }
  }
  const out: number[][] = [];
  let i = n;
  for (let j = k; j > 0; j--) {
    const p = cut[i]![j]!;
    out.unshift(Array.from({ length: i - p }, (_, t) => p + t));
    i = p;
  }
  return out;
}

/**
 * Linhas justificadas: cada foto mantém a proporção dentro da linha e as linhas
 * dividem a altura pela "altura natural". Todas as células ficam com o mesmo fator
 * de corte; escolhe-se o número de linhas (ou colunas) que o deixa mais perto de 1.
 */
export function justified(aspects: readonly number[], out: Size, firstSlot = 0): LayoutNode {
  const n = aspects.length;
  const outAspect = out.width / out.height;
  let best: { node: LayoutNode; score: number } | null = null;

  for (const dir of ["rows", "cols"] as const) {
    // Em colunas, troca-se largura por altura.
    const a = aspects.map((x) => (dir === "rows" ? x : 1 / x));
    const target = dir === "rows" ? outAspect : 1 / outAspect;
    for (let r = 1; r <= Math.min(n, 8); r++) {
      const groups = linearPartition(a, r);
      const sums = groups.map((g) => g.reduce((s, i) => s + a[i]!, 0));
      const t = sums.reduce((s, x) => s + 1 / x, 0);
      // Fator de corte de cada célula: proporção da célula / proporção da foto.
      const score = Math.abs(Math.log(target * t)) + (dir === "cols" ? 1e-3 : 0);
      if (!best || score < best.score - 1e-9) {
        const lines = groups.map((g) =>
          g.length === 1
            ? leaf(firstSlot + g[0]!)
            : split(
                dir === "rows" ? "row" : "col",
                g.map((i) => leaf(firstSlot + i)),
                g.map((i) => a[i]!),
              ),
        );
        const node =
          lines.length === 1
            ? lines[0]!
            : split(
                dir === "rows" ? "col" : "row",
                lines,
                sums.map((s) => 1 / s),
              );
        best = { node, score };
      }
    }
  }
  return best!.node;
}

/** Contagens por linha equilibradas (as linhas com uma foto a mais ficam por último). */
function balanced(n: number, lines: number): number[] {
  const base = Math.floor(n / lines);
  const extra = n % lines;
  return Array.from({ length: lines }, (_, i) => base + (i >= lines - extra ? 1 : 0));
}

/** Linhas (`row`) ou colunas (`col`) com as contagens dadas, a partir de `first`. */
function lines(dir: "rows" | "cols", counts: readonly number[], first = 0): LayoutNode {
  let slot = first;
  const inner = dir === "rows" ? "row" : "col";
  const nodes = counts.map((c) => {
    const cells = Array.from({ length: c }, () => leaf(slot++));
    return c === 1 ? cells[0]! : split(inner, cells);
  });
  return nodes.length === 1 ? nodes[0]! : split(dir === "rows" ? "col" : "row", nodes);
}

/** Grade equilibrada: colunas escolhidas para células próximas de quadradas. */
export function grid(n: number, out: Size, first = 0): LayoutNode {
  if (n <= 1) return leaf(first);
  const aspect = out.width / out.height;
  let bestCols = 1;
  let bestScore = Infinity;
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    const cellAspect = aspect * (r / c);
    // Penaliza células vazias implícitas (linhas incompletas).
    const score = Math.abs(Math.log(cellAspect)) + 0.15 * (r * c - n);
    if (score < bestScore) {
      bestScore = score;
      bestCols = c;
    }
  }
  const rows = Math.ceil(n / bestCols);
  return lines("rows", balanced(n, rows), first);
}

type Side = "left" | "top" | "right" | "bottom";

function feature(n: number, out: Size, side: Side): LayoutNode {
  const hero = leaf(0);
  if (n === 1) return hero;
  const horizontal = side === "left" || side === "right";
  const heroWeight = n <= 4 ? 2 : 1.6;
  const share = 1 / (heroWeight + 1);
  const restSize = horizontal
    ? { width: out.width * share, height: out.height }
    : { width: out.width, height: out.height * share };
  // Até 4 fotos: uma fileira ao lado do destaque. Mais: grade no espaço restante.
  const rest = n - 1 <= 4 ? lines(horizontal ? "cols" : "rows", [n - 1], 1) : grid(n - 1, restSize, 1);
  const first = side === "left" || side === "top";
  return split(
    horizontal ? "row" : "col",
    first ? [hero, rest] : [rest, hero],
    first ? [heroWeight, 1] : [1, heroWeight],
  );
}

/** Composições de `n` em `k` partes equilibradas (diferença máx. 1), sem repetir. */
function compositions(n: number, k: number, maxPart: number): number[][] {
  const out: number[][] = [];
  const rec = (left: number, parts: number[]) => {
    if (parts.length === k) {
      if (left === 0 && Math.max(...parts) - Math.min(...parts) <= 1) out.push(parts.slice());
      return;
    }
    for (let p = 1; p <= Math.min(maxPart, left); p++) rec(left - p, [...parts, p]);
  };
  rec(n, []);
  return out;
}

function parseCounts(s: string): number[] | null {
  const counts = s.split("-").map(Number);
  return counts.every((c) => Number.isInteger(c) && c > 0) ? counts : null;
}

/**
 * Árvore do template `id` para `n` fotos. Ids desconhecidos ou incompatíveis com `n`
 * caem no `auto` — trocar a quantidade de fotos nunca quebra a colagem.
 */
export function buildLayout(id: string, aspects: readonly number[], out: Size): LayoutNode {
  const n = aspects.length;
  if (n <= 1) return leaf(0);
  if (id === "grid") return grid(n, out);
  if (id.startsWith("feature-")) {
    const side = id.slice(8) as Side;
    if (["left", "top", "right", "bottom"].includes(side)) return feature(n, out, side);
  }
  const m = /^(rows|cols):(.+)$/.exec(id);
  if (m) {
    const counts = parseCounts(m[2]!);
    if (counts && counts.reduce((s, c) => s + c, 0) === n) return lines(m[1] as "rows" | "cols", counts);
  }
  return justified(aspects, out);
}

const key = (node: LayoutNode): string =>
  "slot" in node
    ? `${node.slot}`
    : `${node.dir}(${node.children.map((c) => `${c.weight.toFixed(3)}:${key(c.node)}`).join(",")})`;

/** Templates disponíveis para a quantidade de fotos (sem formas repetidas). */
export function layoutsFor(aspects: readonly number[], out: Size): LayoutTemplate[] {
  const n = aspects.length;
  if (n <= 1) return [{ id: "auto", node: leaf(0) }];
  const ids = ["auto", "grid"];
  for (const side of ["left", "top", "right", "bottom"]) ids.push(`feature-${side}`);
  for (let k = 1; k <= Math.min(4, n); k++) {
    for (const counts of compositions(n, k, 5)) {
      if (k === 1 && n > 4) continue;
      ids.push(`rows:${counts.join("-")}`, `cols:${counts.join("-")}`);
    }
  }
  const seen = new Set<string>();
  const out2: LayoutTemplate[] = [];
  for (const id of ids) {
    const node = buildLayout(id, aspects, out);
    if (countSlots(node) !== n) continue;
    const k = key(node);
    if (seen.has(k) && id !== "auto") continue;
    seen.add(k);
    out2.push({ id, node });
    if (out2.length >= MAX_TEMPLATES) break;
  }
  return out2;
}
