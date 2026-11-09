/**
 * Destino da exportação.
 * - Tauri: bytes vão para um temporário no Rust (escrita posicional) e depois para
 *   Vídeos/SusuEdition (desktop) ou para onde o usuário escolher (celular: `content://`).
 * - Navegador: pedaços em memória e download no fim.
 */
import { getPlatform, isMobilePlatform, isTauri } from "./index";

/** `video` → Vídeos/SusuEdition · `image` → Imagens/SusuEdition. */
export type ExportKind = "video" | "image";

const FILTERS: Record<string, { name: string; extensions: string[] }> = {
  mp4: { name: "MP4", extensions: ["mp4"] },
  jpg: { name: "JPEG", extensions: ["jpg", "jpeg"] },
  png: { name: "PNG", extensions: ["png"] },
};

const MIME: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", png: "image/png" };
const ext = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? "";

export interface ExportTargetInfo {
  freeBytes: number | null;
  /** Pasta padrão (desktop). `null`: o usuário escolhe ao salvar. */
  defaultDir: string | null;
  /** O usuário precisa escolher o destino (celular). */
  mustPickDestination: boolean;
  canReveal: boolean;
  /** Dá para abrir o arquivo no player do sistema. */
  canOpen: boolean;
}

export interface SavedExport {
  /** Caminho local, URI `content://` ou nome do arquivo baixado. */
  location: string;
}

export interface ExportSink {
  write(position: number, data: Uint8Array): Promise<void>;
  finish(): Promise<{ bytes: number }>;
  /** `destination`: caminho/URI escolhido; `null` = pasta padrão do `kind`. */
  save(fileName: string, destination: string | null, kind?: ExportKind): Promise<SavedExport>;
  discard(): Promise<void>;
}

export interface ExportPlatform {
  info(kind?: ExportKind): Promise<ExportTargetInfo>;
  createSink(): Promise<ExportSink>;
  /** Diálogo "Salvar como". `null` se cancelado. */
  pickDestination(fileName: string): Promise<string | null>;
  open(location: string): Promise<void>;
  reveal(location: string): Promise<void>;
}

async function tauriPlatform(): Promise<ExportPlatform> {
  const { invoke } = await import("@tauri-apps/api/core");
  const mobile = isMobilePlatform(await getPlatform());

  return {
    async info(kind = "video") {
      const r = await invoke<{ freeBytes: number | null; defaultDir: string | null }>("export_info", { kind });
      return { ...r, mustPickDestination: mobile || !r.defaultDir, canReveal: !mobile, canOpen: true };
    },

    async createSink() {
      const id = await invoke<string>("export_begin");
      return {
        async write(position, data) {
          await invoke("export_write", data, { headers: { "x-export-id": id, "x-position": String(position) } });
        },
        async finish() {
          const r = await invoke<{ tempPath: string; bytes: number }>("export_finish", { id });
          return { bytes: r.bytes };
        },
        async save(fileName, destination, kind = "video") {
          const location = await invoke<string>("export_save", { id, fileName, destination, kind });
          return { location };
        },
        async discard() {
          await invoke("export_discard", { id });
        },
      };
    },

    async pickDestination(fileName) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filter = FILTERS[ext(fileName)];
      return save({ defaultPath: fileName, filters: filter ? [filter] : [] });
    },

    async open(location) {
      const { openPath, openUrl } = await import("@tauri-apps/plugin-opener");
      if (location.includes("://")) await openUrl(location);
      else await openPath(location);
    },

    async reveal(location) {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(location);
    },
  };
}

function webPlatform(): ExportPlatform {
  return {
    async info() {
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      const free = est?.quota !== undefined && est.usage !== undefined ? est.quota - est.usage : null;
      return { freeBytes: free, defaultDir: null, mustPickDestination: false, canReveal: false, canOpen: false };
    },
    async createSink() {
      let chunks: { position: number; data: Uint8Array }[] = [];
      let bytes: Uint8Array<ArrayBuffer> | null = null;
      return {
        async write(position, data) {
          chunks.push({ position, data });
        },
        async finish() {
          const size = chunks.reduce((m, c) => Math.max(m, c.position + c.data.length), 0);
          const out = new Uint8Array(size);
          for (const c of chunks) out.set(c.data, c.position);
          chunks = [];
          bytes = out;
          return { bytes: size };
        },
        async save(fileName) {
          if (!bytes) throw new Error("exportação não finalizada");
          const blob = new Blob([bytes], { type: MIME[ext(fileName)] ?? "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return { location: fileName };
        },
        async discard() {
          chunks = [];
          bytes = null;
        },
      };
    },
    async pickDestination(fileName) {
      return fileName;
    },
    async open() {},
    async reveal() {},
  };
}

let platform: Promise<ExportPlatform> | null = null;

export function getExportPlatform(): Promise<ExportPlatform> {
  platform ??= isTauri() ? tauriPlatform() : Promise.resolve(webPlatform());
  return platform;
}
