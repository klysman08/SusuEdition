import type { ComponentType } from "react";

import { Clapperboard } from "@/components/animate-ui/icons/clapperboard";
import { House } from "@/components/animate-ui/icons/house";
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard";
import { Settings } from "@/components/animate-ui/icons/settings";

/** Ícone animado do Animate UI: anima quando o `AnimateIcon` em volta dele é ativado. */
export type AnimatedIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface NavItem {
  to: string;
  labelKey: "nav.home" | "nav.videoMaker" | "nav.photoCollage" | "nav.settings";
  icon: AnimatedIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: House },
  { to: "/video-maker", labelKey: "nav.videoMaker", icon: Clapperboard },
  { to: "/photo-collage", labelKey: "nav.photoCollage", icon: LayoutDashboard },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];
