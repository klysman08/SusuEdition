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
import { ImageZoom, Image } from "@animate-ui/react/primitives/effects/image-zoom"
import { RippleButton, RippleButtonRipples } from "@animate-ui/react/primitives/buttons/ripple"

import { Clapperboard } from "@/components/animate-ui/icons/clapperboard"
import { Music } from "@/components/animate-ui/icons/music"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"
import { Image as ImageIcon } from "@/components/animate-ui/icons/image"
import { House } from "@/components/animate-ui/icons/house"
import { ArrowLeft } from "@/components/animate-ui/icons/arrow-left"
import { ArrowRight } from "@/components/animate-ui/icons/arrow-right"
import { cn } from "@/lib/utils"

interface ScreenItem {
  id: string
  label: string
  title: string
  description: string
  image: string
  alt: string
  specs: { label: string; value: string }[]
  icon: React.ComponentType<{ className?: string }>
}

const SCREENS: ScreenItem[] = [
  {
    id: "video-rhythm",
    label: "Rhythm & Timeline",
    title: "Dynamic beat-synced timeline & Song Map",
    description:
      "Every cut snaps to a detected musical beat using dynamic programming. Choose between Dynamic, Steady, Bars, or Accents styles, adjust timing flexibility, or drag cut handles manually with magnetic beat snapping.",
    image: `${import.meta.env.BASE_URL}images/video-maker.png`,
    alt: "Video Maker editor with beat-synced timeline and Rhythm panel",
    icon: Clapperboard,
    specs: [
      { label: "Beat styles", value: "Dynamic · Steady · Bars · Accents" },
      { label: "Manual precision", value: "Drag handles · Split (S) · Markers (M) · ±0.1s" },
      { label: "Per-clip motion", value: "Zoom, Pan, Rise, Impact, Pulse, Spin" },
      { label: "Streaming export", value: "MP4 (H.264 High + AAC) · 720p, 1080p, 4K @ 30/60fps" },
    ],
  },
  {
    id: "video-music",
    label: "Music & Waveform",
    title: "Interactive waveform section picker & BPM analysis",
    description:
      "Import MP3, AAC/M4A, WAV, OGG, or FLAC tracks. Preview and drag section handles directly over the beat-annotated waveform, lock cuts to beats, and mix original video audio with automatic ducking and a 3-second fade-out.",
    image: `${import.meta.env.BASE_URL}images/video-maker-music.png`,
    alt: "Music panel with waveform, BPM and beat markers",
    icon: Music,
    specs: [
      { label: "Audio formats", value: "MP3 · AAC/M4A · WAV · OGG · FLAC" },
      { label: "Beat engine", value: "Symphonia DSP (Rust) + TypeScript fallback" },
      { label: "Quick lengths", value: "15s · 30s · 60s · Full track section" },
      { label: "Audio mixing", value: "Per-clip gain · Music ducking · Auto 3s fade-out" },
    ],
  },
  {
    id: "video-filters",
    label: "Video Color Grading",
    title: "10 studio filter presets & 8 live WebGL2 adjustments",
    description:
      "Apply a unified look across your entire timeline or customize individual clips. Every preset and slider renders in real time through the WebGL2 compositor in both the live preview and the final hardware export.",
    image: `${import.meta.env.BASE_URL}images/video-maker-filters.png`,
    alt: "Video filters panel with presets and manual sliders",
    icon: Sparkles,
    specs: [
      { label: "10 Presets", value: "Original, Vivid, Warm, Cool, B&W, Noir & more" },
      { label: "8 Sliders", value: "Brightness, Contrast, Saturation, Temperature, Vignette, B&W, Sepia, Fade" },
      { label: "Reset control", value: "Double-click any slider to reset instantly" },
      { label: "Aspect ratios", value: "9:16 · 16:9 · 4:3 · 1:1 · 4:5 · 3:4 (Fit/Blur/Fill)" },
    ],
  },
  {
    id: "collage-layout",
    label: "Photo Collage",
    title: "Smart justified layouts for 2 to 20+ photos",
    description:
      "Automatic justified rows preserve each photo's natural proportions to crop as little as possible—or choose from structured grids, spotlights, and editorial mosaics. Pan, zoom, or drag-and-hold to swap any cell.",
    image: `${import.meta.env.BASE_URL}images/photo-collage.png`,
    alt: "Photo Collage layout step with live preview",
    icon: LayoutDashboard,
    specs: [
      { label: "Smart engine", value: "Proportion-aware justified rows + 14+ grid templates" },
      { label: "Aspect ratios", value: "Stories (9:16), YouTube (16:9), Classic (4:3), Square (1:1), Feed (4:5), Portrait (3:4)" },
      { label: "Margins & style", value: "Resolution-scaled outer margin, inner gap, corner radius & canvas color" },
      { label: "High-res export", value: "Off-thread PNG or JPEG up to 4096 px" },
    ],
  },
  {
    id: "collage-filters",
    label: "Collage Filters",
    title: "Cohesive color grading across every photo cell",
    description:
      "Unify photos shot under different lighting conditions using the exact same 10 filter presets and 8 fine-grained adjustment sliders from the Video Maker, rendered off the main thread at full export resolution.",
    image: `${import.meta.env.BASE_URL}images/photo-collage-filters.png`,
    alt: "Photo Collage filters step",
    icon: ImageIcon,
    specs: [
      { label: "Pipeline", value: "Shared WebGL2 / OffscreenCanvas color pipeline" },
      { label: "Cell framing", value: "Tap to adjust · Drag to reposition · Hold to swap" },
      { label: "Undo / Redo", value: "Full history stack (Ctrl+Z / Ctrl+Shift+Z)" },
      { label: "Output target", value: "Pictures/SusuEdition on Windows & Android Gallery" },
    ],
  },
  {
    id: "home-hub",
    label: "Home & Projects",
    title: "Frameless workspace with instant local project recovery",
    description:
      "Every change autosaves locally on your device. Media files are referenced directly by path via the custom susu:// HTTP Range protocol—never duplicated or uploaded—and 150 cached thumbnails reopen in ~60 ms.",
    image: `${import.meta.env.BASE_URL}images/home.png`,
    alt: "Home screen with recent projects",
    icon: House,
    specs: [
      { label: "Zero-copy media", value: "Referenced by path via Rust susu:// Range protocol" },
      { label: "Thumbnail cache", value: "150 items reopen in ~60 ms on disk cache" },
      { label: "Privacy", value: "100% offline · Zero accounts · Zero telemetry" },
      { label: "Window chrome", value: "Frameless Windows 11 titlebar + Android safe-area nav" },
    ],
  },
]

