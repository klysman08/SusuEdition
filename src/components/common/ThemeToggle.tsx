import { AnimateIcon } from "@animate-ui/react/icons";
import { useTranslation } from "react-i18next";

import { Moon } from "@/components/animate-ui/icons/moon";
import { Sun } from "@/components/animate-ui/icons/sun";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/lib/theme";

import { THEME_OPTIONS } from "./theme-options";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <AnimateIcon animateOnHover asChild>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("theme.toggle")} className="relative">
            <Sun className="size-4.5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute size-4.5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          </Button>
        </DropdownMenuTrigger>
      </AnimateIcon>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <AnimateIcon key={value} animateOnHover asChild>
              <DropdownMenuRadioItem value={value}>
                <Icon className="size-4" />
                {t(`theme.${value}`)}
              </DropdownMenuRadioItem>
            </AnimateIcon>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
