/**
 * Versões publicadas do app: lê a release mais recente no GitHub e diz se é mais nova
 * que a instalada. Só consulta a API pública (sem conta, sem enviar dados do usuário);
 * baixar e instalar continua sendo uma ação do usuário, pelo navegador do sistema.
 */
import type { Platform } from "./index";

export const APP_REPO = { owner: "klysman08", name: "SusuEdition" } as const;
export const APP_REPO_URL = `https://github.com/${APP_REPO.owner}/${APP_REPO.name}`;
export const APP_RELEASES_URL = `${APP_REPO_URL}/releases`;
/** Quem criou o app. */
export const APP_AUTHOR = { handle: "klysman08", url: "https://github.com/klysman08" } as const;

const LATEST_RELEASE_API = `https://api.github.com/repos/${APP_REPO.owner}/${APP_REPO.name}/releases/latest`;

export interface ReleaseInfo {
  /** Versão sem o "v" (ex.: "0.9.0"). */
  version: string;
  /** Página da release (notas da versão e todos os arquivos). */
  pageUrl: string;
  /** Instalador desta plataforma, quando a release tem um. */
  downloadUrl: string | null;
  /** Data de publicação (ISO 8601). */
  publishedAt: string | null;
}

/** [maior, menor, correção] de "v1.2.3" / "1.2.3-4"; `null` se não for uma versão. */
export function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** `true` quando `candidate` é uma versão mais nova que `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return false;
}

/** Só links do próprio repositório são abertos (a resposta da API é dado externo). */
function ownUrl(v: unknown): string | null {
  return typeof v === "string" && v.startsWith(`${APP_REPO_URL}/`) ? v : null;
}

/** Instalador da plataforma entre os arquivos da release (nomes gerados pelo CI). */
export function pickAsset(names: readonly string[], platform: Platform): string | null {
  const lower = names.map((n) => n.toLowerCase());
  const find = (suffix: string) => names[lower.findIndex((n) => n.endsWith(suffix))] ?? null;
  if (platform === "windows") return find("-setup.exe") ?? find(".exe") ?? find(".msi");
  if (platform === "android") return find(".apk");
  return null;
}

/** Interpreta a resposta de `/releases/latest`; `null` se não for uma release utilizável. */
export function parseRelease(raw: unknown, platform: Platform): ReleaseInfo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.tag_name !== "string" || r.draft === true) return null;
  const parsed = parseVersion(r.tag_name);
  const pageUrl = ownUrl(r.html_url);
  if (!parsed || !pageUrl) return null;

  const assets = (Array.isArray(r.assets) ? r.assets : []).flatMap((a) => {
    if (typeof a !== "object" || a === null) return [];
    const { name, browser_download_url: url } = a as Record<string, unknown>;
    const safe = ownUrl(url);
    return typeof name === "string" && safe ? [{ name, url: safe }] : [];
  });
  const wanted = pickAsset(
    assets.map((a) => a.name),
    platform,
  );

  return {
    version: parsed.join("."),
    pageUrl,
    downloadUrl: assets.find((a) => a.name === wanted)?.url ?? null,
    publishedAt: typeof r.published_at === "string" ? r.published_at : null,
  };
}

/** Release estável mais recente (pré-releases e rascunhos ficam de fora). */
export async function fetchLatestRelease(platform: Platform, signal?: AbortSignal): Promise<ReleaseInfo> {
  const res = await fetch(LATEST_RELEASE_API, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const release = parseRelease(await res.json(), platform);
  if (!release) throw new Error("release inválida");
  return release;
}
