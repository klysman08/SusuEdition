/// <reference lib="webworker" />
/**
 * Export da colagem (RF-C7) num Worker: decodifica cada foto só no tamanho que a
 * célula precisa, desenha com o mesmo renderizador do preview num OffscreenCanvas
 * e codifica PNG/JPEG. A página continua responsiva mesmo em 4096 px.
 */
import { photoDecodeSize, DEFAULT_CROP } from "./crop";
import { collageGeometry, resolvedFilter } from "./scene";
import type { CollageExportRequest, CollageExportMessage } from "./export-protocol";
import { createCollageRenderer, type SceneCell } from "./renderer";

const post = (m: CollageExportMessage, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

async function decode(url: string, width: number, height: number): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob, {
    imageOrientation: "from-image",
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "high",
  });
}

async function run(req: CollageExportRequest) {
  const { design, photos, size } = req;
  const canvas = new OffscreenCanvas(size.width, size.height);
  const renderer = createCollageRenderer(canvas, { preserveDrawingBuffer: true });
  if (Math.max(size.width, size.height) > renderer.maxSize) {
    renderer.dispose();
    throw new Error(`GPU limitada a ${renderer.maxSize}px`);
  }

  const geo = collageGeometry(design, photos, size);
  const bitmaps: (ImageBitmap | null)[] = new Array(geo.cells.length).fill(null);
  let done = 0;
  let next = 0;
  // Poucas decodificações simultâneas: memória previsível com 50+ fotos grandes.
  const worker = async () => {
    while (next < geo.cells.length) {
      const i = next++;
      const cell = geo.cells[i]!;
      const photo = photos[cell.slot]!;
      const zoom = (design.crops[photo.id] ?? DEFAULT_CROP).zoom;
      const target = photoDecodeSize(photo.size, { width: cell.w, height: cell.h }, zoom);
      bitmaps[i] = await decode(photo.url, target.width, target.height);
      post({ type: "progress", loaded: ++done, total: geo.cells.length });
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, geo.cells.length) }, worker));

    const cells: SceneCell[] = geo.cells.map((c, i) => ({
      rect: c,
      key: `${i}`,
      source: bitmaps[i] ?? null,
      window: geo.windows[i]!,
    }));
    renderer.render({
      size,
      background: design.background,
      radius: geo.radius,
      cells,
      filter: resolvedFilter(design),
    });
    post({ type: "encoding" });
    const blob = await canvas.convertToBlob({
      type: req.format === "png" ? "image/png" : "image/jpeg",
      quality: req.format === "jpeg" ? req.quality : undefined,
    });
    const buffer = await blob.arrayBuffer();
    post({ type: "done", buffer, mime: blob.type }, [buffer]);
  } finally {
    for (const b of bitmaps) b?.close();
    renderer.dispose({ releaseContext: true });
  }
}

self.onmessage = (e: MessageEvent<CollageExportRequest>) => {
  run(e.data).catch((err: unknown) =>
    post({ type: "error", message: err instanceof Error ? err.message : String(err) }),
  );
};
