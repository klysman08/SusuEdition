---
name: SusuEdition
description: Beat-synced videos and photo collages, made entirely on your device.
colors:
  primary-rose: "oklch(0.68 0.19 15)"
  primary-rose-light: "oklch(0.514 0.222 16.935)"
  primary-foreground-dark: "oklch(0.13 0.02 15)"
  primary-foreground-light: "oklch(0.985 0.005 15)"
  spectrum-violet: "oklch(0.72 0.15 300)"
  tauri-cyan: "oklch(0.75 0.13 200)"
  obsidian-bg: "oklch(0.13 0.005 285)"
  obsidian-card: "oklch(0.175 0.006 285)"
  obsidian-secondary: "oklch(0.23 0.008 285)"
  obsidian-muted: "oklch(0.22 0.008 285)"
  obsidian-foreground: "oklch(0.985 0 0)"
  obsidian-muted-foreground: "oklch(0.75 0.014 285)"
  obsidian-border: "oklch(1 0 0 / 12%)"
  daylight-bg: "oklch(0.99 0.002 285)"
  daylight-card: "oklch(0.975 0.003 285)"
  daylight-foreground: "oklch(0.145 0.008 285)"
  daylight-muted-foreground: "oklch(0.42 0.015 285)"
  daylight-border: "oklch(0.88 0.008 285)"
typography:
  display:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "clamp(2.25rem, 4.5vw, 3.4rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "clamp(1.875rem, 3.2vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist Mono Variable, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "64px"
  3xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary-rose}"
    textColor: "{colors.primary-foreground-dark}"
    rounded: "{rounded.xl}"
    padding: "10px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.obsidian-card}"
    textColor: "{colors.obsidian-foreground}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    height: "44px"
  studio-card:
    backgroundColor: "{colors.obsidian-card}"
    textColor: "{colors.obsidian-foreground}"
    rounded: "{rounded.2xl}"
    padding: "20px"
---

# Design System: SusuEdition

## Overview

**Creative North Star: "The Rhythm Studio Console"**

SusuEdition's visual system translates the tactile precision of a hardware-accelerated audio-visual editing deck into a clean, responsive interface across its native Tauri v2 application (`src/`) and its interactive web presentation stage (`docs/`). Rooted in the `b4zjJi3lY` shadcn/ui preset, the aesthetic defaults to a deep obsidian studio environment (`oklch(0.13 0.005 285)`) engineered so colorful photo collages, 9:16 vertical previews, and rose-coral beat markers command immediate visual authority without chromatic fatigue, while offering a crisp daylight counterpart (`oklch(0.99 0.002 285)`).

Every surface is structured like an instrument panel rather than a marketing brochure: frameless window chrome, `1px` hairline structural dividers, tabular monospace timecode readouts (`0:20.0 · 120 BPM · 9/9 on beat`), and spring-physics interactive controls powered by Animate UI and Motion.

**Key Characteristics:**
- Frameless desktop studio geometry with hairline `1px` borders (`oklch(1 0 0 / 12%)` in dark mode) and zero decorative clutter.
- High-contrast Rose Signal (`oklch(0.68 0.19 15)`) reserved strictly for beat-cut markers, active transport triggers, and primary download actions.
- Monospace tabular telemetry (`Geist Mono Variable` with `tabular-nums`) for BPM, durations, pixel dimensions, and performance budgets.
- Purposeful tactile motion: spring-driven sliding selection highlights (`@animate-ui/react` `Highlight` and `TabsHighlight`), animated SVG icon strokes (`AnimateIcon`), and magnetic transport/download triggers.

## Colors

The palette pairs cool obsidian neutrals tinted at hue `285` with a single high-energy rose-coral primary signal and spectrum accents derived from the brand mark.

### Primary
- **Rose Beat Signal — Dark** (`oklch(0.68 0.19 15)`): Primary action fill, active beat markers on the waveform, playhead indicators, and the `Edition` wordmark accent in dark mode. Paired with deep rose-ebony text (`oklch(0.13 0.02 15)`) for verified AAA contrast.
- **Rose Beat Signal — Light** (`oklch(0.514 0.222 16.935)`): Primary action fill and beat accent in light mode, paired with warm white text (`oklch(0.985 0.005 15)`).

### Secondary
- **Spectrum Violet** (`oklch(0.72 0.15 300)`): Secondary brand gradient stop (`#f43f5e` to `#a855f7` in `/logo.svg`) and chart/waveform harmonic accent.

### Tertiary
- **Tauri Cyan** (`oklch(0.75 0.13 200)`): Technical telemetry accent (`--chart-3`).

