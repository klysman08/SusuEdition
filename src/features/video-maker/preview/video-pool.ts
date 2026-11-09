interface Slot {
  el: HTMLVideoElement;
  mediaId: string | null;
  lastUsed: number;
}

/**
 * Pool pequeno de elementos <video> reaproveitados (decoders de hardware são
 * limitados, principalmente no Android). Ficam num contêiner invisível no DOM
 * para que o navegador continue decodificando quadros.
 */
export class VideoPool {
  private slots: Slot[] = [];
  private host: HTMLDivElement;

  constructor(
    private readonly onFrame: () => void,
    private readonly max = 4,
  ) {
    this.host = document.createElement("div");
    this.host.setAttribute("aria-hidden", "true");
    Object.assign(this.host.style, {
      position: "fixed",
      left: "-10px",
      top: "-10px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(this.host);
  }

  /** Elemento já associado a `mediaId`, ou um livre (o menos usado fora de `protect`). */
  acquire(mediaId: string, url: string, protect: ReadonlySet<string>): HTMLVideoElement {
    const now = performance.now();
    const hit = this.slots.find((s) => s.mediaId === mediaId);
    if (hit) {
      hit.lastUsed = now;
      return hit.el;
    }
    let slot: Slot | undefined;
    if (this.slots.length < this.max) {
      slot = { el: this.create(), mediaId: null, lastUsed: 0 };
      this.slots.push(slot);
    } else {
      slot =
        this.slots.filter((s) => !s.mediaId || !protect.has(s.mediaId)).sort((a, b) => a.lastUsed - b.lastUsed)[0] ??
        this.slots.sort((a, b) => a.lastUsed - b.lastUsed)[0]!;
    }
    slot.el.pause();
    slot.mediaId = mediaId;
    slot.lastUsed = now;
    slot.el.src = url;
    return slot.el;
  }

  peek(mediaId: string): HTMLVideoElement | null {
    return this.slots.find((s) => s.mediaId === mediaId)?.el ?? null;
  }

  /** Pausa e silencia vídeos que não estão em `active`. */
  pauseExcept(active: ReadonlySet<string>): void {
    for (const s of this.slots) {
      if (s.mediaId && !active.has(s.mediaId) && !s.el.paused) {
        s.el.pause();
        s.el.muted = true;
      }
    }
  }

  pauseAll(): void {
    for (const s of this.slots) s.el.pause();
  }

  dispose(): void {
    for (const s of this.slots) {
      s.el.pause();
      s.el.removeAttribute("src");
      s.el.load();
    }
    this.slots = [];
    this.host.remove();
  }

  private create(): HTMLVideoElement {
    const el = document.createElement("video");
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    el.disablePictureInPicture = true;
    for (const ev of ["seeked", "loadeddata", "canplay"]) el.addEventListener(ev, this.onFrame);
    // Avisa a cada quadro apresentado (inclusive o primeiro após uma busca).
    if ("requestVideoFrameCallback" in el) {
      const loop = () => {
        this.onFrame();
        el.requestVideoFrameCallback(loop);
      };
      el.requestVideoFrameCallback(loop);
    }
    this.host.appendChild(el);
    return el;
  }
}
