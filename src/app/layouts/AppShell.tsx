import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { ScrollContainerContext } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "../navigation";

/**
 * Shell responsivo:
 * - ≥ md (768px): sidebar fixa à esquerda.
 * - < md: barra superior + bottom-nav, respeitando a safe-area do Android.
 */
export function AppShell() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);

  return (
    <ScrollContainerContext value={mainRef}>
      <div className="flex h-full min-h-0 bg-background">
        {/* Sidebar — desktop/tablet */}
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <nav aria-label={t("app.name")} className="flex flex-1 flex-col gap-1 px-3 py-2">
            {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("size-4.5", isActive && "text-sidebar-primary")} aria-hidden />
                    {t(labelKey)}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar — mobile */}
          <header className="sticky top-0 z-20 border-b bg-background/80 pt-safe backdrop-blur-md md:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Logo />
              <ThemeToggle />
            </div>
          </header>

          <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 md:px-10 md:py-10 md:pb-10">
              <Outlet />
            </div>
          </main>

          {/* Bottom nav — mobile */}
          <nav
            aria-label={t("app.name")}
            className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 pb-safe backdrop-blur-md md:hidden"
          >
            <ul className="grid grid-cols-4">
              {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                        isActive && "text-primary",
                      )
                    }
                  >
                    <Icon className="size-5" aria-hidden />
                    {t(labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </ScrollContainerContext>
  );
}
