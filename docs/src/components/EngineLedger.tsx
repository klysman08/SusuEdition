import * as React from "react"
import { AnimateIcon } from "@animate-ui/react/icons"
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsHighlight,
  TabsHighlightItem,
  TabsList,
  TabsTrigger,
} from "@animate-ui/react/primitives/tabs"
import { CopyButton, CopyButtonIcon } from "@animate-ui/react/primitives/buttons/copy"

import { Clapperboard } from "@/components/animate-ui/icons/clapperboard"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"
import { FolderOpen } from "@/components/animate-ui/icons/folder-open"
import { Settings } from "@/components/animate-ui/icons/settings"
import {
  CpuIcon,
  ShieldCheckIcon,
  CheckIcon,
  CopyGlyphIcon,
} from "@/components/animate-ui/icons/studio-icons"
import { cn } from "@/lib/utils"

const VIDEO_SPECS = [
  {
    feature: "Beat sync",
    detail:
      "Detects BPM and beats (Symphonia in Rust on desktop, TypeScript in browser) and places every cut on a beat via dynamic programming across Dynamic, Steady, Bars and Accents styles.",
  },
  {
    feature: "Song map",
    detail:
      "Local energy, bars and section changes (chorus, drop, break) drawn under the timeline so the edit follows the song structure.",
  },
  {
    feature: "Full-screen editor",
    detail:
      "Always-visible preview, media + audio timeline, and dedicated tool dock (Media, Music, Rhythm, Audio, Filters, Format).",
  },
  {
    feature: "Manual timing",
    detail:
      "Drag cut handles (snaps to beats and playhead), reorder clips, ±0.1s nudges, split at playhead (S), music markers (M).",
  },
  {
    feature: "Trim & crop",
    detail:
      "Trim videos with a frame strip and audio preview; crop any photo or video with free or fixed aspect ratios.",
  },
  {
    feature: "Per-clip look & motion",
    detail:
      "Filter preset + intensity, photo motion (zoom, pan, rise, impact, pulse, spin) and entry transition per clip.",
  },
  {
    feature: "Filters & adjustments",
    detail:
      "10 presets and 8 manual adjustments (Brightness, Contrast, Saturation, Temperature, Vignette, B&W, Sepia, Fade) applied in preview and export.",
  },
  {
    feature: "Formats & framing",
    detail:
      "9:16, 16:9, 4:3, 1:1, 4:5, 3:4 · Fit / Fill / Stretch · Blurred or solid background.",
  },
  {
    feature: "Audio & ducking",
    detail:
      "Music section picker with waveform, clip sound toggle & gain, music ducking under video clips, and automatic 3s fade-out.",
  },
  {
    feature: "Hardware export",
    detail:
      "MP4 (H.264 High + AAC-LC 48 kHz 192 kbps) at 720p, 1080p or 4K, 30/60 fps, streamed to disk with constant memory.",
  },
  {
    feature: "Local projects",
    detail:
      "Autosave on every change, crash recovery, undo/redo (Ctrl+Z / Ctrl+Shift+Z), Ctrl+S. Media is referenced by path — never copied.",
  },
]

const COLLAGE_SPECS = [
  {
    feature: "Smart layouts",
    detail:
      "Automatic justified rows that crop as little as possible, plus structured grids, spotlights and row/column combos for 2 to 20+ photos.",
  },
  {
    feature: "Aspect ratios",
    detail:
      "Stories (9:16), YouTube (16:9), Classic (4:3), Square (1:1), Feed (4:5) and Portrait (3:4).",
  },
  {
    feature: "Margins & style",
    detail:
      "Outer margin, inner gap, rounded corners and background color — measured on a 1080p reference and scaled cleanly to the export resolution.",
  },
  {
    feature: "Per-photo framing",
    detail:
      "Tap to select, drag to reposition, zoom inside the cell, press-and-hold (or drag) to swap photos between cells.",
  },
  {
    feature: "Shared filter engine",
    detail:
      "The exact same 10 presets and 8 manual adjustments as the Video Maker, applied across the entire collage.",
  },
  {
    feature: "Off-thread export",
    detail:
      "PNG or JPEG (adjustable quality) up to 4096 px on the longest side, rendered off the main thread.",
  },
]

const STACK_SPECS = [
  {
    layer: "Native Shell",
    tools: "Tauri v2 (Rust) — Windows 10/11 (frameless window) and Android 8.0+ (API 26+)",
    budget: "Installer < 15 MB (Windows) · APK < 40 MB (Android)",
  },
  {
    layer: "UI & Motion",
    tools: "React 19, Vite, Tailwind CSS v4, shadcn/ui (radix-nova), Animate UI, Motion",
    budget: "Main thread tasks < 50 ms during import and export",
  },
  {
    layer: "Media Engine",
    tools: "TypeScript: WebCodecs + Mediabunny decode/encode, WebGL2 compositor, Web Workers",
    budget: "1 min 1080p30 export ≤ 1.5× real-time desktop · < 1.5 GB RAM",
  },
  {
    layer: "Rust Services",
    tools: "Custom susu:// HTTP Range protocol, Symphonia BPM/beat DSP, disk thumbnail cache",
    budget: "150 cached items reopen in ~60 ms · Zero full-file JS buffering",
  },
  {
    layer: "State, i18n & Themes",
    tools: "Zustand, react-router, i18next (English & Brazilian Portuguese), Light/Dark/System",
    budget: "100% local storage · Zero cloud accounts · Zero telemetry",
  },
]

