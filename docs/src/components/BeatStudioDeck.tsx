import * as React from "react"
import { motion } from "motion/react"
import { AnimateIcon } from "@animate-ui/react/icons"
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight"
import { Magnetic } from "@animate-ui/react/primitives/effects/magnetic"
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number"
import { MorphingText } from "@animate-ui/react/primitives/texts/morphing"
import { RippleButton, RippleButtonRipples } from "@animate-ui/react/primitives/buttons/ripple"

import { Activity } from "@/components/animate-ui/icons/activity"
import { Clapperboard } from "@/components/animate-ui/icons/clapperboard"
import { Music } from "@/components/animate-ui/icons/music"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { Volume2 } from "@/components/animate-ui/icons/volume-2"
import { RectangleVertical } from "@/components/animate-ui/icons/rectangle-vertical"
import { Minus } from "@/components/animate-ui/icons/minus"
import { WindowMaximize } from "@/components/animate-ui/icons/window-maximize"
import { X } from "@/components/animate-ui/icons/x"
import { PlayIcon, PauseIcon, ZapIcon } from "@/components/animate-ui/icons/studio-icons"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type BeatPresetId = "dynamic" | "steady" | "bars" | "accents"
export type StudioFilterId = "original" | "vivid" | "warm" | "cool" | "noir"

interface BeatPresetMeta {
  id: BeatPresetId
  label: string
  summary: string
  durations: number[]
  bpmDefault: number
}