export function ScreenshotShowcase() {
  const [activeTab, setActiveTab] = React.useState<string>(SCREENS[0].id)

  const currentIndex = SCREENS.findIndex((s) => s.id === activeTab)

  const stepScreen = (delta: number) => {
    const nextIndex = (currentIndex + delta + SCREENS.length) % SCREENS.length
    setActiveTab(SCREENS[nextIndex].id)
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full space-y-6"
    >
      {/* Top Interactive Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <TabsHighlight className="inset-0 rounded-lg border border-primary/40 bg-primary/15">
          <TabsList className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">
            {SCREENS.map((screen) => {
              const Icon = screen.icon
              const isSelected = activeTab === screen.id
              return (
                <TabsHighlightItem key={screen.id} value={screen.id}>
                  <AnimateIcon animateOnHover asChild>
                    <TabsTrigger
                      value={screen.id}
                      className={cn(
                        "relative z-10 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
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
                      <span>{screen.label}</span>
                    </TabsTrigger>
                  </AnimateIcon>
                </TabsHighlightItem>
              )
            })}
          </TabsList>
        </TabsHighlight>

        {/* Prev / Next Transport Stepper */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            Screen {currentIndex + 1} of {SCREENS.length} · Hover image to zoom
          </span>
          <div className="flex items-center gap-1">
            <AnimateIcon animateOnHover asChild>
              <RippleButton
                type="button"
                onClick={() => stepScreen(-1)}
                aria-label="Previous screenshot"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
                <RippleButtonRipples />
              </RippleButton>
            </AnimateIcon>
            <AnimateIcon animateOnHover asChild>
              <RippleButton
                type="button"
                onClick={() => stepScreen(1)}
                aria-label="Next screenshot"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
              >
                <ArrowRight className="size-4" />
                <RippleButtonRipples />
              </RippleButton>
            </AnimateIcon>
          </div>
        </div>
      </div>

      {/* Animated Tab Contents */}
      <TabsContents className="overflow-hidden">
        {SCREENS.map((screen) => (
          <TabsContent key={screen.id} value={screen.id} className="outline-none">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
              {/* Screenshot Frame with Animate UI ImageZoom (8 cols) */}
              <div className="studio-elevation overflow-hidden rounded-2xl border border-border bg-[#0b0b10] lg:col-span-8">
                <ImageZoom
                  zoomScale={1.65}
                  zoomOnHover
                  zoomOnClick
                  className="w-full cursor-zoom-in overflow-hidden"
                >
                  <Image
                    src={screen.image}
                    alt={screen.alt}
                    className="block h-auto w-full select-none"
                    loading="lazy"
                  />
                </ImageZoom>
              </div>

              {/* Contextual Specification Ledger (4 cols) */}
              <div className="flex flex-col justify-between space-y-5 lg:col-span-4">
                <div className="space-y-2.5">
                  <h3 className="text-xl font-bold tracking-tight text-balance text-foreground">
                    {screen.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {screen.description}
                  </p>
                </div>

                <dl className="divide-y divide-border border-y border-border">
                  {screen.specs.map((spec) => (
                    <div key={spec.label} className="py-3">
                      <dt className="text-xs font-medium text-muted-foreground">
                        {spec.label}
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs font-medium text-foreground">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </TabsContent>
        ))}
      </TabsContents>
    </Tabs>
  )
}
