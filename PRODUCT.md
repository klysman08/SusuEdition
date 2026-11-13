# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, Vite, Tailwind CSS v4, shadcn/ui (`radix-nova` preset `b4zjJi3lY`), Animate UI (`@animate-ui/react` + registry components/icons), Motion, Bun (for `/docs` presentation site), and Tauri v2 (Rust + WebCodecs/WebGL2) for the shipped Windows 11 & Android application.

## Users

Everyday creators, photographers, and short-form video makers on Windows 11 and Android who want to turn photos, video clips, and a music track into beat-synced videos or polished photo collages quickly, privately, and offline without uploading personal media to cloud servers or wrestling with heavy multi-track NLEs.

## Product Purpose

SusuEdition makes beat-synced video editing and multi-photo collage creation effortless and completely local. Success on the `/docs` presentation site means visitors immediately grasp the core mechanism ("Your moments, on the beat — made entirely on your device"), experience the rhythm-driven timeline and collage workflows through real product evidence and interactive visuals, and download the latest Windows (`.exe` / `.msi`) or Android (`.apk`) release from GitHub Releases.

## Positioning

Unlike cloud-based social editors that require accounts, subscriptions, and uploading personal media, or complex desktop NLEs that require manual beat cutting, SusuEdition performs BPM/beat detection (Symphonia in Rust on desktop, TypeScript in browser), dynamic-programming beat cut placement across four musical styles (Dynamic, Steady, Bars, Accents), song energy mapping, and hardware-accelerated WebGL2 + WebCodecs 4K/60fps rendering 100% locally on the user's device.

## Operating Context

- **Application**: Frameless native desktop window on Windows 11 and touch-first safe-area layout on Android 8.0+.
- **Presentation Site (`/docs`)**: English-language showcase and download hub hosted on GitHub Pages, presenting the Video Maker, Photo Collage, local-first architecture, interactive beat-sync demonstration, real screenshots, and direct GitHub Release installers.

## Capabilities and Constraints

- **Video Maker**:
  - Automatic BPM & beat detection with 4 sync styles (`Dynamic`, `Steady`, `Bars`, `Accents`) and adjustable flexibility (`0–100%`).
  - Song map under the timeline displaying energy, bars, and section changes (chorus, drop, break).
  - Full-screen editor with live preview, media + audio timeline, manual cut handle dragging (snaps to beats and playhead), `±0.1s` nudges, split (`S`), and music markers (`M`).
  - Per-clip filter preset + intensity, photo motion (zoom, pan, rise, impact, pulse, spin), and entry transitions.
  - 10 global filter presets (Original, Vivid, Warm, Cool, B&W, Noir, etc.) and 8 manual adjustments (Brightness, Contrast, Saturation, Temperature, Vignette, Black and white, Sepia, Fade).
  - 6 aspect ratios (`9:16`, `16:9`, `4:3`, `1:1`, `4:5`, `3:4`) with Fit / Fill / Stretch framing and blurred or solid backgrounds.
  - Music section picker with waveform, clip audio mixing, ducking, and automatic 3s fade-out.
  - Streaming MP4 export (H.264 + AAC) at 720p, 1080p, or 4K at 30/60 fps with constant memory footprint.
- **Photo Collage**:
  - Smart automatic justified layouts (minimal cropping) plus grids, spotlights, and row/column templates for 2 to 20+ photos.
  - Same 6 aspect ratios, outer margin, inner gap, corner radius, background color, pan/zoom per cell, drag-to-swap, and 10 presets + 8 manual filter adjustments.
  - Off-thread PNG or JPEG export up to 4096 px.
- **App & Architecture**:
  - 100% offline & private: no account, no cloud upload, no telemetry.
  - Media referenced by path via custom `susu://` HTTP Range protocol in Rust — never copied or loaded whole into JS memory.
  - Fast virtualized media library with disk-cached thumbnails (150 items reopen in ~60 ms).
  - Light, dark, and system themes.

## Brand Commitments

- **Identity**: SusuEdition logo (`/logo.svg` — rounded squircle with `#f43f5e` rose to `#a855f7` purple gradient and play-cut glyph), wordmark `SusuEdition` with `Edition` accented in primary rose.
- **Design System**: shadcn/ui preset `b4zjJi3lY` (`radix-nova`, `Geist Variable` font, dark obsidian studio surfaces `oklch(0.13 0.005 285)` paired with clean light mode `oklch(1 0 0)`, rose-coral primary `oklch(0.7 0.17 15)` / `#f43f5e`, violet secondary accent `#a855f7`).
- **Motion & Icons**: Animate UI (`https://github.com/imskyleen/animate-ui`) animated icons and motion-powered UI elements throughout.
- **Language**: Presentation site in English (EN).

## Evidence on Hand

- Real product screenshots in `docs/images/`:
  - `docs/images/og.png` — OpenGraph banner ("Your moments, on the beat").
  - `docs/images/video-maker.png` — Video Maker editor with beat-synced timeline and Rhythm & timing panel (`9/9 on beat · 120 BPM`).
  - `docs/images/video-maker-music.png` — Music panel with `golden-hour.wav` waveform, 120 BPM, 62 beats, and track section handles.
  - `docs/images/video-maker-filters.png` — Video filters panel with 10 presets and 8 adjustment sliders.
  - `docs/images/photo-collage.png` — Photo Collage layout step with 6-photo preview and aspect ratio / layout pickers.
  - `docs/images/photo-collage-filters.png` — Photo Collage filters step.
  - `docs/images/home.png` — Home screen with Video Maker & Photo Collage launch cards and recent projects.
- Architectural Decision Records in `docs/adr/`:
  - `0001-tauri-react-stack.md`, `0002-webcodecs-engine.md`, `0003-release-pipeline.md`.
- GitHub Releases at `https://github.com/klysman08/SusuEdition/releases/latest` (`.exe`, `.msi`, `.apk`).
- No fabricated user testimonials, fake download counts, or commercial pricing claims.

## Product Principles

1. **Rhythm Is Structural**: Every cut, transition, and visual motion responds to musical timing rather than arbitrary decoration.
2. **Local-First Respect**: Zero uploads, zero accounts, zero telemetry—hardware-accelerated performance stays entirely on the user's machine.
3. **Studio Precision Without Timeline Bloat**: Give creators immediate musical and visual control (Dynamic/Steady/Bars/Accents, smart justified collages) without complex multi-track friction.
4. **Tactile Animated Craft**: Every icon, control, and transition feels responsive and alive through purposeful motion (Animate UI + Motion).