const BEAT_PRESETS: Record<BeatPresetId, BeatPresetMeta> = {
  dynamic: {
    id: "dynamic",
    label: "Dynamic",
    summary: "Faster in intense parts, slower in calm ones.",
    durations: [2.5, 3.0, 3.0, 2.0, 1.5, 1.0, 1.5, 2.0, 2.0, 1.5],
    bpmDefault: 120,
  },
  steady: {
    id: "steady",
    label: "Steady",
    summary: "Even pace, snapped to the nearest musical beat.",
    durations: [2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
    bpmDefault: 120,
  },
  bars: {
    id: "bars",
    label: "Bars",
    summary: "Places cuts cleanly on downbeats at bar boundaries.",
    durations: [2.0, 2.0, 4.0, 2.0, 2.0, 2.0, 2.0, 2.0, 1.0, 1.0],
    bpmDefault: 124,
  },
  accents: {
    id: "accents",
    label: "Accents",
    summary: "Chases the hardest transient hits in the waveform.",
    durations: [3.0, 2.5, 1.5, 1.0, 1.0, 1.5, 2.5, 3.0, 2.5, 1.5],
    bpmDefault: 128,
  },
}

const CLIP_PALETTES = [
  { name: "Dusk Ridge", sky: "#3b1d6e", mid: "#5b21b6", front: "#1e1b4b", sun: "#fde047" },
  { name: "Glacier Peak", sky: "#0c4a6e", mid: "#0284c7", front: "#082f49", sun: "#e0f2fe" },
  { name: "Amber Canyon", sky: "#7c2d12", mid: "#d97706", front: "#451a03", sun: "#fef08a" },
  { name: "Emerald Pine", sky: "#064e3b", mid: "#059669", front: "#022c22", sun: "#bbf7d0" },
  { name: "Crimson Pass", sky: "#881337", mid: "#e11d48", front: "#4c0519", sun: "#fecdd3" },
  { name: "Deep Fjord", sky: "#134e4a", mid: "#0d9488", front: "#042f2e", sun: "#99f6e4" },
  { name: "Violet Summit", sky: "#581c87", mid: "#9333ea", front: "#2e1065", sun: "#f3e8ff" },
  { name: "Golden Hour", sky: "#78350f", mid: "#f59e0b", front: "#451a03", sun: "#fef9c3" },
  { name: "Midnight Crest", sky: "#1e3a8a", mid: "#3b82f6", front: "#172554", sun: "#dbeafe" },
  { name: "Rose Horizon", sky: "#831843", mid: "#db2777", front: "#500724", sun: "#fce7f3" },
]

const STUDIO_FILTERS: { id: StudioFilterId; label: string; css: string }[] = [
  { id: "original", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.42) contrast(1.12)" },
  { id: "warm", label: "Warm", css: "sepia(0.26) saturate(1.25) brightness(1.04)" },
  { id: "cool", label: "Cool", css: "hue-rotate(18deg) saturate(1.15) contrast(1.06)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.32) brightness(0.94)" },
]

const WAVEFORM_BARS = [
  0.32, 0.48, 0.86, 0.42, 0.54, 0.92, 0.38, 0.44, 0.78, 0.35, 0.51, 0.95,
  0.46, 0.62, 0.88, 0.41, 0.53, 0.91, 0.64, 0.72, 0.98, 0.76, 0.84, 0.99,
  0.82, 0.74, 0.96, 0.68, 0.79, 0.94, 0.61, 0.52, 0.89, 0.47, 0.59, 0.91,
  0.43, 0.38, 0.82, 0.34,
]

export function BeatStudioDeck() {
  const [preset, setPreset] = React.useState<BeatPresetId>("dynamic")
  const [beatSyncEnabled, setBeatSyncEnabled] = React.useState(true)
  const [flexibility, setFlexibility] = React.useState(60)
  const [activeFilter, setActiveFilter] = React.useState<StudioFilterId>("original")
  const [isPlaying, setIsPlaying] = React.useState(true)
  const [playheadSec, setPlayheadSec] = React.useState(4.2)

  const totalDuration = 20.0
  const currentPreset = BEAT_PRESETS[preset] ?? BEAT_PRESETS.dynamic

  // Compute clip durations based on beatSyncEnabled, preset, and flexibility
  const clipSegments = React.useMemo(() => {
    const baseDurations = beatSyncEnabled
      ? currentPreset.durations
      : Array.from({ length: 10 }, () => 2.0)

    const flexFactor = (flexibility - 60) / 100
    const rawAdjusted = baseDurations.map((d, idx) => {
      if (!beatSyncEnabled) return 2.0
      const mod = idx % 2 === 0 ? 1 + flexFactor * 0.22 : 1 - flexFactor * 0.22
      return Math.max(0.8, Number((d * mod).toFixed(1)))
    })

    const sum = rawAdjusted.reduce((acc, v) => acc + v, 0)
    const scale = totalDuration / sum
    let cursor = 0
    return rawAdjusted.map((d, idx) => {
      const scaled =
        idx === rawAdjusted.length - 1
          ? Number(Math.max(0.8, totalDuration - cursor).toFixed(1))
          : Number((d * scale).toFixed(1))
      const start = Number(cursor.toFixed(1))
      cursor += scaled
      return {
        index: idx,
        start,
        duration: scaled,
        end: Number(cursor.toFixed(1)),
        palette: CLIP_PALETTES[idx % CLIP_PALETTES.length],
      }
    })
  }, [beatSyncEnabled, currentPreset.durations, flexibility])

  React.useEffect(() => {
    if (!isPlaying) return
    let lastTime = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      setPlayheadSec((prev) => {
        const next = prev + dt
        return next >= totalDuration ? 0 : next
      })
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying])

  const activeClip = React.useMemo(() => {
    return (
      clipSegments.find((seg) => playheadSec >= seg.start && playheadSec <= seg.end) ??
      clipSegments[0]
    )
  }, [clipSegments, playheadSec])

  // Check if playhead is right on a cut boundary for beat flash
  const isNearCut = React.useMemo(() => {
    return clipSegments.some((seg) => Math.abs(playheadSec - seg.start) < 0.14)
  }, [clipSegments, playheadSec])

  const currentSongSection = React.useMemo(() => {
    if (playheadSec < 4) return "INTRO · WARMUP"
    if (playheadSec < 9.5) return "VERSE · STEADY GROOVE"
    if (playheadSec < 15.5) return "DROP · PEAK ENERGY"
    return "OUTRO · 3S FADE-OUT"
  }, [playheadSec])

  const filterCss =
    STUDIO_FILTERS.find((f) => f.id === activeFilter)?.css ?? "none"

  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setPlayheadSec(Number((ratio * totalDuration).toFixed(2)))
  }

  return (
    <div className="studio-elevation overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      {/* Frameless Windows 11 Studio Titlebar */}
      <div className="flex items-center justify-between border-b border-border bg-background/60 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="SusuEdition"
            className="size-5 rounded-md"
            width={20}
            height={20}
          />
          <span className="text-xs font-medium tracking-tight text-foreground">
            Video · golden-hour-cut
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            Saved
          </span>
          <span className="hidden rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground sm:inline-block">
            0:20 · 9:16
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-md border border-[#a855f7]/35 bg-[#a855f7]/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-foreground md:flex">
            <Activity className="size-3 text-[#a855f7]" />
            <MorphingText text={currentSongSection} />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-flex size-5 items-center justify-center rounded hover:bg-muted">
              <Minus className="size-3" />
            </span>
            <span className="inline-flex size-5 items-center justify-center rounded hover:bg-muted">
              <WindowMaximize className="size-3" />
            </span>
            <span className="inline-flex size-5 items-center justify-center rounded hover:bg-muted">
              <X className="size-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Editor Grid: Preview Stage + Rhythm Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left/Center Studio Preview + Timeline (7 cols) */}
        <div className="flex flex-col justify-between border-b border-border bg-background/40 p-3.5 lg:col-span-7 lg:border-r lg:border-b-0">
          {/* Top Mini Bar inside Preview */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Clapperboard className="size-3.5 text-primary" />
                Clip #{activeClip.index + 1}: {activeClip.palette.name}
              </span>
              <span className="font-mono text-[11px] tabular-nums">
                ({activeClip.duration.toFixed(1)}s)
              </span>
            </div>

            {/* Filter quick selector using Animate UI Highlight */}
            <Highlight
              controlledItems
              value={activeFilter}
              onValueChange={(val) => {
                if (val && STUDIO_FILTERS.some((f) => f.id === val)) {
                  setActiveFilter(val as StudioFilterId)
                }
              }}
              className="inset-0 rounded-md bg-primary/20 ring-1 ring-primary/50"
            >
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
                {STUDIO_FILTERS.map((f) => (
                  <HighlightItem key={f.id} value={f.id} className="flex">
                    <button
                      type="button"
                      onClick={() => setActiveFilter(f.id)}
                      className={cn(
                        "relative z-10 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                        activeFilter === f.id
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  </HighlightItem>
                ))}
              </div>
            </Highlight>
          </div>

          {/* 9:16 Vertical Canvas Preview */}
          <div className="relative mx-auto flex h-48 w-full max-w-[176px] items-center justify-center overflow-hidden rounded-xl border border-border bg-[#0b0a14] shadow-inner">
            <motion.svg
              key={activeClip.index}
              viewBox="0 0 220 320"
              className="h-full w-full object-cover"
              style={{ filter: filterCss }}
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <defs>
                <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeClip.palette.sky} />
                  <stop offset="65%" stopColor={activeClip.palette.mid} />
                  <stop offset="100%" stopColor={activeClip.palette.front} />
                </linearGradient>
              </defs>
              <rect width="220" height="320" fill="url(#skyGrad)" />
              {/* Glowing Sun */}
              <circle
                cx={90 + (activeClip.index % 3) * 22}
                cy={142 - (activeClip.index % 2) * 14}
                r="24"
                fill={activeClip.palette.sun}
                opacity="0.9"
              />
              <circle
                cx={90 + (activeClip.index % 3) * 22}
                cy={142 - (activeClip.index % 2) * 14}
                r="42"
                fill={activeClip.palette.sun}
                opacity="0.18"
              />
              {/* Layered Mountain Ridges matching SusuEdition artwork */}
              <polygon
                points="0,210 42,165 88,188 142,148 188,178 220,160 220,320 0,320"
                fill={activeClip.palette.mid}
                opacity="0.75"
              />
              <polygon
                points="0,236 58,194 112,218 164,182 220,215 220,320 0,320"
                fill={activeClip.palette.front}
                opacity="0.92"
              />
              <rect y="262" width="220" height="58" fill="#07060e" opacity="0.65" />
            </motion.svg>

            {/* Beat Cut Pulse Ring */}
            <motion.div
              animate={{
                opacity: isNearCut && beatSyncEnabled ? 1 : 0,
                scale: isNearCut && beatSyncEnabled ? 1 : 0.92,
              }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute inset-1.5 rounded-lg border-2 border-primary"
            />

            {/* Center Play/Pause Overlay Button */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Magnetic strength={0.2} range={60} className="pointer-events-auto">
                <RippleButton
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  aria-label={isPlaying ? "Pause preview" : "Play preview"}
                  className="flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur-md transition hover:bg-primary hover:text-primary-foreground"
                >
                  <AnimateIcon animateOnHover>
                    {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                  </AnimateIcon>
                  <RippleButtonRipples />
                </RippleButton>
              </Magnetic>
            </div>

            {/* Bottom badge inside preview */}
            <div className="absolute right-2 bottom-2 left-2 flex items-center justify-between rounded-md bg-black/65 px-2 py-1 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur-sm">
              <span>9:16 FIT</span>
              <span className="text-primary font-semibold">
                {beatSyncEnabled ? "BEAT LOCKED" : "FIXED 2.0S"}
              </span>
            </div>
          </div>

          {/* Transport Bar + Interactive Beat-Synced Timeline */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RippleButton
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="inline-flex size-6.5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  aria-label={isPlaying ? "Pause timeline" : "Play timeline"}
                >
                  {isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
                  <RippleButtonRipples />
                </RippleButton>
                <div className="font-mono text-xs tabular-nums text-foreground">
                  <span>0:</span>
                  <SlidingNumber
                    number={Math.floor(playheadSec)}
                    padStart
                  />
                  <span>.{Math.floor((playheadSec % 1) * 10)}</span>
                  <span className="text-muted-foreground"> / 0:20.0</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-foreground">
                  <Activity className="size-3 text-primary" />
                  {beatSyncEnabled ? "9/9 on beat" : "Manual timing"}
                </span>
              </div>
            </div>

            {/* Interactive Scrubbable Timeline Track */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Timeline playhead position in seconds"
              aria-valuemin={0}
              aria-valuemax={20}
              aria-valuenow={Number(playheadSec.toFixed(1))}
              onClick={handleTimelineScrub}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  setPlayheadSec((p) => Math.min(totalDuration, p + 0.5))
                } else if (e.key === "ArrowLeft") {
                  setPlayheadSec((p) => Math.max(0, p - 0.5))
                }
              }}
              className="relative cursor-pointer select-none overflow-hidden rounded-xl border border-border bg-[#0c0b12] p-1.5"
            >
              {/* Time Ruler */}
              <div className="mb-1 flex justify-between px-0.5 font-mono text-[9px] tabular-nums text-white/50">
                <span>0:00</span>
                <span>0:04</span>
                <span>0:08</span>
                <span>0:12</span>
                <span>0:16</span>
                <span>0:20</span>
              </div>

              {/* Clip Strip */}
              <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-lg">
                {clipSegments.map((seg) => {
                  const widthPct = (seg.duration / totalDuration) * 100
                  const isCurrent = activeClip.index === seg.index
                  return (
                    <motion.div
                      key={seg.index}
                      layout
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(135deg, ${seg.palette.sky}, ${seg.palette.mid})`,
                      }}
                      className={cn(
                        "relative flex flex-col justify-end overflow-hidden rounded-sm border p-1 transition-opacity",
                        isCurrent
                          ? "border-white/80 opacity-100"
                          : "border-white/15 opacity-80 hover:opacity-100"
                      )}
                    >
                      <span className="w-fit rounded bg-black/65 px-1 py-0.2 font-mono text-[9px] font-medium tabular-nums text-white">
                        {seg.duration.toFixed(1)}s
                      </span>
                    </motion.div>
                  )
                })}
              </div>

              {/* Waveform & Beat Markers Track */}
              <div className="relative mt-1 flex h-6 items-center justify-between gap-[2px] px-0.5">
                {WAVEFORM_BARS.map((amp, i) => {
                  const barTime = (i / WAVEFORM_BARS.length) * totalDuration
                  const isBeatCut = clipSegments.some(
                    (seg) => seg.start > 0 && Math.abs(seg.start - barTime) < 0.28
                  )
                  return (
                    <div
                      key={i}
                      className="relative flex h-full flex-1 items-center justify-center"
                    >
                      <motion.div
                        animate={{
                          height: `${Math.max(18, Math.round(amp * 100))}%`,
                        }}
                        className={cn(
                          "w-full rounded-full transition-colors",
                          isBeatCut && beatSyncEnabled
                            ? "bg-gradient-to-t from-[#a855f7] to-[#f43f5e]"
                            : barTime <= playheadSec
                              ? "bg-primary/65"
                              : "bg-white/25"
                        )}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Moving Playhead Line */}
              <div
                style={{ left: `${(playheadSec / totalDuration) * 100}%` }}
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
              >
                <div className="-ml-[4px] size-2.5 rounded-full bg-primary ring-2 ring-white" />
              </div>
            </div>

            {/* Bottom Editor Tool Dock matching SusuEdition */}
            <div className="flex items-center justify-center gap-1 pt-0.5">
              {[
                { label: "Media", icon: Clapperboard, active: false },
                { label: "Music", icon: Music, active: false },
                { label: "Rhythm", icon: Activity, active: true },
                { label: "Audio", icon: Volume2, active: false },
                { label: "Filters", icon: Sparkles, active: false },
                { label: "Format", icon: RectangleVertical, active: false },
              ].map((tool) => {
                const Icon = tool.icon
                return (
                  <AnimateIcon key={tool.label} animateOnHover asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (tool.label === "Filters") {
                          const order: StudioFilterId[] = [
                            "original",
                            "vivid",
                            "warm",
                            "cool",
                            "noir",
                          ]
                          const nextIdx =
                            (order.indexOf(activeFilter) + 1) % order.length
                          setActiveFilter(order[nextIdx])
                        } else {
                          setIsPlaying((p) => !p)
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors",
                        tool.active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3" />
                      <span>{tool.label}</span>
                    </button>
                  </AnimateIcon>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Rhythm & Timing Inspector Panel (5 cols) */}
        <div className="flex flex-col justify-between p-3.5 lg:col-span-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <span className="whitespace-nowrap text-xs font-semibold tracking-tight text-foreground">
                Rhythm &amp; timing
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                golden-hour.wav ·{" "}
                <SlidingNumber number={currentPreset.bpmDefault} /> BPM
              </span>
            </div>

            {/* Result Summary Box */}
            <div className="rounded-xl border border-border bg-muted/35 p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="whitespace-nowrap font-mono text-lg font-bold tabular-nums text-foreground">
                  0:20.0{" "}
                  <span className="font-sans text-xs font-normal text-muted-foreground">
                    video length
                  </span>
                </div>
                <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                  10 of 10 items
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Music section trimmed with automatic 3.0s fade-out at the end.
              </p>
            </div>

            {/* Sync to the beat Switch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Sync to the beat
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cuts land on the beats of the music. Pick how the edit follows the song.
                  </p>
                </div>
                <Switch
                  checked={beatSyncEnabled}
                  onCheckedChange={setBeatSyncEnabled}
                  aria-label="Sync to the beat"
                />
              </div>

              {/* 4 Beat Styles Grid with Animate UI Highlight */}
              <Highlight
                controlledItems
                value={preset}
                onValueChange={(v) => {
                  if (v && v in BEAT_PRESETS) {
                    setPreset(v as BeatPresetId)
                    setBeatSyncEnabled(true)
                  }
                }}
                className="inset-0 rounded-xl border border-primary/65 bg-primary/15"
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.values(BEAT_PRESETS) as BeatPresetMeta[]).map((item) => {
                    const isSelected = preset === item.id
                    return (
                      <HighlightItem
                        key={item.id}
                        value={item.id}
                        className="flex h-full w-full rounded-xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPreset(item.id)
                            setBeatSyncEnabled(true)
                          }}
                          className={cn(
                            "relative z-10 flex h-full w-full flex-col items-start rounded-xl border p-2 text-left transition-colors",
                            isSelected
                              ? "border-transparent text-foreground"
                              : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">
                              {item.label}
                            </span>
                            <ZapIcon
                              size={12}
                              className={cn(
                                isSelected ? "text-primary" : "text-muted-foreground"
                              )}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                            {item.summary}
                          </p>
                        </button>
                      </HighlightItem>
                    )
                  })}
                </div>
              </Highlight>
            </div>

            {/* Flexibility Slider */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Flexibility</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  <SlidingNumber number={flexibility} />%
                </span>
              </div>
              <Slider
                value={[flexibility]}
                min={10}
                max={100}
                step={5}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val
                  if (typeof next === "number") setFlexibility(next)
                }}
                aria-label="Beat sync flexibility percentage"
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                How much each clip duration may expand or contract to lock onto a strong beat.
              </p>
            </div>
          </div>

          {/* Bottom Live Telemetry Readout */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Activity className="size-3.5 text-primary" />
              {beatSyncEnabled
                ? `9 of 9 cuts on the beat · ${currentPreset.bpmDefault} BPM`
                : "Fixed duration · 2.0s per photo"}
            </span>
            <span className="rounded bg-[#24c8db]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#24c8db]">
              Symphonia DSP
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
