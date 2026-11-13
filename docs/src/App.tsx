import * as React from "react"
import { AnimateIcon } from "@animate-ui/react/icons"
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight"
import { Magnetic } from "@animate-ui/react/primitives/effects/magnetic"
import { Shine } from "@animate-ui/react/primitives/effects/shine"
import {
  ScrollProgress,
  ScrollProgressProvider,
} from "@animate-ui/react/primitives/scroll-progress"
import { RippleButton, RippleButtonRipples } from "@animate-ui/react/primitives/buttons/ripple"
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number"

import { Download } from "@/components/animate-ui/icons/download"
import { ExternalLink } from "@/components/animate-ui/icons/external-link"
import { Moon } from "@/components/animate-ui/icons/moon"
import { Sun } from "@/components/animate-ui/icons/sun"
import { Activity } from "@/components/animate-ui/icons/activity"
import { Clapperboard } from "@/components/animate-ui/icons/clapperboard"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"
import {
  WindowsIcon,
  AndroidIcon,
  GithubIcon,
  ShieldCheckIcon,
  CpuIcon,
} from "@/components/animate-ui/icons/studio-icons"
import { useTheme } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BeatStudioDeck } from "@/components/BeatStudioDeck"
import { ScreenshotShowcase } from "@/components/ScreenshotShowcase"
import { CollageStudioLab } from "@/components/CollageStudioLab"
import { EngineLedger } from "@/components/EngineLedger"
import { cn } from "@/lib/utils"

const RELEASES_URL = "https://github.com/klysman08/SusuEdition/releases/latest"
const REPO_URL = "https://github.com/klysman08/SusuEdition"

const NAV_ITEMS = [
  { id: "studio", label: "Beat Studio", href: "#studio" },
  { id: "screens", label: "Screenshots", href: "#screens" },
  { id: "collage", label: "Collage Lab", href: "#collage" },
  { id: "engine", label: "Architecture", href: "#engine" },
  { id: "download", label: "Download", href: "#download" },
]

const RELEASE_ARTIFACTS = [
  {
    platform: "Windows 10 / 11 (Installer)",
    arch: "x64 · NSIS Setup",
    file: "SusuEdition_x.y.z_x64-setup.exe",
    note: "Recommended for desktop. Automatically downloads WebView2 if missing (ships built-in on Windows 11).",
    icon: WindowsIcon,
    primary: true,
  },
  {
    platform: "Windows 10 / 11 (MSI Package)",
    arch: "x64 · WiX MSI",
    file: "SusuEdition_x.y.z_x64_en-US.msi",
    note: "Standard Windows Installer package for managed or silent workstation deployments.",
    icon: WindowsIcon,
    primary: false,
  },
  {
    platform: "Android 8.0+ (APK)",
    arch: "arm64-v8a / armeabi-v7a",
    file: "SusuEdition_vx.y.z_android.apk",
    note: "Touch-first editor with safe-area navigation. Exports directly to Movies/SusuEdition and Pictures/SusuEdition.",
    icon: AndroidIcon,
    primary: false,
  },
]

