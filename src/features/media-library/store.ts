import { createStore, type StoreApi } from "zustand/vanilla";

import type { MediaKind, MediaMeta } from "@/engine/types";
import { trackMediaUsage } from "@/platform/media/usage";

export type ItemStatus = "pending" | "ready" | "error";

export interface LibraryItem {
  id: string;
  /**
   * Arquivo registrado de onde esta mídia vem, quando não é o próprio `id`: um vídeo
   * dividido vira várias mídias que apontam para o mesmo arquivo.
   */
  sourceId?: string;
  kind: MediaKind;
  name: string;
  /** Caminho/URI do arquivo original — é o que o projeto salvo guarda para reabri-lo. */
  uri?: string;
  size: number;
  modifiedMs?: number;
  status: ItemStatus;
  /** `"missing"`: o arquivo não foi encontrado ao reabrir o projeto. */
  error?: string;
  meta?: MediaMeta;
  thumbUrl?: string;
}

export type SortMode = "dateAsc" | "dateDesc" | "nameAsc" | "shuffle";

export interface ItemUpdate {
  id: string;
  patch: Partial<Omit<LibraryItem, "id">>;
}

export interface MediaLibraryState {
  /** Ordem atual (= ordem da timeline do Video Maker). */
  order: string[];
  items: Record<string, LibraryItem>;
  selected: Record<string, true>;
  selectMode: boolean;
  /** Progresso do processamento em andamento. */
  progress: { total: number; done: number };

  addItems: (items: LibraryItem[]) => void;
  applyUpdates: (updates: ItemUpdate[]) => void;
  remove: (ids: string[]) => void;
  clear: () => void;
  move: (activeId: string, overId: string) => void;
  /** Troca duas mídias de posição (colagem: trocar fotos de célula). */
  swap: (a: string, b: string) => void;
  /** Nova ordem com exatamente as mesmas mídias (arrastar na faixa do tempo). */
  setOrder: (order: readonly string[]) => void;
  /** Cópia de uma mídia logo depois dela, apontando para o mesmo arquivo (dividir). */
  duplicate: (id: string, newId: string) => void;
  /** Troca uma mídia por outra na mesma posição (religar um arquivo ausente). */
  replaceItem: (id: string, item: LibraryItem) => void;
  /** Substitui mídias e ordem de uma vez (desfazer/refazer). */
  restore: (order: readonly string[], items: Readonly<Record<string, LibraryItem>>) => void;
  sort: (mode: SortMode) => void;
  setSelectMode: (on: boolean) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  beginProgress: (count: number) => void;
  advanceProgress: (count: number) => void;
}

export type MediaLibraryStore = StoreApi<MediaLibraryState>;

/** Id do arquivo registrado (URLs, thumbnails e cache usam este id). */
export function sourceOf(item: Pick<LibraryItem, "id" | "sourceId">): string {
  return item.sourceId ?? item.id;
}

/** Arquivos (sem repetição) usados pelas mídias `ids`. */
export function sourceIds(items: Readonly<Record<string, LibraryItem>>, ids: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const item = items[id];
    if (item) out.add(sourceOf(item));
  }
  return [...out];
}

/** Chave de data: captura (EXIF/metadado) → data de modificação do arquivo. */
export function dateKey(item: LibraryItem): number {
  return item.meta?.capturedAt ?? item.modifiedMs ?? 0;
}

