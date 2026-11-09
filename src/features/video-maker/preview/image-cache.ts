import { decodeSize } from "@/engine/render";
import type { Size } from "@/engine/types";

interface Entry {
  thumb: ImageBitmap | null;
  full: ImageBitmap | null;
  loadingThumb: boolean;
  loadingFull: boolean;
  bytes: number;
  lastUsed: number;
}

export interface ImageRequest {
  id: string;
  url: string;
  thumbUrl?: string;
  /** Tamanho de exibição original (EXIF aplicado). */
  size: Size;
}

async function decode(url: string, resize?: Size): Promise<ImageBitmap> {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, {
    imageOrientation: "from-image",
    ...(resize ? { resizeWidth: resize.width, resizeHeight: resize.height, resizeQuality: "high" } : {}),
  });
}

/**
 * Fotos decodificadas para o preview, já reduzidas para a resolução de saída.
 * Primeiro o thumbnail (rápido, placeholder), depois a versão cheia.
 * LRU com orçamento de memória e no máximo 2 decodificações simultâneas.
 */
export class ImageCache {
  private entries = new Map<string, Entry>();
  private queue: { req: ImageRequest; target: Size }[] = [];
  private active = 0;
  private disposed = false;

  constructor(
    private readonly onLoaded: () => void,
    private readonly budgetBytes = 192 * 1024 * 1024,
    private readonly maxParallel = 2,
  ) {}

  /** Melhor bitmap disponível agora (cheio > thumb), disparando o carregamento se preciso. */
  get(req: ImageRequest, target: Size, priority: boolean): ImageBitmap | null {
    const e = this.entry(req.id);
    e.lastUsed = performance.now();
    if (!e.thumb && !e.loadingThumb && req.thumbUrl) {
      e.loadingThumb = true;
      decode(req.thumbUrl)
        .then((bmp) => this.store(req.id, "thumb", bmp))
        .catch(() => {});
    }
    if (!e.full && !e.loadingFull) {
      e.loadingFull = true;
      const job = { req, target };
      if (priority) this.queue.unshift(job);
      else this.queue.push(job);
      this.pump();
    }
    return e.full ?? e.thumb;
  }

  /** Pré-carrega sem retornar nada. */
  prefetch(req: ImageRequest, target: Size): void {
    this.get(req, target, false);
  }

  dispose(): void {
    this.disposed = true;
    for (const e of this.entries.values()) {
      e.thumb?.close();
      e.full?.close();
    }
    this.entries.clear();
    this.queue = [];
  }

  private entry(id: string): Entry {
    let e = this.entries.get(id);
    if (!e) {
      e = { thumb: null, full: null, loadingThumb: false, loadingFull: false, bytes: 0, lastUsed: 0 };
      this.entries.set(id, e);
    }
    return e;
  }

  private store(id: string, kind: "thumb" | "full", bmp: ImageBitmap) {
    const e = this.entries.get(id);
    if (this.disposed || !e) {
      bmp.close();
      return;
    }
    e[kind]?.close();
    e[kind] = bmp;
    e.bytes = (e.thumb ? e.thumb.width * e.thumb.height * 4 : 0) + (e.full ? e.full.width * e.full.height * 4 : 0);
    this.evict(id);
    this.onLoaded();
  }

  private pump() {
    while (this.active < this.maxParallel && this.queue.length > 0) {
      const { req, target } = this.queue.shift()!;
      if (!this.entries.has(req.id)) continue;
      this.active++;
      decode(req.url, decodeSize(req.size, target))
        .then((bmp) => this.store(req.id, "full", bmp))
        .catch(() => {
          const e = this.entries.get(req.id);
          if (e) e.loadingFull = false;
        })
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }

  private evict(keep: string) {
    let total = 0;
    for (const e of this.entries.values()) total += e.bytes;
    if (total <= this.budgetBytes) return;
    const lru = [...this.entries.entries()].filter(([id]) => id !== keep).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [id, e] of lru) {
      if (total <= this.budgetBytes) break;
      total -= e.bytes;
      e.thumb?.close();
      e.full?.close();
      this.entries.delete(id);
    }
  }
}
