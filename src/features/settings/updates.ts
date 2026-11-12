/**
 * Aviso de versão nova: o app confere sozinho as releases do GitHub ao abrir e a cada
 * poucas horas (com cache, para não consultar a API a cada abertura) e guarda o resultado
 * aqui. Ajustes mostra o estado; a navegação ganha um ponto quando há versão nova.
 */
import { toast } from "sonner";
import { createStore } from "zustand/vanilla";

import i18n from "@/i18n";
import { getAppVersion, getPlatform, openExternal } from "@/platform";
import { fetchLatestRelease, isNewerVersion, type ReleaseInfo } from "@/platform/updates";

export type UpdateStatus = "idle" | "checking" | "current" | "available" | "error";

export interface UpdateState {
  status: UpdateStatus;
  /** Release mais recente conhecida (mesmo quando é a versão instalada). */
  latest: ReleaseInfo | null;
  /** Quando a última consulta deu certo (ms). */
  checkedAt: number | null;
}

export const updateStore = createStore<UpdateState>()(() => ({ status: "idle", latest: null, checkedAt: null }));

/** Intervalo entre consultas automáticas. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = "susu.update";
const NOTIFIED_KEY = "susu.update.notified";

interface Cache {
  checkedAt: number;
  latest: ReleaseInfo;
}

function readCache(): Cache | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const { checkedAt, latest } = raw as Partial<Cache>;
    if (typeof checkedAt !== "number" || !latest || typeof latest.version !== "string") return null;
    if (typeof latest.pageUrl !== "string") return null;
    return { checkedAt, latest };
  } catch {
    return null;
  }
}

function writeCache(cache: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // sem armazenamento local: só consulta de novo na próxima abertura
  }
}

/** Abre o instalador da versão nova (ou a página da release) no navegador do sistema. */
export function downloadUpdate(release: ReleaseInfo): void {
  void openExternal(release.downloadUrl ?? release.pageUrl);
}

/** Avisa uma vez por versão, para não repetir o aviso a cada abertura. */
function notifyOnce(release: ReleaseInfo): void {
  try {
    if (localStorage.getItem(NOTIFIED_KEY) === release.version) return;
    localStorage.setItem(NOTIFIED_KEY, release.version);
  } catch {
    return;
  }
  toast(i18n.t("settings.updates.available", { version: release.version }), {
    duration: 10_000,
    action: { label: i18n.t("settings.updates.download"), onClick: () => downloadUpdate(release) },
  });
}

let running: Promise<void> | null = null;

/**
 * Confere a release mais recente. Sem `force`, um resultado com menos de 6 h é reaproveitado
 * (nenhuma rede). `notify`: mostra um aviso se a versão nova ainda não foi anunciada.
 */
export function checkForUpdates(opts: { force?: boolean; notify?: boolean } = {}): Promise<void> {
  running ??= (async () => {
    const current = await getAppVersion();
    const apply = (cache: Cache) => {
      const available = isNewerVersion(cache.latest.version, current);
      updateStore.setState({
        status: available ? "available" : "current",
        latest: cache.latest,
        checkedAt: cache.checkedAt,
      });
      if (available && opts.notify) notifyOnce(cache.latest);
    };

    const cached = readCache();
    if (cached && !opts.force && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) {
      apply(cached);
      return;
    }
    // Enquanto consulta, o que já se sabia continua valendo (o ponto na navegação não pisca).
    if (cached) apply(cached);
    const before = updateStore.getState();
    updateStore.setState({ status: "checking" });
    try {
      const latest = await fetchLatestRelease(await getPlatform());
      const cache = { checkedAt: Date.now(), latest };
      writeCache(cache);
      apply(cache);
    } catch (err) {
      console.warn("não foi possível conferir atualizações", err);
      // Falha numa consulta automática não apaga o que já se sabia.
      updateStore.setState(opts.force || before.status === "idle" ? { status: "error" } : before);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

let installed = false;

/** Liga a conferência automática (uma vez por sessão do app). */
export function installUpdateCheck(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const auto = () => void checkForUpdates({ notify: true });
  auto();
  setInterval(auto, CHECK_INTERVAL_MS);
  // App reaberto depois de horas em segundo plano (comum no celular).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") auto();
  });
}
