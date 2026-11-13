import { AnimateIcon } from "@animate-ui/react/icons";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useMatches } from "react-router";
import { useStore } from "zustand";

import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { WindowControls } from "@/components/common/WindowControls";
import { updateStore } from "@/features/settings/updates";
import { ScrollContainerContext } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { dragRegion, isFramelessWindow } from "@/platform/window";

import { NAV_ITEMS } from "../navigation";

/**
 * Shell responsivo:
 * - ≥ md (768px): sidebar fixa à esquerda.
 * - < md: barra superior + bottom-nav, respeitando a safe-area do Android.
 *
 * No Windows a janela não tem barra de título do sistema: o topo da sidebar e uma faixa
 * transparente acima do conteúdo arrastam a janela, e os controles (minimizar, maximizar,
 * fechar) ficam no canto superior direito — sem uma barra "de verdade" no layout.
 *
 * Rotas com `handle.immersive` (editor de vídeo) ocupam a tela toda: a sidebar vira
 * um trilho de ícones, as barras do celular somem e a página cuida da própria rolagem
 * (e dos controles da janela, na barra do editor).
 */
export function AppShell() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const frameless = isFramelessWindow();
  const drag = dragRegion();
  const immersive = useMatches().some((m) => (m.handle as { immersive?: boolean } | undefined)?.immersive);
  /** Versão nova publicada: um ponto em "Ajustes", onde fica o download. */
  const hasUpdate = useStore(updateStore, (s) => s.status === "available");
  const badge = (to: string) =>
    hasUpdate && to === "/settings" ? (
      <span
        role="img"
        aria-label={t("settings.updates.badge")}
        title={t("settings.updates.badge")}
        className="absolute top-0 right-0 size-2 translate-x-1/2 -translate-y-1/3 rounded-full bg-primary ring-2 ring-background"
      />
    ) : null;

  return (
    <ScrollContainerContext value={mainRef}>
      <div className="flex h-full min-h-0 bg-background">
        {/* Sidebar — desktop/tablet */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex",
            immersive ? "w-14" : "w-60",
          )}
        >
          <div {...drag} className={cn("flex items-center", immersive ? "h-12 justify-center" : "h-16 px-5")}>
            <Logo compact={immersive} />
          </div>
          <nav
            aria-label={t("app.name")}
            className={cn("flex flex-1 flex-col gap-0.5 py-2", immersive ? "px-2" : "px-3")}
          >
            {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
              <AnimateIcon key={to} animateOnHover asChild>
                <div>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    title={immersive ? t(labelKey) : undefined}
                    aria-label={immersive ? t(labelKey) : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group/nav relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground transition-colors",
                        immersive ? "justify-center" : "px-3",
                        "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                        "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Marca discreta do item ativo, rente à borda da sidebar. */}
                        {isActive && !immersive && (
                          <span
                            aria-hidden
                            className="absolute top-2.5 bottom-2.5 -left-3 w-0.5 rounded-r-full bg-sidebar-primary"
                          />
                        )}
                        <span className="relative flex">
                          <Icon className={cn("size-4.5", isActive && "text-sidebar-primary")} aria-hidden />
                          {badge(to)}
                        </span>
                        {!immersive && t(labelKey)}
                      </>
                    )}
                  </NavLink>
                </div>
              </AnimateIcon>
            ))}
          </nav>
          <div className={cn("flex items-center py-3", immersive ? "justify-center" : "justify-between px-5")}>
            {!immersive && <span className="text-xs text-muted-foreground/80 tabular-nums">v{__APP_VERSION__}</span>}
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topo do conteúdo no desktop: área de arrastar + controles da janela, sem barra visível. */}
          {frameless && !immersive && (
            <div {...drag} className="hidden h-10 shrink-0 justify-end md:flex">
              <WindowControls />
            </div>
          )}

          {/* Top bar — mobile (e janela estreita no Windows) */}
          <header
            className={cn(
              "sticky top-0 z-20 border-b bg-background/80 pt-safe backdrop-blur-md md:hidden",
              immersive && "hidden",
            )}
          >
            <div {...drag} className={cn("flex h-12 items-center justify-between", frameless ? "pl-4" : "px-4")}>
              <Logo />
              <div className="flex h-full items-center gap-1">
                <ThemeToggle />
                <WindowControls />
              </div>
            </div>
          </header>

          <main
            ref={mainRef}
            className={cn("relative min-h-0 flex-1", immersive ? "overflow-hidden" : "overflow-y-auto")}
          >
            {immersive ? (
              <Outlet />
            ) : (
              <div
                className={cn(
                  "mx-auto w-full max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-6 md:px-10 md:pb-10",
                  frameless ? "md:pt-4" : "md:pt-10",
                )}
              >
                <Outlet />
              </div>
            )}
          </main>

          {/* Bottom nav — mobile */}
          <nav
            aria-label={t("app.name")}
            className={cn(
              "fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 pb-safe backdrop-blur-md md:hidden",
              immersive && "hidden",
            )}
          >
            <ul className="grid grid-cols-4">
              {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
                <AnimateIcon key={to} animateOnHover animateOnTap asChild>
                  <li>
                    <NavLink
                      to={to}
                      end={to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors",
                          isActive && "text-primary",
                        )
                      }
                    >
                      <span className="relative flex">
                        <Icon className="size-5" aria-hidden />
                        {badge(to)}
                      </span>
                      {t(labelKey)}
                    </NavLink>
                  </li>
                </AnimateIcon>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </ScrollContainerContext>
  );
}
