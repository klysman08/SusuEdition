import type { Size } from "../types";
import type { CollageDesign, CollagePhoto, ImageFormat } from "./scene";

export interface CollageExportRequest {
  design: CollageDesign;
  /** Na ordem dos slots; `url` é lida pelo worker (protocolo `susu://` ou blob:). */
  photos: (CollagePhoto & { url: string })[];
  size: Size;
  format: ImageFormat;
  /** JPEG: 0..1 */
  quality: number;
}

export type CollageExportMessage =
  | { type: "progress"; loaded: number; total: number }
  | { type: "encoding" }
  | { type: "done"; buffer: ArrayBuffer; mime: string }
  | { type: "error"; message: string };

export interface CollageExportHandle {
  finished: Promise<{ type: "done"; bytes: Uint8Array } | { type: "cancelled" } | { type: "error"; message: string }>;
  cancel(): void;
}

/** Inicia o export num worker dedicado (encerrado ao terminar ou cancelar). */
export function startCollageExport(
  req: CollageExportRequest,
  onMessage: (m: Exclude<CollageExportMessage, { type: "done" | "error" }>) => void,
): CollageExportHandle {
  const worker = new Worker(new URL("./export.worker.ts", import.meta.url), { type: "module", name: "susu-collage" });
  let settle: (r: Awaited<CollageExportHandle["finished"]>) => void = () => {};
  const finished = new Promise<Awaited<CollageExportHandle["finished"]>>((resolve) => (settle = resolve));
  const end = (r: Awaited<CollageExportHandle["finished"]>) => {
    worker.terminate();
    settle(r);
  };
  worker.onmessage = (e: MessageEvent<CollageExportMessage>) => {
    const m = e.data;
    if (m.type === "done") end({ type: "done", bytes: new Uint8Array(m.buffer) });
    else if (m.type === "error") end({ type: "error", message: m.message });
    else onMessage(m);
  };
  worker.onerror = (e) => end({ type: "error", message: e.message || "worker" });
  worker.postMessage(req);
  return { finished, cancel: () => end({ type: "cancelled" }) };
}
