import type { MediaKind, MediaMeta } from "@/engine/types";
import type { AudioAnalysis } from "@/engine/audio";
import type { ProbeSource } from "@/engine/decode";

/** Arquivo escolhido pelo usuário, antes do registro. */
export type PickedMedia = { type: "native"; uri: string } | { type: "web"; file: File };

export interface RegisteredMedia {
  /** Estável entre sessões (hash de uri+tamanho+data): também é a chave do cache. */
  id: string;
  uri: string;
  name: string;
  /** `unknown`: formato não reconhecido. `audio`: só aceito como música. */
  kind: MediaKind | "audio" | "unknown";
  mime: string;
  size: number;
  modifiedMs?: number;
}

export type RegisterOutcome = ({ status: "ok" } & RegisteredMedia) | { status: "error"; uri: string; error: string };

export type ProcessEvent =
  { type: "done"; id: string; meta: MediaMeta } | { type: "failed"; id: string; error: string };

/**
 * Operações de mídia dependentes de plataforma. Duas implementações:
 * - `tauri`: Rust (fotos multi-core, cache em disco, protocolo `susu://`)
 * - `web`: navegador comum, para iterar na UI com `pnpm dev`
 */
export interface MediaBackend {
  readonly name: "tauri" | "web";
  /** Abre o seletor nativo. Retorna lista vazia se o usuário cancelar. */
  pick(): Promise<PickedMedia[]>;
  /** Seletor de música (um arquivo). */
  pickAudio(): Promise<PickedMedia[]>;
  /** Waveform, BPM e batidas da música (Rust; no navegador só a waveform). */
  analyzeAudio(id: string): Promise<AudioAnalysis>;
  register(picked: PickedMedia[]): Promise<RegisterOutcome[]>;
  unregister(ids: string[]): Promise<void>;
  /** Processa fotos (metadados + thumbnail); eventos chegam conforme ficam prontos. */
  processImages(ids: string[], onEvent: (e: ProcessEvent) => void): Promise<void>;
  /** Fonte para o worker de probe ler o arquivo original. */
  probeSource(id: string): ProbeSource;
  cacheGet(ids: string[]): Promise<(MediaMeta | null)[]>;
  /** Grava o thumbnail gerado no WebView e devolve a URL para exibi-lo. */
  cachePut(id: string, meta: MediaMeta, thumb: Blob): Promise<string>;
  thumbUrl(id: string): string;
  mediaUrl(id: string): string;
  /** Arquivos soltos sobre a janela (desktop). Retorna função para cancelar. */
  onFileDrop(cb: (picked: PickedMedia[]) => void, onHover?: (hovering: boolean) => void): Promise<() => void>;
  /** Workers de vídeo recomendados para o dispositivo. */
  readonly videoProbeConcurrency: number;
}
