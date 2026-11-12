import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/i18n";
import "@/styles/globals.css";
import { App } from "@/app/App";
import { installUpdateCheck } from "@/features/settings/updates";

// Confere sozinho se há versão nova publicada (resultado em Ajustes e na navegação).
installUpdateCheck();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