function shuffled<T>(arr: T[], random = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortOrder(
  order: string[],
  items: Record<string, LibraryItem>,
  mode: SortMode,
  random = Math.random,
): string[] {
  if (mode === "shuffle") return shuffled(order, random);
  const list = order.map((id) => items[id]!).filter(Boolean);
  const cmp: Record<Exclude<SortMode, "shuffle">, (a: LibraryItem, b: LibraryItem) => number> = {
    dateAsc: (a, b) => dateKey(a) - dateKey(b) || collator.compare(a.name, b.name),
    dateDesc: (a, b) => dateKey(b) - dateKey(a) || collator.compare(a.name, b.name),
    nameAsc: (a, b) => collator.compare(a.name, b.name),
  };
  return list.sort(cmp[mode]).map((i) => i.id);
}

export function createMediaLibraryStore(): MediaLibraryStore {
  const store = createStore<MediaLibraryState>()((set) => ({
    order: [],
    items: {},
    selected: {},
    selectMode: false,
    progress: { total: 0, done: 0 },

    addItems: (newItems) =>
      set((s) => {
        const fresh = newItems.filter((i) => !s.items[i.id]);
        if (fresh.length === 0) return s;
        const items = { ...s.items };
        for (const i of fresh) items[i.id] = i;
        return { items, order: [...s.order, ...fresh.map((i) => i.id)] };
      }),

    applyUpdates: (updates) =>
      set((s) => {
        let items: Record<string, LibraryItem> | null = null;
        for (const { id, patch } of updates) {
          const cur = (items ?? s.items)[id];
          if (!cur) continue; // removido enquanto processava
          items ??= { ...s.items };
          items[id] = { ...cur, ...patch };
        }
        return items ? { items } : s;
      }),

    remove: (ids) =>
      set((s) => {
        const drop = new Set(ids);
        const items = { ...s.items };
        const selected = { ...s.selected };
        for (const id of ids) {
          delete items[id];
          delete selected[id];
        }
        return { items, selected, order: s.order.filter((id) => !drop.has(id)) };
      }),

    clear: () => set({ order: [], items: {}, selected: {}, selectMode: false }),

    move: (activeId, overId) =>
      set((s) => {
        const from = s.order.indexOf(activeId);
        const to = s.order.indexOf(overId);
        if (from < 0 || to < 0 || from === to) return s;
        const order = s.order.slice();
        order.splice(from, 1);
        order.splice(to, 0, activeId);
        return { order };
      }),

    swap: (a, b) =>
      set((s) => {
        const i = s.order.indexOf(a);
        const j = s.order.indexOf(b);
        if (i < 0 || j < 0 || i === j) return s;
        const order = s.order.slice();
        order[i] = b;
        order[j] = a;
        return { order };
      }),

    setOrder: (order) =>
      set((s) => {
        const same = order.length === s.order.length && new Set(order).size === order.length;
        return same && order.every((id) => s.items[id]) ? { order: [...order] } : s;
      }),

    duplicate: (id, newId) =>
      set((s) => {
        const item = s.items[id];
        const at = s.order.indexOf(id);
        if (!item || at < 0 || s.items[newId]) return s;
        const order = s.order.slice();
        order.splice(at + 1, 0, newId);
        return { order, items: { ...s.items, [newId]: { ...item, id: newId, sourceId: sourceOf(item) } } };
      }),

    replaceItem: (id, item) =>
      set((s) => {
        if (!s.items[id] || (item.id !== id && s.items[item.id])) return s;
        const items = { ...s.items };
        const selected = { ...s.selected };
        delete items[id];
        delete selected[id];
        items[item.id] = item;
        return { items, selected, order: s.order.map((x) => (x === id ? item.id : x)) };
      }),

    restore: (order, items) =>
      set(() => ({ order: order.filter((id) => items[id]), items: { ...items }, selected: {}, selectMode: false })),

    sort: (mode) => set((s) => ({ order: sortOrder(s.order, s.items, mode) })),

    setSelectMode: (on) => set(on ? { selectMode: true } : { selectMode: false, selected: {} }),
    toggleSelected: (id) =>
      set((s) => {
        const selected = { ...s.selected };
        if (selected[id]) delete selected[id];
        else selected[id] = true;
        return { selected };
      }),
    selectAll: () => set((s) => ({ selected: Object.fromEntries(s.order.map((id) => [id, true as const])) })),
    clearSelection: () => set({ selected: {} }),

    beginProgress: (count) =>
      set((s) => {
        const busy = s.progress.done < s.progress.total;
        return { progress: busy ? { ...s.progress, total: s.progress.total + count } : { total: count, done: 0 } };
      }),
    advanceProgress: (count) =>
      set((s) => ({ progress: { ...s.progress, done: Math.min(s.progress.total, s.progress.done + count) } })),
  }));
  trackMediaUsage(() => Object.values(store.getState().items).map(sourceOf));
  return store;
}

export interface LibrarySummary {
  photos: number;
  videos: number;
  videoSeconds: number;
  errors: number;
}

export function summarize(state: Pick<MediaLibraryState, "order" | "items">): LibrarySummary {
  const sum: LibrarySummary = { photos: 0, videos: 0, videoSeconds: 0, errors: 0 };
  for (const id of state.order) {
    const it = state.items[id];
    if (!it) continue;
    if (it.status === "error") sum.errors++;
    if (it.kind === "image") sum.photos++;
    else if (it.kind === "video") {
      sum.videos++;
      sum.videoSeconds += it.meta?.durationSec ?? 0;
    }
  }
  return sum;
}
