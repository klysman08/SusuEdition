import { AnimateIcon } from "@animate-ui/react/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Minus } from "@/components/animate-ui/icons/minus";
import { WindowMaximize } from "@/components/animate-ui/icons/window-maximize";
import { X } from "@/components/animate-ui/icons/x";
import { cn } from "@/lib/utils";
import { isFramelessWindow, useWindowMaximized, windowControls } from "@/platform/window";

function ControlButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <AnimateIcon animateOnHover asChild>
      <button
        type="button"
        aria-label={label}
        title={label}
        tabIndex={-1}
        onClick={onClick}
        className={cn(
          "flex h-full w-11 items-center justify-center text-muted-foreground transition-colors duration-150 outline-none",
          "hover:text-foreground focus-visible:bg-foreground/10 [&_svg]:size-4",
          danger
            ? "hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/85"
            : "hover:bg-foreground/8 active:bg-foreground/12",
        )}
      >
        {children}
      </button>
    </AnimateIcon>
  );
}

/**
 * Minimizar, maximizar/restaurar e fechar — só existe quando a janela não tem a barra
 * do sistema (Windows). Ocupa a altura toda da barra em que estiver, encostado à direita.
 */
export function WindowControls({ className }: { className?: string }) {
  const { t } = useTranslation();
  const frameless = isFramelessWindow();
  const maximized = useWindowMaximized(frameless);
  if (!frameless) return null;

  return (
    <div className={cn("flex shrink-0 items-stretch self-stretch", className)}>
      <ControlButton label={t("window.minimize")} onClick={() => void windowControls.minimize()}>
        <Minus strokeWidth={1.5} aria-hidden />
      </ControlButton>
      <ControlButton
        label={maximized ? t("window.restore") : t("window.maximize")}
        onClick={() => void windowControls.toggleMaximize()}
      >
        <WindowMaximize restore={maximized} aria-hidden />
      </ControlButton>
      <ControlButton label={t("window.close")} onClick={() => void windowControls.close()} danger>
        <X strokeWidth={1.5} aria-hidden />
      </ControlButton>
    </div>
  );
}
