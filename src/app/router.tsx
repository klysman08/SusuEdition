import { createHashRouter } from "react-router";

import { AppShell } from "./layouts/AppShell";
import { RouteError } from "./layouts/RouteError";

/**
 * Hash router: funciona igual no `tauri://` (Windows), no `http://tauri.localhost`
 * (Android) e no `pnpm dev`, sem depender de fallback de rotas no servidor.
 *
 * Cada feature é carregada sob demanda (code splitting) para manter o
 * primeiro carregamento leve, principalmente no Android.
 */
export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteError />,
    // Exibido enquanto a primeira rota lazy carrega.
    hydrateFallbackElement: <div className="h-full bg-background" />,
    children: [
      { index: true, lazy: () => import("@/features/home").then((m) => ({ Component: m.HomePage })) },
      {
        path: "video-maker",
        lazy: () => import("@/features/video-maker").then((m) => ({ Component: m.VideoMakerPage })),
      },
      {
        path: "photo-collage",
        lazy: () => import("@/features/photo-collage").then((m) => ({ Component: m.PhotoCollagePage })),
      },
      {
        path: "settings",
        lazy: () => import("@/features/settings").then((m) => ({ Component: m.SettingsPage })),
      },
    ],
  },
]);
