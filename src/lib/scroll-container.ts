import { createContext, useContext, type RefObject } from "react";

/**
 * Elemento que rola o conteúdo da página (o <main> do AppShell).
 * Listas virtualizadas usam-no como `getScrollElement`.
 */
export const ScrollContainerContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useScrollContainer(): RefObject<HTMLElement | null> {
  const ref = useContext(ScrollContainerContext);
  if (!ref) throw new Error("useScrollContainer deve ser usado dentro do AppShell");
  return ref;
}
