/// <reference lib="webworker" />
/**
 * Converte para JPEG as fotos que o app não decodifica direto: HEIC/HEIF (libheif em
 * WebAssembly) e AVIF (decodificador do próprio WebView). A orientação já sai aplicada.
 */
import libheifFactory from "libheif-js/libheif-wasm/libheif.js";
import wasmUrl from "libheif-js/libheif-wasm/libheif.wasm?url";

import type { ConvertImageRequest, ConvertImageResult } from "./convert-image";

declare const self: DedicatedWorkerGlobalScope;

/** Maior lado da cópia (o preview e a exportação nunca precisam de mais). */
const MAX_SIDE = 8192;
const JPEG_QUALITY = 0.92;

interface HeifImage {
  get_width(): number;
  get_height(): number;
  is_primary(): boolean;
  display(target: ImageData, done: (result: ImageData | null) => void): void;
  free(): void;
}
interface HeifModule {
  HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
}

let heif: Promise<HeifModule> | null = null;

function loadHeif(): Promise<HeifModule> {
  heif ??= (async () => {
    const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
    return new Promise<HeifModule>((resolve, reject) => {
      try {
        const factory = libheifFactory as unknown as (opts: object) => HeifModule;
        // Com o binário em mãos o runtime pode iniciar antes de a fábrica retornar:
        // resolve só depois, quando `mod` já existe.
        const mod: HeifModule = factory({
          wasmBinary,
          onRuntimeInitialized: () => queueMicrotask(() => resolve(mod)),
          print: () => {},
          printErr: () => {},
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  })();
  return heif;
}

async function decodeHeif(bytes: Uint8Array): Promise<ImageData> {
  const mod = await loadHeif();
  const images = new mod.HeifDecoder().decode(bytes);
  try {
    const image = images.find((i) => i.is_primary()) ?? images[0];
    if (!image) throw new Error("arquivo HEIF sem imagem");
    const target = new ImageData(image.get_width(), image.get_height());
    const out = await new Promise<ImageData | null>((resolve) => image.display(target, resolve));
    if (!out) throw new Error("falha ao decodificar o HEIF");
    return out;
  } finally {
    for (const i of images) i.free();
  }
}

async function toJpeg(source: ImageData | ImageBitmap): Promise<Blob> {
  const { width, height } = source;
  const s = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * s));
  const h = Math.max(1, Math.round(height * s));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D indisponível");
  if (source instanceof ImageData && s === 1) {
    ctx.putImageData(source, 0, 0);
  } else {
    const bmp = source instanceof ImageData ? await createImageBitmap(source) : source;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp !== source) bmp.close();
  }
  return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
}

async function convert(req: ConvertImageRequest): Promise<Blob> {
  if (req.format === "heif") return toJpeg(await decodeHeif(new Uint8Array(await req.blob.arrayBuffer())));
  const bmp = await createImageBitmap(req.blob, { imageOrientation: "from-image" });
  try {
    return await toJpeg(bmp);
  } finally {
    bmp.close();
  }
}

self.onmessage = (e: MessageEvent<ConvertImageRequest>) => {
  const req = e.data;
  convert(req).then(
    (jpeg) => self.postMessage({ id: req.id, ok: true, jpeg } satisfies ConvertImageResult),
    (err: unknown) =>
      self.postMessage({
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies ConvertImageResult),
  );
};
