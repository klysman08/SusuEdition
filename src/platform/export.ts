/**
 * Destino da exportação.
 * - Tauri: bytes vão para um temporário no Rust (escrita posicional) e depois para
 *   Vídeos/SusuEdition (desktop) ou para onde o usuário escolher (celular: `content://`).
 * - Navegador: pedaços em memória e download no fim.
 */
import { getPlatform, isMobilePlatform, isTauri } from "./index";

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
  /** `destination`: caminho/URI escolhido; `null` = pasta padrão. */
  save(fileName: string, destination: string | null): Promise<SavedExport>;
  discard(): Promise<void>;
}

export interface ExportPlatform {
  info(): Promise<ExportTargetInfo>;
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
    async info() {
      const r = await invoke<{ freeBytes: number | null; defaultDir: string | null }>("export_info");
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
        async save(fileName, destination) {
          const location = await invoke<string>("export_save", { id, fileName, destination });
          return { location };
        },
        async discard() {
          await invoke("export_discard", { id });
        },
      };
    },

    async pickDestination(fileName) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      return save({ defaultPath: fileName, filters: [{ name: "MP4", extensions: ["mp4"] }] });
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
      let blob: Blob | null = null;
      return {
        async write(position, data) {
          chunks.push({ position, data });
        },
        async finish() {
          const size = chunks.reduce((m, c) => Math.max(m, c.position + c.data.length), 0);
          const out = new Uint8Array(size);
          for (const c of chunks) out.set(c.data, c.position);
          chunks = [];
          blob = new Blob([out], { type: "video/mp4" });
          return { bytes: size };
        },
        async save(fileName) {
          if (!blob) throw new Error("exportação não finalizada");
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
          blob = null;
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
