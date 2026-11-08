/**
 * Ponte tipada entre o frontend e o Tauri.
 *
 * Regras:
 * - Features nunca chamam `@tauri-apps/*` diretamente: usam este módulo.
 * - Toda função tem fallback seguro quando o app roda num navegador comum
 *   (ex.: `pnpm dev` para iterar na UI), para que a UI continue funcionando.
 */
export type Platform = "windows" | "android" | "macos" | "linux" | "ios" | "web";

/** `true` quando o frontend está rodando dentro do WebView do Tauri. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getPlatform(): Promise<Platform> {
  if (!isTauri()) return "web";
  const { platform } = await import("@tauri-apps/plugin-os");
  const p = platform();
  switch (p) {
    case "windows":
    case "android":
    case "macos":
    case "linux":
    case "ios":
      return p;
    default:
      return "web";
  }
}

export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return __APP_VERSION__;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export function isMobilePlatform(platform: Platform): boolean {
  return platform === "android" || platform === "ios";
}
