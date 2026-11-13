import * as React from "react"
import { motion } from "motion/react"
import { AnimateIcon } from "@animate-ui/react/icons"
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight"
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number"
import { RippleButton, RippleButtonRipples } from "@animate-ui/react/primitives/buttons/ripple"

import { RefreshCw } from "@/components/animate-ui/icons/refresh-cw"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type AspectId = "4:5" | "1:1" | "9:16" | "16:9" | "4:3" | "3:4"
type CollageLayoutId = "justified" | "spotlight" | "mosaic" | "grid"

const ASPECT_OPTIONS: { id: AspectId; label: string; sub: string; ratioClass: string }[] = [
  { id: "4:5", label: "4:5", sub: "Feed", ratioClass: "aspect-[4/5] max-w-[340px]" },
  { id: "1:1", label: "1:1", sub: "Square", ratioClass: "aspect-square max-w-[360px]" },
  { id: "9:16", label: "9:16", sub: "Stories", ratioClass: "aspect-[9/16] max-w-[260px]" },
  { id: "16:9", label: "16:9", sub: "YouTube", ratioClass: "aspect-[16/9] max-w-[460px]" },
  { id: "4:3", label: "4:3", sub: "Classic", ratioClass: "aspect-[4/3] max-w-[420px]" },
  { id: "3:4", label: "3:4", sub: "Portrait", ratioClass: "aspect-[3/4] max-w-[340px]" },
]

const LAYOUT_OPTIONS: { id: CollageLayoutId; label: string; desc: string }[] = [
  {
    id: "justified",
    label: "Auto Justified",
    desc: "Preserves photo proportions with minimal cropping.",
  },
  {
    id: "spotlight",
    label: "Spotlight Lead",
    desc: "Hero shot spanning top row with supporting frames.",
  },
  {
    id: "mosaic",
    label: "Editorial Mosaic",
    desc: "Alternating wide and portrait cells across 3 rows.",
  },
  {
    id: "grid",
    label: "Classic 2×3",
    desc: "Balanced six-cell studio contact sheet.",
  },
]

const INITIAL_CELLS = [
  { id: "c1", title: "Amber Ridge", sky: "#7c2d12", mid: "#ea580c", front: "#431407", sun: "#fde047" },
  { id: "c2", title: "Nordic Fjord", sky: "#134e4a", mid: "#0d9488", front: "#042f2e", sun: "#ccfbf1" },
  { id: "c3", title: "Alpine Pine", sky: "#14532d", mid: "#16a34a", front: "#052e16", sun: "#dcfce7" },
  { id: "c4", title: "Violet Dusk", sky: "#581c87", mid: "#9333ea", front: "#2e1065", sun: "#f3e8ff" },
  { id: "c5", title: "Crimson Peak", sky: "#881337", mid: "#e11d48", front: "#4c0519", sun: "#ffe4e6" },
  { id: "c6", title: "Sunset Valley", sky: "#78350f", mid: "#d97706", front: "#451a03", sun: "#fef9c3" },
]

function getCellSpanClass(layout: CollageLayoutId, index: number): string {
  if (layout === "justified") {
    if (index === 0) return "col-span-7 row-span-2"
    if (index === 1) return "col-span-5 row-span-2"
    if (index === 2) return "col-span-5 row-span-2"
    if (index === 3) return "col-span-7 row-span-2"
    if (index === 4) return "col-span-6 row-span-2"
    return "col-span-6 row-span-2"
  }
  if (layout === "spotlight") {
    if (index === 0) return "col-span-12 row-span-3"
    if (index === 1) return "col-span-4 row-span-2"
    if (index === 2) return "col-span-4 row-span-2"
    if (index === 3) return "col-span-4 row-span-2"
    if (index === 4) return "col-span-6 row-span-1"
    return "col-span-6 row-span-1"
  }
  if (layout === "mosaic") {
    if (index === 0) return "col-span-8 row-span-2"
    if (index === 1) return "col-span-4 row-span-2"
    if (index === 2) return "col-span-4 row-span-2"
    if (index === 3) return "col-span-4 row-span-2"
    if (index === 4) return "col-span-4 row-span-2"
    return "col-span-12 row-span-2"
  }
  return "col-span-6 row-span-2"
}

