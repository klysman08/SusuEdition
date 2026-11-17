import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";

import type { AudioAnalysis } from "@/engine/audio";
import { convertibleImage, convertImageToJpeg } from "@/engine/decode/convert-image";
import type { MediaMeta } from "@/engine/types";

import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, SUPPORTED_EXTENSIONS } from "./formats";
import type { MediaBackend, PickedMedia, ProcessEvent, RegisterOutcome } from "./types";

/** Tamanho do lote ao reabrir um projeto (mantém cada chamada IPC curta). */
const REOPEN_BATCH = 200;

const susu = (path: string) => convertFileSrc(path, "susu");

export function createTauriBackend(isMobile: boolean): MediaBackend {
  /** MIME efetivo de cada mídia registrada (`image/jpeg` quando uma foto HEIC já foi convertida). */
  const mimes = new Map<string, string>();
  const remember = (outcomes: RegisterOutcome[]) => {
    for (const o of outcomes) if (o.status === "ok") mimes.set(o.id, o.mime);
    return outcomes;
  };

  const storeConverted = async (id: string, data: Blob, ext: "jpg" | "wav") => {
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mime = await invoke<string>("media_put_converted", bytes, { headers: { "x-media-id": id, "x-ext": ext } });
    mimes.set(id, mime);
  };

  /** Fotos HEIC/AVIF: converte no WebView antes do processamento nativo. */
  const convertImages = async (ids: string[], onEvent: (e: ProcessEvent) => void): Promise<string[]> => {
    const ready: string[] = [];
    await Promise.all(
      ids.map(async (id) => {
        // Só pelo MIME: o Rust já devolve `image/jpeg` quando a cópia convertida existe
        // (a extensão `.heic` do nome continua igual).
        const format = convertibleImage(mimes.get(id));
        if (!format) return ready.push(id);
        try {
          const original = await (await fetch(susu(`media/${id}`))).blob();
          await storeConverted(id, await convertImageToJpeg(original, format), "jpg");
          ready.push(id);
        } catch (err) {
          onEvent({ type: "failed", id, error: err instanceof Error ? err.message : String(err) });
        }
      }),
    );
    return ready;
  };

  return {
    name: "tauri",
    videoProbeConcurrency: isMobile ? 2 : 3,

    async pick(opts) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const images = opts?.imagesOnly ?? false;
      const result = await open({
        multiple: true,
        pickerMode: images ? "image" : "media",
        filters: [
          images
            ? { name: "Fotos", extensions: [...IMAGE_EXTENSIONS] }
            : { name: "Fotos e vídeos", extensions: [...SUPPORTED_EXTENSIONS] },
        ],
      });
      const uris = result === null ? [] : Array.isArray(result) ? result : [result];
      return uris.map((uri): PickedMedia => ({ type: "native", uri }));
    },

    async pickAudio() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        multiple: false,
        pickerMode: "document",
        filters: [{ name: "Música", extensions: [...AUDIO_EXTENSIONS] }],
      });
      return typeof result === "string" ? [{ type: "native", uri: result }] : [];
    },

    analyzeAudio(id) {
      return invoke<AudioAnalysis>("audio_analyze", { id });
    },

    async register(picked) {
      const uris = picked.flatMap((p) => (p.type === "native" ? [p.uri] : []));
      return remember(await invoke<RegisterOutcome[]>("media_register", { uris }));
    },

    async reopen(refs) {
      const out: RegisterOutcome[] = [];
      for (let i = 0; i < refs.length; i += REOPEN_BATCH) {
        const uris = refs.slice(i, i + REOPEN_BATCH).map((r) => r.uri);
        out.push(...remember(await invoke<RegisterOutcome[]>("media_register", { uris })));
      }
      return out;
    },

    async unregister(ids) {
      for (const id of ids) mimes.delete(id);
      await invoke("media_unregister", { ids });
    },

    storeConverted,

    async cacheAudioAnalysis(id, analysis) {
      await invoke("audio_cache_put", { id, analysis });
    },

    async processImages(all, onEvent) {
      const ids = await convertImages(all, onEvent);
      if (ids.length === 0) return;
      return new Promise<void>((resolve) => {
        let remaining = ids.length;
        const channel = new Channel<ProcessEvent>();
        channel.onmessage = (e) => {
          onEvent(e);
          if (--remaining === 0) resolve();
        };
        invoke("media_process_images", { ids, onEvent: channel }).catch((err: unknown) => {
          for (const id of ids) onEvent({ type: "failed", id, error: String(err) });
          resolve();
        });
      });
    },

    probeSource(id) {
      return { type: "url", url: susu(`media/${id}`) };
    },

    cacheGet(ids) {
      return invoke<(MediaMeta | null)[]>("media_cache_get", { ids });
    },

    async cachePut(id, meta, thumb) {
      const bytes = new Uint8Array(await thumb.arrayBuffer());
      await invoke("media_cache_put", bytes, {
        headers: { "x-media-id": id, "x-media-meta": encodeURIComponent(JSON.stringify(meta)) },
      });
      return susu(`thumb/${id}`);
    },

    thumbUrl: (id) => susu(`thumb/${id}`),
    mediaUrl: (id) => susu(`media/${id}`),

    async onFileDrop(cb, onHover) {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      return getCurrentWebview().onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "enter" || p.type === "over") onHover?.(true);
        else if (p.type === "leave") onHover?.(false);
        else if (p.type === "drop") {
          onHover?.(false);
          if (p.paths.length > 0) cb(p.paths.map((uri) => ({ type: "native", uri })));
        }
      });
    },
  };
}
