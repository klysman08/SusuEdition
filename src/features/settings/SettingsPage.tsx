import { CircleAlert, CircleCheck, Download, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { THEME_OPTIONS, type ThemeValue } from "@/components/common/theme-options";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { useTheme } from "@/lib/theme";
import { getAppVersion, getPlatform, openExternal, type Platform } from "@/platform";
import { APP_AUTHOR, APP_REPO_URL } from "@/platform/updates";

import { checkForUpdates, downloadUpdate, updateStore } from "./updates";

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Link que abre no navegador do sistema (no app nativo, `<a target>` não sai do WebView). */
function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        e.preventDefault();
        void openExternal(href);
      }}
      className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </a>
  );
}

/** Estado das atualizações: versão nova para baixar, em dia, conferindo ou sem conexão. */
function UpdateStatus({ version }: { version: string }) {
  const { t, i18n } = useTranslation();
  const status = useStore(updateStore, (s) => s.status);
  const latest = useStore(updateStore, (s) => s.latest);
  const checkedAt = useStore(updateStore, (s) => s.checkedAt);
  const checking = status === "checking";
  const date = (v: string | number, withTime: boolean) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}) }).format(
      new Date(v),
    );

  return (
    <div className="space-y-3">
      {status === "available" && latest ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-primary max-sm:hidden" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("settings.updates.available", { version: latest.version })}</p>
            <p className="text-xs text-muted-foreground">
              {t("settings.updates.installed", { version })}
              {latest.publishedAt && ` · ${t("settings.updates.published", { date: date(latest.publishedAt, false) })}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => downloadUpdate(latest)}>
              <Download />
              {t("settings.updates.download")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void openExternal(latest.pageUrl)}>
              {t("settings.updates.releaseNotes")}
              <ExternalLink />
            </Button>
          </div>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm">
          {checking || status === "idle" ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : status === "error" ? (
            <CircleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          ) : (
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          )}
          {checking || status === "idle"
            ? t("settings.updates.checking")
            : status === "error"
              ? t("settings.updates.error")
              : t("settings.updates.upToDate")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button size="sm" variant="outline" disabled={checking} onClick={() => void checkForUpdates({ force: true })}>
          <RefreshCw className={checking ? "animate-spin" : undefined} />
          {t("settings.updates.check")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("settings.updates.auto")}
          {checkedAt !== null && ` ${t("settings.updates.lastChecked", { when: date(checkedAt, true) })}`}
        </p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [about, setAbout] = useState<{ version: string; platform: Platform } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([getAppVersion(), getPlatform()]).then(([version, platform]) => {
      if (alive) setAbout({ version, platform });
    });
    // Abrir Ajustes confere as versões (usa o resultado recente, se houver).
    void checkForUpdates();
    return () => {
      alive = false;
    };
  }, []);

  const language = SUPPORTED_LANGUAGES.find((l) => i18n.resolvedLanguage === l.code)?.code ?? "pt-BR";
  const version = about?.version ?? __APP_VERSION__;

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardContent className="space-y-6">
            <SettingRow title={t("settings.appearance.title")} description={t("settings.appearance.description")}>
              <ToggleGroup
                type="single"
                variant="outline"
                value={theme}
                onValueChange={(v) => v && setTheme(v as ThemeValue)}
                aria-label={t("settings.appearance.title")}
              >
                {THEME_OPTIONS.map(({ value, icon: Icon }) => (
                  <ToggleGroupItem key={value} value={value} className="gap-1.5 px-3">
                    <Icon className="size-4" aria-hidden />
                    {t(`theme.${value}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </SettingRow>

            <SettingRow title={t("settings.language.title")} description={t("settings.language.description")}>
              <Select value={language} onValueChange={(v) => void i18n.changeLanguage(v)}>
                <SelectTrigger className="w-52" aria-label={t("settings.language.title")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.updates.title")}</CardTitle>
            <CardDescription>
              {t("settings.about.version", { version })} ·{" "}
              {t("settings.about.platform", { platform: about?.platform ?? "…" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdateStatus version={version} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.about.title")}</CardTitle>
            <CardDescription>{t("app.tagline")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              {t("settings.about.createdBy")}{" "}
              <ExternalAnchor href={APP_AUTHOR.url}>@{APP_AUTHOR.handle}</ExternalAnchor>
            </p>
            <p>
              <ExternalAnchor href={APP_REPO_URL}>
                {t("settings.about.source")}
                <ExternalLink className="size-3.5" aria-hidden />
              </ExternalAnchor>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