export function App() {
  const { theme, setTheme } = useTheme()
  const [activeNav, setActiveNav] = React.useState<string>("studio")

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <TooltipProvider>
      <ScrollProgressProvider global>
        <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
          {/* Sticky Studio Transport Header */}
          <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
            <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              {/* Brand Logo + Version Pill */}
              <div className="flex items-center gap-3">
                <a
                  href="#studio"
                  className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src={`${import.meta.env.BASE_URL}logo.svg`}
                    alt=""
                    className="size-7 rounded-lg"
                    width={28}
                    height={28}
                  />
                  <span className="text-base font-bold tracking-tight text-foreground">
                    Susu<span className="text-primary">Edition</span>
                  </span>
                </a>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden items-center gap-1.5 rounded-full border border-[#24c8db]/35 bg-[#24c8db]/10 px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-foreground transition hover:border-[#24c8db]/60 sm:inline-flex"
                >
                  <span className="size-1.5 rounded-full bg-[#24c8db]" />
                  <span>v0.9.0 · Tauri v2</span>
                </a>
              </div>

              {/* Center Navigation Rail with Animate UI Highlight */}
              <nav aria-label="Main navigation" className="hidden md:block">
                <Highlight
                  controlledItems
                  value={activeNav}
                  onValueChange={(v) => v && setActiveNav(v)}
                  className="inset-0 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-card/70 p-1">
                    {NAV_ITEMS.map((item) => (
                      <HighlightItem key={item.id} value={item.id}>
                        <a
                          href={item.href}
                          onClick={() => setActiveNav(item.id)}
                          className={cn(
                            "relative z-10 block rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                            activeNav === item.id
                              ? "text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {item.label}
                        </a>
                      </HighlightItem>
                    ))}
                  </div>
                </Highlight>
              </nav>

              {/* Right Actions: Theme Toggle, GitHub, Download CTA */}
              <div className="flex items-center gap-2">
                <AnimateIcon animateOnHover asChild>
                  <RippleButton
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Toggle color theme"
                    className="relative inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                  >
                    <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
                    <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
                    <RippleButtonRipples />
                  </RippleButton>
                </AnimateIcon>

                <AnimateIcon animateOnHover asChild>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub Repository"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                  >
                    <GithubIcon size={16} />
                  </a>
                </AnimateIcon>

                <Magnetic strength={0.18} range={70}>
                  <Shine
                    enableOnHover
                    duration={0.85}
                    opacity={0.25}
                    className="inline-flex overflow-hidden rounded-lg"
                  >
                    <AnimateIcon animateOnHover asChild>
                      <a
                        href={RELEASES_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-95"
                      >
                        <Download className="size-3.5" />
                        <span>Download</span>
                      </a>
                    </AnimateIcon>
                  </Shine>
                </Magnetic>
              </div>
            </div>

            {/* Mobile Section Navigation Strip (<768px) */}
            <nav
              aria-label="Mobile section navigation"
              className="flex items-center justify-between gap-0.5 border-t border-border/60 px-2 py-1.5 md:hidden"
            >
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveNav(item.id)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-tight transition-colors",
                    activeNav === item.id
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Animate UI Scroll Progress Bar acting as Timeline Playhead */}
            <div className="h-[2px] w-full bg-border/40">
              <ScrollProgress
                mode="scaleX"
                className="h-full origin-left bg-gradient-to-r from-[#f43f5e] via-[#a855f7] to-[#24c8db]"
              />
            </div>
          </header>

          <main>
            {/* SECTION 1: First Viewport — Asymmetric Rhythm Studio Console */}
            <section
              id="studio"
              className="mx-auto max-w-7xl px-4 pt-5 pb-12 sm:px-6 lg:px-8 lg:pt-6 lg:pb-16"
            >
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
                {/* Left Column: Direct Thesis, Copy & Platform Installers (5 cols) */}
                <div className="space-y-5 lg:col-span-5">
                  <div className="space-y-3.5">
                    <h1 className="text-4xl font-bold tracking-[-0.035em] text-balance text-foreground sm:text-5xl lg:text-[3.35rem] lg:leading-[1.04]">
                      Your moments,{" "}
                      <span className="text-primary">on the beat.</span>
                    </h1>
                    <p className="max-w-[62ch] text-base leading-relaxed text-muted-foreground">
                      Drop in your photos, videos and a song — SusuEdition finds the beats and cuts your video right on them. Or arrange your favorite shots into a polished collage in seconds. Nothing is uploaded: decoding, analysis, rendering and export all run locally on your GPU.
                    </p>
                  </div>

                  {/* Direct Platform Download Triggers */}
                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    <Magnetic strength={0.2} range={80}>
                      <Shine
                        enableOnHover
                        duration={0.9}
                        opacity={0.26}
                        className="inline-flex overflow-hidden rounded-xl"
                      >
                        <AnimateIcon animateOnHover asChild>
                          <a
                            href={RELEASES_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
                          >
                            <WindowsIcon size={16} />
                            <span>Download for Windows 11</span>
                            <Download className="size-4" />
                          </a>
                        </AnimateIcon>
                      </Shine>
                    </Magnetic>

                    <Magnetic strength={0.15} range={70}>
                      <AnimateIcon animateOnHover asChild>
                        <a
                          href={RELEASES_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
                        >
                          <AndroidIcon size={16} className="text-[#a855f7]" />
                          <span>Android APK</span>
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                        </a>
                      </AnimateIcon>
                    </Magnetic>
                  </div>

                  {/* Platform & Privacy Pills below CTAs */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-foreground">
                      <ShieldCheckIcon size={13} className="text-primary" />
                      100% Offline &amp; Private
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#24c8db]/30 bg-[#24c8db]/10 px-3 py-1 text-xs font-medium text-foreground">
                      <CpuIcon size={13} className="text-[#24c8db]" />
                      WebCodecs + WebGL2 + Rust
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a855f7]/35 bg-[#a855f7]/10 px-3 py-1 font-mono text-xs tabular-nums text-foreground">
                      4K · 60 fps MP4
                    </span>
                  </div>

                  {/* Inline Tabular Telemetry Strip (No metric cards) */}
                  <dl className="grid grid-cols-3 gap-4 border-t border-border pt-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Beat styles
                      </dt>
                      <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-foreground">
                        <SlidingNumber number={4} /> modes
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Cached 150 items
                      </dt>
                      <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-foreground">
                        ~<SlidingNumber number={60} /> ms
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Collage canvas
                      </dt>
                      <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-foreground">
                        <SlidingNumber number={4096} /> px
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Right Column: Live Interactive Beat-Sync Studio Deck (7 cols) */}
                <div className="lg:col-span-7">
                  <BeatStudioDeck />
                </div>
              </div>
            </section>

            {/* SECTION 2: Real Product Screen Stage */}
            <section
              id="screens"
              className="border-t border-border bg-card/30 py-16 lg:py-24"
            >
              <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div className="space-y-2.5">
                    <h2 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
                      Inside the frameless desktop studio.
                    </h2>
                    <p className="max-w-[65ch] text-base text-muted-foreground">
                      Explore the real Windows 11 application screens across the Video Maker, Waveform Section Picker, WebGL2 Color Grading, Photo Collage, and Home Project Hub.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <Clapperboard className="size-4 text-primary" />
                    <span>Native frameless window chrome · Dark &amp; Light themes</span>
                  </div>
                </div>

                <ScreenshotShowcase />
              </div>
            </section>

            {/* SECTION 3: Interactive Photo Collage Studio Lab */}
            <section id="collage" className="py-16 lg:py-24">
              <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div className="space-y-2.5">
                    <h2 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
                      Smart photo collages that respect every frame.
                    </h2>
                    <p className="max-w-[65ch] text-base text-muted-foreground">
                      Automatic justified rows preserve each photo&apos;s aspect ratio so nothing important gets cropped out—or switch to structured grids and spotlights, adjust margins and corner radius, and export up to 4096 px off the main thread.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <LayoutDashboard className="size-4 text-primary" />
                    <span>Interactive preview · Try changing ratios, layouts &amp; margins</span>
                  </div>
                </div>

                <CollageStudioLab />
              </div>
            </section>

            {/* SECTION 4: Local-First Architecture & Complete Feature Ledger */}
            <section
              id="engine"
              className="border-t border-border bg-card/30 py-16 lg:py-24"
            >
              <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div className="space-y-2.5">
                    <h2 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
                      Engineered in Rust, WebCodecs, and WebGL2.
                    </h2>
                    <p className="max-w-[65ch] text-base text-muted-foreground">
                      Built on Tauri v2 and React 19 with a pure-TypeScript media engine and native Rust services for Symphonia beat detection, disk thumbnail caching, and zero-copy HTTP Range streaming.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <Activity className="size-4 text-primary" />
                    <span>Deterministic timeline · Hardware H.264 + AAC</span>
                  </div>
                </div>

                <EngineLedger />
              </div>
            </section>

            {/* SECTION 5: Direct Release Download & Platform Table */}
            <section
              id="download"
              className="border-t border-border py-16 lg:py-24"
            >
              <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div className="space-y-2.5">
                    <h2 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
                      Grab the latest build for your device.
                    </h2>
                    <p className="max-w-[65ch] text-base text-muted-foreground">
                      Every tagged release compiles native installers for Windows 10/11 and Android 8.0+ via GitHub Actions. No account required—install and start editing offline immediately.
                    </p>
                  </div>

                  <Magnetic strength={0.18} range={70}>
                    <AnimateIcon animateOnHover asChild>
                      <a
                        href={RELEASES_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-muted"
                      >
                        <span>View all GitHub Releases</span>
                        <ExternalLink className="size-3.5 text-primary" />
                      </a>
                    </AnimateIcon>
                  </Magnetic>
                </div>

                {/* Release Artifacts Ledger Table */}
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {RELEASE_ARTIFACTS.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.file}
                        className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-primary">
                            <Icon size={18} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-bold text-foreground">
                                {item.platform}
                              </span>
                              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {item.arch}
                              </span>
                            </div>
                            <code className="block font-mono text-xs text-primary">
                              {item.file}
                            </code>
                            <p className="text-xs text-muted-foreground">
                              {item.note}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Magnetic strength={0.16} range={60}>
                            <Shine
                              enableOnHover
                              duration={0.85}
                              opacity={0.25}
                              className="inline-flex overflow-hidden rounded-xl"
                            >
                              <AnimateIcon animateOnHover asChild>
                                <a
                                  href={RELEASES_URL}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition",
                                    item.primary
                                      ? "bg-primary text-primary-foreground hover:opacity-95"
                                      : "border border-border bg-background text-foreground hover:bg-muted"
                                  )}
                                >
                                  <Download className="size-3.5" />
                                  <span>Download from Releases</span>
                                </a>
                              </AnimateIcon>
                            </Shine>
                          </Magnetic>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          </main>

          {/* Studio Footer */}
          <footer className="border-t border-border bg-card/50 py-10">
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}logo.svg`}
                  alt=""
                  className="size-7 rounded-md"
                  width={28}
                  height={28}
                />
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    SusuEdition
                  </span>{" "}
                  — Beat-synced videos and photo collages, made entirely on your device.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
                <span>
                  Created by{" "}
                  <a
                    href="https://github.com/klysman08"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline hover:text-primary"
                  >
                    @klysman08
                  </a>
                </span>
                <span>
                  Animated with{" "}
                  <a
                    href="https://github.com/imskyleen/animate-ui"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline hover:text-primary"
                  >
                    Animate UI
                  </a>
                </span>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline hover:text-primary"
                >
                  Releases
                </a>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline hover:text-primary"
                >
                  GitHub
                </a>
              </div>
            </div>
          </footer>
        </div>
      </ScrollProgressProvider>
    </TooltipProvider>
  )
}

export default App