export function CollageStudioLab() {
  const [aspect, setAspect] = React.useState<AspectId>("4:5")
  const [layout, setLayout] = React.useState<CollageLayoutId>("justified")
  const [outerMargin, setOuterMargin] = React.useState(8)
  const [innerGap, setInnerGap] = React.useState(6)
  const [cornerRadius, setCornerRadius] = React.useState(12)
  const [cells, setCells] = React.useState(INITIAL_CELLS)
  const [selectedCellId, setSelectedCellId] = React.useState<string | null>(null)

  const currentAspect =
    ASPECT_OPTIONS.find((a) => a.id === aspect) ?? ASPECT_OPTIONS[0]

  const handleCellClick = (id: string) => {
    if (!selectedCellId) {
      setSelectedCellId(id)
      return
    }
    if (selectedCellId === id) {
      setSelectedCellId(null)
      return
    }
    setCells((prev) => {
      const next = [...prev]
      const i1 = next.findIndex((c) => c.id === selectedCellId)
      const i2 = next.findIndex((c) => c.id === id)
      if (i1 !== -1 && i2 !== -1) {
        const temp = next[i1]
        next[i1] = next[i2]
        next[i2] = temp
      }
      return next
    })
    setSelectedCellId(null)
  }

  const shuffleCells = () => {
    setCells((prev) => {
      const copy = [...prev]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = (i + 2) % copy.length
        const tmp = copy[i]
        copy[i] = copy[j]
        copy[j] = tmp
      }
      return copy
    })
    setSelectedCellId(null)
  }

  return (
    <div className="grid grid-cols-1 gap-8 border-y border-border py-8 lg:grid-cols-12 lg:items-center">
      {/* Left Interactive Controls (6 cols) */}
      <div className="space-y-6 lg:col-span-6">
        {/* Aspect Ratio Selector */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              1. Aspect ratio
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              Up to 4096 px export
            </span>
          </div>

          <Highlight
            controlledItems
            value={aspect}
            onValueChange={(v) => {
              if (v && ASPECT_OPTIONS.some((a) => a.id === v)) {
                setAspect(v as AspectId)
              }
            }}
            className="inset-0 rounded-xl border border-primary/50 bg-primary/10"
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ASPECT_OPTIONS.map((item) => {
                const isSelected = aspect === item.id
                return (
                  <HighlightItem
                    key={item.id}
                    value={item.id}
                    className="flex h-full w-full rounded-xl"
                  >
                    <button
                      type="button"
                      onClick={() => setAspect(item.id)}
                      className={cn(
                        "relative z-10 flex h-full w-full flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center transition-colors",
                        isSelected
                          ? "border-transparent text-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">
                        {item.sub}
                      </span>
                    </button>
                  </HighlightItem>
                )
              })}
            </div>
          </Highlight>
        </div>

        {/* Layout Template Selector */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              2. Smart layout template
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LayoutDashboard className="size-3.5 text-primary" />6 photos loaded
            </span>
          </div>

          <Highlight
            controlledItems
            value={layout}
            onValueChange={(v) => {
              if (v && LAYOUT_OPTIONS.some((l) => l.id === v)) {
                setLayout(v as CollageLayoutId)
              }
            }}
            className="inset-0 rounded-xl border border-primary/50 bg-primary/10"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LAYOUT_OPTIONS.map((item) => {
                const isSelected = layout === item.id
                return (
                  <HighlightItem
                    key={item.id}
                    value={item.id}
                    className="flex h-full w-full rounded-xl"
                  >
                    <button
                      type="button"
                      onClick={() => setLayout(item.id)}
                      className={cn(
                        "relative z-10 flex h-full w-full flex-col items-start rounded-xl border p-3 text-left transition-colors",
                        isSelected
                          ? "border-transparent text-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {item.desc}
                      </span>
                    </button>
                  </HighlightItem>
                )
              })}
            </div>
          </Highlight>
        </div>

        {/* Margins, Gap & Corner Radius Sliders */}
        <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Outer margin</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                <SlidingNumber number={outerMargin} /> px
              </span>
            </div>
            <Slider
              value={[outerMargin]}
              min={0}
              max={28}
              step={2}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? val[0] : val
                if (typeof next === "number") setOuterMargin(next)
              }}
              aria-label="Outer margin in pixels"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Inner gap</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                <SlidingNumber number={innerGap} /> px
              </span>
            </div>
            <Slider
              value={[innerGap]}
              min={0}
              max={20}
              step={2}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? val[0] : val
                if (typeof next === "number") setInnerGap(next)
              }}
              aria-label="Inner gap in pixels"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Corner radius</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                <SlidingNumber number={cornerRadius} /> px
              </span>
            </div>
            <Slider
              value={[cornerRadius]}
              min={0}
              max={28}
              step={2}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? val[0] : val
                if (typeof next === "number") setCornerRadius(next)
              }}
              aria-label="Corner radius in pixels"
            />
          </div>
        </div>

        {/* Cell Swap Instruction + Shuffle Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">
            {selectedCellId
              ? "Click a second photo cell to swap positions."
              : "Click any two photos in the preview to swap their cells."}
          </span>
          <AnimateIcon animateOnHover asChild>
            <RippleButton
              type="button"
              onClick={shuffleCells}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <RefreshCw className="size-3.5 text-primary" />
              <span>Reorder photos</span>
              <RippleButtonRipples />
            </RippleButton>
          </AnimateIcon>
        </div>
      </div>

      {/* Right Live Collage Preview Canvas (6 cols) */}
      <div className="flex flex-col items-center justify-center lg:col-span-6">
        <motion.div
          layout
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          style={{
            padding: `${outerMargin}px`,
            gap: `${innerGap}px`,
          }}
          className={cn(
            "studio-elevation grid w-full grid-cols-12 grid-rows-6 overflow-hidden rounded-2xl border border-border bg-[#0b0a12]",
            currentAspect.ratioClass
          )}
        >
          {cells.map((cell, idx) => {
            const isSelected = selectedCellId === cell.id
            return (
              <motion.button
                key={cell.id}
                layout
                type="button"
                onClick={() => handleCellClick(cell.id)}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  borderRadius: `${cornerRadius}px`,
                  background: `linear-gradient(155deg, ${cell.sky} 0%, ${cell.mid} 60%, ${cell.front} 100%)`,
                }}
                className={cn(
                  "group relative overflow-hidden text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary",
                  getCellSpanClass(layout, idx),
                  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-[#0b0a12]"
                )}
                aria-label={`Collage photo ${cell.title} — click to swap`}
              >
                <svg
                  viewBox="0 0 200 160"
                  preserveAspectRatio="xMidYMid slice"
                  className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                >
                  <circle
                    cx={60 + (idx % 3) * 35}
                    cy={58}
                    r="18"
                    fill={cell.sun}
                    opacity="0.88"
                  />
                  <polygon
                    points="0,115 45,78 95,102 145,68 200,98 200,160 0,160"
                    fill={cell.mid}
                    opacity="0.72"
                  />
                  <polygon
                    points="0,132 62,98 118,124 168,94 200,118 200,160 0,160"
                    fill={cell.front}
                    opacity="0.92"
                  />
                </svg>
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-xs">
                  {cell.title}
                </span>
              </motion.button>
            )
          })}
        </motion.div>

        <div className="mt-3 flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          <span>
            {currentAspect.label} ({currentAspect.sub}) · Margin {outerMargin}px · Gap{" "}
            {innerGap}px · Radius {cornerRadius}px
          </span>
        </div>
      </div>
    </div>
  )
}
