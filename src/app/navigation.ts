import { Clapperboard, House, LayoutGrid, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  labelKey: "nav.home" | "nav.videoMaker" | "nav.photoCollage" | "nav.settings";
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: House },
  { to: "/video-maker", labelKey: "nav.videoMaker", icon: Clapperboard },
  { to: "/photo-collage", labelKey: "nav.photoCollage", icon: LayoutGrid },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];
