/**
 * Decodificação de mídia.
 *
 * M1: probe de metadados e thumbnails de vídeos em Web Workers (Mediabunny + WebCodecs).
 * M3/M4: decoders de frames para preview/export, com cache LRU e pré-carga limitada.
 */
import type { ProbeRequest, ProbeResult } from "./probe-protocol";
import { WorkerPool } from "./worker-pool";

export * from "./probe-protocol";
export { WorkerPool } from "./worker-pool";

export type ProbePool = WorkerPool<ProbeRequest, ProbeResult>;

/**
 * Pool de probe. Poucos workers: cada um usa um decoder de vídeo (hardware) e
 * abrir muitos em paralelo piora o desempenho, principalmente no Android.
 */
export function createProbePool(size: number): ProbePool {
  return new WorkerPool<ProbeRequest, ProbeResult>(
    () => new Worker(new URL("./media-probe.worker.ts", import.meta.url), { type: "module", name: "susu-probe" }),
    size,
  );
}

export interface DecoderPoolOptions {
  /** Número máximo de decoders de vídeo abertos ao mesmo tempo. */
  maxActiveVideoDecoders: number;
  /** Orçamento de memória para imagens decodificadas (bytes). */
  imageCacheBudgetBytes: number;
}

export const DEFAULT_DECODER_POOL_OPTIONS: DecoderPoolOptions = {
  maxActiveVideoDecoders: 3,
  imageCacheBudgetBytes: 256 * 1024 * 1024,
};
