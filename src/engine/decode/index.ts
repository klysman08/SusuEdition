/**
 * Decodificação de mídia (M1/M4).
 *
 * - Vídeos: Mediabunny (demux por HTTP Range via `susu://`) + WebCodecs `VideoDecoder`.
 * - Fotos: `createImageBitmap` já redimensionado para a resolução de saída.
 * - Cache LRU de frames/texturas com orçamento de memória e pré-carga limitada.
 */
export interface FrameRequest {
  mediaId: string;
  /** Tempo no arquivo de origem (s). */
  sourceTimeSec: number;
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
