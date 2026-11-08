# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.1.0] — 2026-11-08 · M1 Mídia & I/O

### Added
- Biblioteca de mídias no Video Maker: importar fotos e vídeos (seletor nativo, Photo Picker no Android, arrastar arquivos para a janela).
- Grade virtualizada com thumbnails, duração dos vídeos e numeração; reordenar arrastando (mouse, toque com pressão longa, teclado); ordenar por data/nome, embaralhar; seleção e remoção.
- Protocolo `susu://` em Rust com HTTP Range (arquivos nunca carregados inteiros no WebView); `content://` no Android via `tauri-plugin-fs`.
- Fotos processadas em Rust em paralelo: dimensões pelo cabeçalho, EXIF (orientação e data), thumbnail com decodificação JPEG reduzida.
- Vídeos processados em Web Workers (Mediabunny + WebCodecs): duração, rotação, áudio, codec, suporte a decodificação, data de criação e thumbnail.
- Cache em disco de thumbnails e metadados — reabrir 150 mídias leva ~60 ms.

### Performance (Windows, build release, 100 fotos + 50 vídeos)
- Cache frio: 150 itens prontos em 3,7 s (primeiro item visível em 80 ms).
- Cache quente: 56 ms.

## [0.0.1] — 2026-11-08

### Added
- Plano, especificações, roadmap e ADRs do projeto.
- Base Tauri v2 + React 19 + Vite + Tailwind v4 + shadcn/ui.
- Tema claro/escuro/sistema e idiomas pt-BR/en.
- Shell responsivo (sidebar no desktop, bottom-nav no mobile) e páginas iniciais.
- Motor de timeline (durações, excesso de mídia, fade-out de 3s) com testes.
- CI (lint, typecheck, testes, clippy) e release por tag (Windows `.exe`/`.msi` + Android `.apk`).
