import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { THEME_OPTIONS, type ThemeValue } from "@/components/common/theme-options";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { useTheme } from "@/lib/theme";
import { getAppVersion, getPlatform, type Platform } from "@/platform";

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

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [about, setAbout] = useState<{ version: string; platform: Platform } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([getAppVersion(), getPlatform()]).then(([version, platform]) => {
      if (alive) setAbout({ version, platform });
    });
    return () => {
      alive = false;
    };
  }, []);

  const language = SUPPORTED_LANGUAGES.find((l) => i18n.resolvedLanguage === l.code)?.code ?? "pt-BR";

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
            <CardTitle>{t("settings.about.title")}</CardTitle>
            <CardDescription>{t("app.tagline")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>{t("settings.about.version", { version: about?.version ?? __APP_VERSION__ })}</p>
            <p>{t("settings.about.platform", { platform: about?.platform ?? "…" })}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
