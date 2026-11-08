import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { readStoredTheme, THEME_STORAGE_KEY, ThemeContext, type ResolvedTheme, type Theme } from "./theme-context";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribeSystem(cb: () => void) {
  const mql = media();
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

const getSystemTheme = (): ResolvedTheme => (media().matches ? "dark" : "light");

/**
 * Tema claro/escuro/sistema. A classe `.dark` é aplicada no <html>;
 * um script inline em index.html aplica o tema antes do primeiro paint (sem flash).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const system = useSyncExternalStore(subscribeSystem, getSystemTheme, () => "light" as const);
  const resolvedTheme: ResolvedTheme = theme === "system" ? system : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // armazenamento indisponível: o tema vale só para esta sessão
    }
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
