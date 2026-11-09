import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";

import type { AudioAnalysis } from "@/engine/audio";
import type { MediaMeta } from "@/engine/types";

import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, SUPPORTED_EXTENSIONS } from "./formats";
import type { MediaBackend, PickedMedia, ProcessEvent, RegisterOutcome } from "./types";

const susu = (path: string) => convertFileSrc(path, "susu");

export function createTauriBackend(isMobile: boolean): MediaBackend {
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

    register(picked) {
      const uris = picked.flatMap((p) => (p.type === "native" ? [p.uri] : []));
      return invoke<RegisterOutcome[]>("media_register", { uris });
    },

    async unregister(ids) {
      await invoke("media_unregister", { ids });
    },

    processImages(ids, onEvent) {
      if (ids.length === 0) return Promise.resolve();
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