const DEV_COMMANDS = [
  {
    label: "Install workspace dependencies",
    cmd: "pnpm install",
  },
  {
    label: "Run desktop app in development (Windows 11 / Tauri v2)",
    cmd: "pnpm tauri dev",
  },
  {
    label: "Run Android build on connected device or emulator",
    cmd: "pnpm tauri android dev",
  },
  {
    label: "Run frontend quality checks (ESLint, TypeScript, Vitest)",
    cmd: "pnpm lint && pnpm typecheck && pnpm test",
  },
  {
    label: "Run Rust formatting, Clippy lints & unit tests",
    cmd: "cargo fmt --manifest-path src-tauri/Cargo.toml --all && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml",
  },
]

export function EngineLedger() {
  const [tab, setTab] = React.useState("video-spec")

  return (
    <div className="space-y-8">
      {/* Architectural Pipeline Strip (Border-grid schematic, no icon cards) */}
      <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-4 md:divide-x md:divide-y-0">
        <div className="p-5">
          <div className="flex items-center justify-between font-mono text-xs text-[#24c8db]">
            <span>STAGE 1 · ZERO-COPY IO</span>
            <FolderOpen className="size-4 text-[#24c8db]" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground">
            Rust susu:// Range Protocol
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Media stays in place on disk. Custom HTTP Range streaming feeds WebCodecs and thumbnails without copying gigabytes into JS memory.
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between font-mono text-xs text-[#a855f7]">
            <span>STAGE 2 · MUSICAL DSP</span>
            <CpuIcon size={16} className="text-[#a855f7]" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground">
            Symphonia Beat &amp; Song Map
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Decodes audio in Rust to extract BPM, beat transients, bar boundaries, and energy sections, solving cut placement by dynamic programming.
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>STAGE 3 · GPU COMPOSITOR</span>
            <Clapperboard className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground">
            WebGL2 + WebCodecs + Mediabunny
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Real-time shader filters, motion transforms, and hardware H.264 + AAC encoding streamed directly to disk up to 4K 60fps.
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>STAGE 4 · PRIVACY GUARANTEE</span>
            <ShieldCheckIcon size={16} className="text-primary" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground">
            100% On-Device Execution
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            No account sign-up, no cloud rendering queues, no telemetry. Only periodic GitHub Release checks every 6 hours for installer updates.
          </p>
        </div>
      </div>

      {/* Complete Specification Ledger Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsHighlight className="inset-0 rounded-lg border border-primary/40 bg-primary/15">
          <TabsList className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 w-fit">
            {[
              { id: "video-spec", label: "Video Maker (11)", icon: Clapperboard },
              { id: "collage-spec", label: "Photo Collage (6)", icon: LayoutDashboard },
              { id: "stack-spec", label: "Tech Stack & Budgets", icon: CpuIcon },
              { id: "dev-spec", label: "Development & CLI", icon: Settings },
            ].map((item) => {
              const Icon = item.icon
              const isSelected = tab === item.id
              return (
                <TabsHighlightItem key={item.id} value={item.id}>
                  <AnimateIcon animateOnHover asChild>
                    <TabsTrigger
                      value={item.id}
                      className={cn(
                        "relative z-10 inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
                        isSelected
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-3.5",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span>{item.label}</span>
                    </TabsTrigger>
                  </AnimateIcon>
                </TabsHighlightItem>
              )
            })}
          </TabsList>
        </TabsHighlight>

        <TabsContents className="overflow-hidden rounded-2xl border border-border bg-card">
          <TabsContent value="video-spec" className="outline-none">
            <div className="divide-y divide-border">
              {VIDEO_SPECS.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-12 sm:items-baseline sm:gap-4"
                >
                  <div className="font-mono text-xs font-semibold text-foreground sm:col-span-3">
                    {row.feature}
                  </div>
                  <div className="text-sm text-muted-foreground sm:col-span-9">
                    {row.detail}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="collage-spec" className="outline-none">
            <div className="divide-y divide-border">
              {COLLAGE_SPECS.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-12 sm:items-baseline sm:gap-4"
                >
                  <div className="font-mono text-xs font-semibold text-foreground sm:col-span-3">
                    {row.feature}
                  </div>
                  <div className="text-sm text-muted-foreground sm:col-span-9">
                    {row.detail}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="stack-spec" className="outline-none">
            <div className="divide-y divide-border">
              {STACK_SPECS.map((row) => (
                <div
                  key={row.layer}
                  className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-12 md:items-baseline md:gap-4"
                >
                  <div className="font-mono text-xs font-semibold text-foreground md:col-span-2">
                    {row.layer}
                  </div>
                  <div className="text-sm text-foreground md:col-span-6">
                    {row.tools}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-muted-foreground md:col-span-4 md:text-right">
                    {row.budget}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="dev-spec" className="outline-none">
            <div className="divide-y divide-border">
              <div className="bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
                Requirements: Node.js ≥ 22.12 · pnpm 10 (<code className="font-mono text-foreground">corepack enable</code>) · Rust stable (≥ 1.85) · WebView2 &amp; VS Build Tools (Windows) · Android SDK 35 &amp; NDK 27.
              </div>
              {DEV_COMMANDS.map((item) => (
                <div
                  key={item.cmd}
                  className="flex flex-col justify-between gap-2 px-5 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-muted-foreground">
                      {item.label}
                    </div>
                    <code className="block font-mono text-xs text-foreground">
                      {item.cmd}
                    </code>
                  </div>
                  <CopyButton
                    content={item.cmd}
                    aria-label={`Copy command: ${item.label}`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted"
                  >
                    <CopyButtonIcon
                      icon={<CopyGlyphIcon size={14} />}
                      copiedIcon={<CheckIcon size={14} className="text-emerald-500" />}
                    />
                  </CopyButton>
                </div>
              ))}
            </div>
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  )
}
