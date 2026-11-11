/**
 * Formato do arquivo de projeto do Video Maker (RF-G5).
 *
 * O projeto guarda apenas *onde* cada arquivo está (caminho ou URI) e os ajustes —
 * nada é copiado. Ao reabrir, os arquivos são registrados de novo a partir do
 * caminho; miniaturas e análise da música vêm do cache.
 */
import type { Selection } from "@/engine/audio";
import type { ClipOverrides } from "@/engine/timeline";
import type { AspectRatio, MediaKind } from "@/engine/types";

import { withDefaults, type VideoProjectSettings } from "./project-store";

export const PROJECT_VERSION = 1;

export interface ProjectMediaRef {
  /** Id da mídia quando o projeto foi salvo (hash de caminho + tamanho + data). */
  id: string;
  /** Caminho local ou URI `content://` do arquivo original. */
  uri: string;
  name: string;
  kind: MediaKind;
  size: number;
  modifiedMs?: number;
}

export interface ProjectMusicRef {
  id: string;
  uri: string;
  name: string;
  size: number;
  selection: Selection | null;
  snapToBeats: boolean;
}

/** Dados para listar o projeto sem abrir o arquivo inteiro. */
export interface ProjectSummary {
  kind: "video";
  name: string;
  createdAt: number;
  updatedAt: number;
  mediaCount: number;
  durationSec: number;
  aspect: AspectRatio;
  /** Mídia usada como capa na lista (a primeira do projeto). */
  coverId: string | null;
}

export interface VideoProjectFile {
  version: number;
  summary: ProjectSummary;
  media: ProjectMediaRef[];
  music: ProjectMusicRef | null;
  settings: VideoProjectSettings;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseMedia(v: unknown): ProjectMediaRef | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.uri !== "string") return null;
  if (v.kind !== "image" && v.kind !== "video") return null;
  return {
    id: v.id,
    uri: v.uri,
    name: typeof v.name === "string" ? v.name : v.uri,
    kind: v.kind,
    size: typeof v.size === "number" ? v.size : 0,
    modifiedMs: typeof v.modifiedMs === "number" ? v.modifiedMs : undefined,
  };
}

function parseSelection(v: unknown): Selection | null {
  if (!isRecord(v) || typeof v.inSec !== "number" || typeof v.outSec !== "number") return null;
  return v.outSec > v.inSec && v.inSec >= 0 ? { inSec: v.inSec, outSec: v.outSec } : null;
}

function parseMusic(v: unknown): ProjectMusicRef | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.uri !== "string") return null;
  return {
    id: v.id,
    uri: v.uri,
    name: typeof v.name === "string" ? v.name : v.uri,
    size: typeof v.size === "number" ? v.size : 0,
    selection: parseSelection(v.selection),
    snapToBeats: v.snapToBeats !== false,
  };
}

/** Resumo válido ou `null` (entradas desconhecidas não aparecem na lista). */
export function parseSummary(v: unknown): ProjectSummary | null {
  if (!isRecord(v) || v.kind !== "video") return null;
  const num = (x: unknown, fallback = 0) => (typeof x === "number" && Number.isFinite(x) ? x : fallback);
  return {
    kind: "video",
    name: typeof v.name === "string" ? v.name : "",
    createdAt: num(v.createdAt),
    updatedAt: num(v.updatedAt),
    mediaCount: num(v.mediaCount),
    durationSec: num(v.durationSec),
    aspect: (typeof v.aspect === "string" ? v.aspect : "9:16") as AspectRatio,
    coverId: typeof v.coverId === "string" ? v.coverId : null,
  };
}

/**
 * Lê um arquivo de projeto. Tolerante: campos ausentes recebem o padrão, mídias
 * inválidas são ignoradas. `null` se não for um projeto ou for de uma versão futura.
 */
export function parseProjectFile(json: string): VideoProjectFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw) || typeof raw.version !== "number" || raw.version > PROJECT_VERSION) return null;
  const summary = parseSummary(raw.summary);
  if (!summary || !Array.isArray(raw.media)) return null;
  return {
    version: raw.version,
    summary,
    media: raw.media.map(parseMedia).filter((m): m is ProjectMediaRef => m !== null),
    music: parseMusic(raw.music),
    settings: withDefaults(isRecord(raw.settings) ? (raw.settings as Partial<VideoProjectSettings>) : {}),
  };
}

/**
 * Ajustes por mídia com os ids atualizados. Um arquivo modificado depois de salvo
 * ganha outro id ao ser registrado de novo; os ajustes dele seguem para o id novo.
 */
export function remapOverrides(
  overrides: Readonly<Record<string, ClipOverrides>>,
  idMap: ReadonlyMap<string, string>,
): Record<string, ClipOverrides> {
  const out: Record<string, ClipOverrides> = {};
  for (const [id, value] of Object.entries(overrides)) out[idMap.get(id) ?? id] = value;
  return out;
}

/** Conteúdo comparável de um projeto: igual ⇒ não há nada novo para gravar. */
export function projectFingerprint(file: VideoProjectFile): string {
  const { updatedAt: _updatedAt, durationSec: _durationSec, ...summary } = file.summary;
  return JSON.stringify({ ...file, summary });
}
