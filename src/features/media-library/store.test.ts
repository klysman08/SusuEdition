import { describe, expect, it } from "vitest";

import { createMediaLibraryStore, sortOrder, summarize, type LibraryItem } from "./store";

const item = (id: string, patch: Partial<LibraryItem> = {}): LibraryItem => ({
  id,
  kind: "image",
  name: `${id}.jpg`,
  size: 1,
  status: "pending",
  ...patch,
});

describe("media library store", () => {
  it("adiciona sem duplicar e preserva a ordem", () => {
    const store = createMediaLibraryStore();
    store.getState().addItems([item("a"), item("b")]);
    store.getState().addItems([item("b"), item("c")]);
    expect(store.getState().order).toEqual(["a", "b", "c"]);
  });

  it("aplica atualizações em lote e ignora itens removidos", () => {
    const store = createMediaLibraryStore();
    store.getState().addItems([item("a"), item("b")]);
    store.getState().remove(["b"]);
    store.getState().applyUpdates([
      { id: "a", patch: { status: "ready", thumbUrl: "t" } },
      { id: "b", patch: { status: "ready" } },
    ]);
    expect(store.getState().items.a).toMatchObject({ status: "ready", thumbUrl: "t" });
    expect(store.getState().items.b).toBeUndefined();
  });

  it("move um item para a posição de outro", () => {
    const store = createMediaLibraryStore();
    store.getState().addItems(["a", "b", "c", "d"].map((id) => item(id)));
    store.getState().move("a", "c");
    expect(store.getState().order).toEqual(["b", "c", "a", "d"]);
    store.getState().move("d", "b");
    expect(store.getState().order).toEqual(["d", "b", "c", "a"]);
  });

  it("seleção: alterna, seleciona tudo e limpa ao sair do modo", () => {
    const store = createMediaLibraryStore();
    store.getState().addItems([item("a"), item("b")]);
    store.getState().setSelectMode(true);
    store.getState().toggleSelected("a");
    expect(store.getState().selected).toEqual({ a: true });
    store.getState().selectAll();
    expect(Object.keys(store.getState().selected)).toEqual(["a", "b"]);
    store.getState().setSelectMode(false);
    expect(store.getState().selected).toEqual({});
  });

  it("progresso acumula imports simultâneos", () => {
    const store = createMediaLibraryStore();
    store.getState().beginProgress(10);
    store.getState().advanceProgress(4);
    store.getState().beginProgress(5);
    expect(store.getState().progress).toEqual({ total: 15, done: 4 });
  });
});

describe("sortOrder", () => {
  const items = {
    a: item("a", {
      name: "IMG_10.jpg",
      meta: { kind: "image", width: 1, height: 1, rotation: 0, thumbExt: "jpg", capturedAt: 300 },
    }),
    b: item("b", { name: "IMG_2.jpg", modifiedMs: 100 }),
    c: item("c", {
      name: "IMG_1.jpg",
      meta: { kind: "image", width: 1, height: 1, rotation: 0, thumbExt: "jpg", capturedAt: 200 },
    }),
  };
  const order = ["a", "b", "c"];

  it("data usa a captura e cai para a modificação do arquivo", () => {
    expect(sortOrder(order, items, "dateAsc")).toEqual(["b", "c", "a"]);
    expect(sortOrder(order, items, "dateDesc")).toEqual(["a", "c", "b"]);
  });

  it("nome usa ordenação natural (IMG_2 antes de IMG_10)", () => {
    expect(sortOrder(order, items, "nameAsc")).toEqual(["c", "b", "a"]);
  });

  it("embaralhar mantém os mesmos itens", () => {
    let seed = 0.42;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const result = sortOrder(order, items, "shuffle", random);
    expect([...result].sort()).toEqual(order);
  });
});

describe("summarize", () => {
  it("conta fotos, vídeos, duração e erros", () => {
    const s = summarize({
      order: ["a", "b", "c"],
      items: {
        a: item("a"),
        b: item("b", {
          kind: "video",
          meta: { kind: "video", width: 1, height: 1, rotation: 0, thumbExt: "webp", durationSec: 12.5 },
        }),
        c: item("c", { kind: "video", status: "error" }),
      },
    });
    expect(s).toEqual({ photos: 1, videos: 2, videoSeconds: 12.5, errors: 1 });
  });
});
