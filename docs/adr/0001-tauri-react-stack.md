# ADR 0001 — Stack: Tauri v2 + React + shadcn/ui

- Status: aceito
- Data: 2026-11-08

## Contexto
Precisamos de um único código para Windows 11 e Android, com UI moderna e instaladores pequenos.

## Decisão
- **Tauri v2** (Rust + WebView do sistema: WebView2 no Windows, Android System WebView).
- **React 19 + TypeScript + Vite** no frontend.
- **Tailwind v4 + shadcn/ui** (componentes copiados para `src/components/ui`, editáveis) e **lucide** para ícones.
- **Zustand** para estado, **i18next** para traduções, **React Router** para navegação.

## Consequências
- Instaladores pequenos (sem Chromium embutido).
- Depende das capacidades do WebView do sistema (ver ADR 0002).
- shadcn exige React — o que já é nossa escolha.
