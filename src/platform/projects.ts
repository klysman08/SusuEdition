/**
 * Onde os projetos ficam guardados.
 * - Tauri: um JSON por projeto em `<dados do app>/projects/<id>.json` (gravação atômica no Rust).
 * - Navegador (`pnpm dev`): `localStorage`.
 *
 * O conteúdo é opaco para esta camada: só o campo `summary` é lido para montar a lista.
 */
import { isTauri } from "./index";

export interface ProjectEntry {
  id: string;
  /** Campo `summary` do arquivo (ou `null` se ausente/ilegível). */
  summary: unknown;
  modifiedMs: number;
}

export interface ProjectStorage {
  list(): Promise<ProjectEntry[]>;
  /** `null` se o projeto não existe. */
  read(id: string): Promise<string | null>;
  write(id: string, json: string): Promise<void>;
  remove(id: string): Promise<void>;
}

async function tauriStorage(): Promise<ProjectStorage> {
  const { invoke } = await import("@tauri-apps/api/core");
  return {
    list: () => invoke<ProjectEntry[]>("project_list"),
    read: (id) => invoke<string | null>("project_read", { id }),
    write: (id, json) => invoke("project_write", { id, json }),
    remove: (id) => invoke("project_delete", { id }),
  };
}

const PREFIX = "susu.project.";

function webStorage(): ProjectStorage {
  return {
    async list() {
      const out: ProjectEntry[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        try {
          const raw = JSON.parse(localStorage.getItem(key) ?? "null") as { summary?: { updatedAt?: number } } | null;
          out.push({
            id: key.slice(PREFIX.length),
            summary: raw?.summary ?? null,
            modifiedMs: raw?.summary?.updatedAt ?? 0,
          });
        } catch {
          // entrada corrompida: fica fora da lista
        }
      }
      return out;
    },
    async read(id) {
      return localStorage.getItem(PREFIX + id);
    },
    async write(id, json) {
      localStorage.setItem(PREFIX + id, json);
    },
    async remove(id) {
      localStorage.removeItem(PREFIX + id);
    },
  };
}

let storage: Promise<ProjectStorage> | null = null;

export function getProjectStorage(): Promise<ProjectStorage> {
  storage ??= isTauri() ? tauriStorage() : Promise.resolve(webStorage());
  return storage;
}