### Neutral
- **Obsidian Canvas** (`oklch(0.13 0.005 285)`): Primary dark-mode application and presentation background.
- **Studio Deck Surface** (`oklch(0.175 0.006 285)`): Elevated console panels, timeline containers, and specification ledgers in dark mode.
- **Obsidian Muted Surface** (`oklch(0.22 0.008 285)`): Inactive control tracks, pill backgrounds, and code blocks.
- **Studio Alabaster** (`oklch(0.985 0 0)`): Primary foreground text in dark mode.
- **Muted Slate** (`oklch(0.75 0.014 285)`): Secondary body copy and metadata labels in dark mode (maintained at ≥ 4.5:1 contrast against both canvas and card surfaces).
- **Hairline Studio Border** (`oklch(1 0 0 / 12%)` dark / `oklch(0.88 0.008 285)` light): Structural `1px` dividers across ledgers, toolbars, and studio frames.

### Named Rules
**The Beat-Signal Discipline Rule.** Rose Beat Signal (`--primary`) appears only where timing, playback, or primary conversion occurs—playheads, beat-locked cut markers, active tool pills, and the primary Download CTA. Never spend primary rose on passive container backgrounds or decorative halos.

**The Tinted Neutral Rule.** All dark and light neutrals carry a subtle `285` violet-slate hue angle (`0.005–0.015` chroma) so dark surfaces harmonize with media previews and never read as dead flat `#000000` or `#808080`.

## Typography

**Display Font:** Geist Variable (with Inter Variable and system sans-serif fallbacks)
**Body Font:** Geist Variable (with Inter Variable and system sans-serif fallbacks)
**Label/Mono Font:** Geist Mono Variable (with `ui-monospace, SFMono-Regular, monospace`)

**Character:** Geometric, high-x-height contemporary sans-serif (`cv02`, `cv03`, `cv04`, `cv11`) for immediate UI legibility, paired with crisp tabular monospace (`Geist Mono Variable`) for timecodes, BPM readouts, aspect ratios, and CLI commands.

### Hierarchy
- **Display** (`700` weight, `clamp(2.25rem, 4.5vw, 3.4rem)`, `1.05` line-height, `-0.035em` tracking): Hero thesis headline (`Your moments, on the beat.`), balanced with `text-balance`.
- **Headline** (`700` weight, `clamp(1.875rem, 3.2vw, 2.25rem)`, `1.15` line-height, `-0.025em` tracking): Section lead headings (`h2`).
- **Title** (`700` weight, `1.25rem` / `20px`, `1.3` line-height, `-0.015em` tracking): Active screen titles and architectural stage headers (`h3`).
- **Body** (`400` weight, `1rem` / `16px`, `1.625` line-height, `62ch–65ch` max measure): Section descriptions and feature explanations.
- **Label / Telemetry** (`500–600` weight, `0.75rem` / `12px`, `tabular-nums`): Timecodes (`0:20.0`), BPM (`120 BPM`), aspect ratios (`9:16`), and file artifacts (`SusuEdition_x.y.z_x64-setup.exe`).

### Named Rules
**The Naked Heading Rule.** Headings (`h1`, `h2`, `h3`) always lead their container directly—never place an eyebrow, kicker, or category label above a heading. Supporting telemetry or status pills sit below the heading or in an adjacent toolbar column.

**The Tabular Timecode Rule.** Every numeric readout that changes or compares quantities (timecodes, BPM, clip durations, pixel margins, performance budgets) uses `font-mono` and `tabular-nums` (or `@animate-ui` `SlidingNumber`) so digits never jitter horizontally during playback or slider scrubbing.

## Layout

The layout combines a sticky `60px` (`h-15`) frameless-inspired transport header (anchored by a `2px` full-width `@animate-ui` `ScrollProgress` playhead bar) with a `1280px` (`max-w-7xl`) 12-column studio grid (`px-4 sm:px-6 lg:px-8`).

- **First Viewport:** 5-column left thesis/conversion rail paired with a 7-column interactive Beat-Sync Studio Deck (`BeatStudioDeck`).
- **Section Rhythm:** Generous `64px` (`py-16`) mobile to `96px` (`lg:py-24`) desktop vertical spacing, alternating between the base canvas (`bg-background`) and subtle recessed studio bands (`bg-card/30`) separated by `1px` full-bleed borders.
- **Architectural Ledgers over Card Grids:** Multi-item specifications (`EngineLedger`, `ScreenshotShowcase`, `RELEASE_ARTIFACTS`) use divided border-grid tables (`divide-y divide-border` / `md:divide-x`) inside a single container rather than repetitive grids of icon cards or nested cards.

## Elevation & Depth

SusuEdition uses **tonal surface layering** (`--background` to `--card` to `--muted`) reinforced by `1px` translucent borders (`oklch(1 0 0 / 12%)`), reserving multi-layer ambient shadows exclusively for primary studio monitor frames.

### Shadow Vocabulary
- **Studio Monitor Elevation** (`box-shadow: 0 18px 42px -12px rgba(0, 0, 0, 0.42), 0 4px 12px -2px rgba(0, 0, 0, 0.24)`): Applied via `.studio-elevation` to the primary interactive Beat Studio Deck, the Screenshot Showcase monitor frame, and the Photo Collage canvas preview.

