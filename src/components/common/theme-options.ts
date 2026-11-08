import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import type { Theme } from "@/lib/theme";

export type ThemeValue = Theme;

export const THEME_OPTIONS: readonly { value: ThemeValue; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];
