import type { AnimatedIcon } from "@/app/navigation";
import { Moon } from "@/components/animate-ui/icons/moon";
import { Sun } from "@/components/animate-ui/icons/sun";
import { SunMoon } from "@/components/animate-ui/icons/sun-moon";
import type { Theme } from "@/lib/theme";

export type ThemeValue = Theme;

export const THEME_OPTIONS: readonly { value: ThemeValue; icon: AnimatedIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: SunMoon },
];
