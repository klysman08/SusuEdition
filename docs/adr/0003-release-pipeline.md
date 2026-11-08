# ADR 0003 — Pipeline de releases

- Status: aceito
- Data: 2026-11-08

## Decisão
- Repositório privado `klysman08/SusuEdition` no GitHub.
- `ci.yml` em todo push/PR: lint, typecheck, testes (Vitest), `cargo fmt`, `clippy`, `cargo test`.
- `release.yml` ao enviar tag `v*`:
  - Windows: `tauri-apps/tauri-action` gera `.exe` (NSIS) e `.msi` e cria um GitHub Release (draft).
  - Android: build `.apk` com assinatura por secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); sem secrets gera APK assinado com chave de debug.
- Versão única sincronizada em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` por `scripts/bump-version.mjs`.
- Tags com sufixo (`v0.1.0-beta.1`) viram pre-release.

## Consequências
- O auto-updater do Tauri não consegue baixar de releases privados; fica para o futuro.
