/**
 * Exportação de vídeo (M4): worker com decodificação, composição WebGL, H.264/AAC
 * e mux MP4 em streaming. A escrita em disco fica com quem chama (`onChunk`).
 */
import type { ChunkAck, ChunkMessage, ExportJob, FromWorker } from "./protocol";

export * from "./plan";
export type * from "./protocol";

export interface ExportCallbacks {
  onMessage: (m: FromWorker) => void;
  /** Grava um pedaço do MP4 (posição + bytes). Deve resolver quando estiver persistido. */
  onChunk: (position: number, data: Uint8Array) => Promise<void>;
}

export interface ExportHandle {
  /** Resolve quando terminar (done/cancelled/error já entregues em `onMessage`). */
  finished: Promise<FromWorker>;
  cancel: () => void;
}

export function startExport(job: ExportJob, cb: ExportCallbacks): ExportHandle {
  const worker = new Worker(new URL("./export.worker.ts", import.meta.url), { type: "module", name: "susu-export" });
  const channel = new MessageChannel();

  channel.port1.onmessage = async (e: MessageEvent<ChunkMessage>) => {
    const { id, position, data } = e.data;
    const ack: ChunkAck = { id };
    try {
      await cb.onChunk(position, data);
    } catch (err) {
      ack.error = err instanceof Error ? err.message : String(err);
    }
    channel.port1.postMessage(ack);
  };

  const finished = new Promise<FromWorker>((resolve) => {
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      cb.onMessage(e.data);
      if (e.data.type === "done" || e.data.type === "cancelled" || e.data.type === "error") {
        worker.terminate();
        channel.port1.close();
        resolve(e.data);
      }
    };
    worker.onerror = (e) => {
      const m: FromWorker = { type: "error", message: e.message || "falha no worker de exportação" };
      cb.onMessage(m);
      worker.terminate();
      resolve(m);
    };
  });

  worker.postMessage({ type: "start", job, port: channel.port2 }, [channel.port2]);
  return { finished, cancel: () => worker.postMessage({ type: "cancel" }) };
}