### Named Rules
**The Single-Container Rule.** Never nest a bordered card inside another bordered card. Inside a studio deck, sub-regions are separated by `1px` hairline dividers (`border-t` / `divide-y`) or subtle background shifts (`bg-muted/35`).

## Shapes

Corners follow a continuous concentric radius scale anchored at `--radius: 0.625rem` (`10px`):
- **Outer Studio Consoles & Ledgers:** `rounded-2xl` (`18px`)
- **Interactive Option Tiles & Primary CTAs:** `rounded-xl` (`14px`)
- **Toolbar Controls, Tabs & Icon Buttons:** `rounded-lg` (`10px`)
- **Inline Telemetry Badges & Timeline Clips:** `rounded-md` (`8px`) or `rounded-full` for status pills.

## Components

### Buttons
- **Shape:** `rounded-xl` (`14px`) for primary hero/release CTAs (`h-11 px-5`); `rounded-lg` (`10px`) for header actions (`h-8 px-3`).
- **Primary:** Solid `bg-primary text-primary-foreground font-semibold`, wrapped with `@animate-ui` `Magnetic`, `Shine` (`enableOnHover`, clipped via `relative overflow-hidden`), and `AnimateIcon`.
- **Secondary / Outline:** `border border-border bg-card text-foreground hover:bg-muted`, with animated SVG icons.
- **Icon / Transport Buttons:** `@animate-ui` `RippleButton` + `RippleButtonRipples` for tactile click waves on Play/Pause, Theme Toggle, and Prev/Next screenshot steppers.

### Chips & Status Pills
- **Style:** `rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-foreground` with a `13px` `text-primary` icon.
- **Beat-Locked Indicator:** `rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 font-mono text-[11px] text-foreground`.

### Interactive Selection Groups (`Highlight` & `TabsHighlight`)
- **Behavior:** Powered by `@animate-ui/react/primitives/effects/highlight` (`controlledItems`) and `@animate-ui/react/primitives/tabs`. A single `motion.div` indicator (`inset-0 rounded-xl border border-primary/50 bg-primary/10`) glides with spring physics between Beat Sync styles (`Dynamic`, `Steady`, `Bars`, `Accents`), Aspect Ratios (`4:5`, `1:1`, `9:16`, `16:9`, `4:3`, `3:4`), and specification tabs.

### Cards / Studio Decks
- **Corner Style:** `rounded-2xl` (`18px`)
- **Background:** `bg-card` (`oklch(0.175 0.006 285)` in dark mode)
- **Shadow Strategy:** `.studio-elevation` on hero/stage monitors; flat `1px` border on specification ledgers.
- **Border:** `1px solid var(--border)`

### Signature Component: BeatStudioDeck & CollageStudioLab
- **BeatStudioDeck:** Live 20-second scrubbable timeline with 40-bar waveform, 10 dynamic mountain-artwork clips whose widths recalculate on the fly per selected Beat Sync preset and Flexibility slider (`10%–100%`), animated `MorphingText` song section indicator, and `SlidingNumber` BPM/timecode readouts.
- **CollageStudioLab:** Live 12-column × 6-row CSS grid canvas that smoothly animates aspect ratio (`4:5`, `1:1`, `9:16`, `16:9`, `4:3`, `3:4`), smart layout template (`Justified`, `Spotlight`, `Mosaic`, `2×3 Grid`), outer margin (`0–28px`), inner gap (`0–20px`), corner radius (`0–28px`), and click-to-swap photo cells via Motion layout transitions.

## Do's and Don'ts

### Do:
- **Do** wrap every interactive icon trigger in `<AnimateIcon animateOnHover>` from `@animate-ui/react/icons`.
- **Do** pass `controlledItems` and `className="inset-0 ..."` when using `<Highlight>` with explicit `<HighlightItem>` children, and set `className="flex h-full w-full"` on `<HighlightItem>` in grid layouts.
- **Do** keep `relative overflow-hidden` on any button or link child wrapped by `<Shine asChild>` so the specular sweep stays bounded inside the control.
- **Do** theme browser surfaces (`::selection`, `caret-color`, custom scrollbars, `text-underline-offset: 4px`) from `--primary` and `--background`.

### Don't:
- **Don't** place kickers, eyebrows, or small uppercase labels above `h1`, `h2`, or `h3` headings.
- **Don't** use CSS gradient text (`bg-clip-text text-transparent`); achieve emphasis through weight (`font-bold`) and solid `text-primary` color contrast.
- **Don't** use decorative background grid-line patterns, zero-offset neon glow shadows, or nested cards.
- **Don't** use Unicode emoji characters as icons; use `@animate-ui` SVG icon components exclusively.
