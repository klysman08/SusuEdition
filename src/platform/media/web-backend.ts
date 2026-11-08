import { computePeaks, type AudioAnalysis } from "@/engine/audio";
import { createProbePool, type ProbePool } from "@/engine/decode";
import type { MediaKind } from "@/engine/types";

import { ACCEPT_ATTRIBUTE, AUDIO_ACCEPT_ATTRIBUTE } from "./formats";
import type { MediaBackend, PickedMedia, RegisterOutcome } from "./types";

/** Hash FNV-1a de 64 bits em hex — id estável para arquivos do navegador. */
function fnv1a(input: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

function kindOf(file: File): MediaKind | "audio" | "unknown" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "unknown";
}

function pickFiles(accept = ACCEPT_ATTRIBUTE, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = accept;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/**
 * Backend para o navegador comum (`pnpm dev`): usa File/Blob em memória, sem cache
 * persistente. Serve para iterar na UI; o desempenho de referência é o do app nativo.
 */
export function createWebBackend(): MediaBackend {
  const files = new Map<string, File>();
  const thumbs = new Map<string, string>();
  let imagePool: ProbePool | null = null;
  const pool = () => (imagePool ??= createProbePool(Math.max(2, Math.min(4, navigator.hardwareConcurrency >> 1))));

  return {
    name: "web",
    videoProbeConcurrency: 2,

    async pick() {
      return (await pickFiles()).map((file): PickedMedia => ({ type: "web", file }));
    },

    async pickAudio() {
      return (await pickFiles(AUDIO_ACCEPT_ATTRIBUTE, false)).map((file): PickedMedia => ({ type: "web", file }));
    },

    /** Navegador: só a waveform (a detecção de batidas roda no Rust, no app nativo). */
    async analyzeAudio(id): Promise<AudioAnalysis> {
      const file = files.get(id);
      if (!file) throw new Error(`arquivo não registrado: ${id}`);
      const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: 11025 });
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const mono = new Float32Array(buffer.length);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const ch = buffer.getChannelData(c);
        for (let i = 0; i < ch.length; i++) mono[i]! += ch[i]! / buffer.numberOfChannels;
      }
      return {
        durationSec: buffer.duration,
        sourceRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        peaks: computePeaks(mono, 4000),
        bpm: null,
        beats: [],
      };
    },

    async register(picked) {
      return picked.flatMap((p): RegisterOutcome[] => {
        if (p.type !== "web") return [];
        const f = p.file;
        const id = fnv1a(`${f.name}|${f.size}|${f.lastModified}`);
        files.set(id, f);
        return [
          {
            status: "ok",
            id,
            uri: f.name,
            name: f.name,
            kind: kindOf(f),
            mime: f.type,
            size: f.size,
            modifiedMs: f.lastModified,
          },
        ];
      });
    },

    async unregister(ids) {
      for (const id of ids) {
        files.delete(id);
        const url = thumbs.get(id);
        if (url) URL.revokeObjectURL(url);
        thumbs.delete(id);
      }
    },

    async processImages(ids, onEvent) {
      await Promise.all(
        ids.map(async (id) => {
          const file = files.get(id);
          if (!file) return onEvent({ type: "failed", id, error: "arquivo não registrado" });
          try {
            const res = await pool().run({ id, kind: "image", source: { type: "blob", blob: file } });
            if (!res.ok) return onEvent({ type: "failed", id, error: res.error });
            if (res.thumb) thumbs.set(id, URL.createObjectURL(res.thumb));
            onEvent({ type: "done", id, meta: res.meta });
          } catch (err) {
            onEvent({ type: "failed", id, error: String(err) });
          }
        }),
      );
    },

    probeSource(id) {
      const file = files.get(id);
      if (!file) throw new Error(`arquivo não registrado: ${id}`);
      return { type: "blob", blob: file };
    },

    async cacheGet(ids) {
      return ids.map(() => null);
    },

    async cachePut(id, _meta, thumb) {
      const url = URL.createObjectURL(thumb);
      thumbs.set(id, url);
      return url;
    },

    thumbUrl: (id) => thumbs.get(id) ?? "",
    mediaUrl: (id) => {
      const f = files.get(id);
      return f ? URL.createObjectURL(f) : "";
    },

    async onFileDrop(cb, onHover) {
      const over = (e: DragEvent) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        onHover?.(true);
      };
      const leave = (e: DragEvent) => {
        if (e.relatedTarget === null) onHover?.(false);
      };
      const drop = (e: DragEvent) => {
        e.preventDefault();
        onHover?.(false);
        const dropped = Array.from(e.dataTransfer?.files ?? []);
        if (dropped.length > 0) cb(dropped.map((file) => ({ type: "web", file })));
      };
      window.addEventListener("dragover", over);
      window.addEventListener("dragleave", leave);
      window.addEventListener("drop", drop);
      return () => {
        window.removeEventListener("dragover", over);
        window.removeEventListener("dragleave", leave);
        window.removeEventListener("drop", drop);
      };
    },
  };
}
