import {
  Activity,
  ArrowLeft,
  Clock,
  Download,
  Images,
  Music,
  RectangleVertical,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { MediaLibrary } from "@/features/media-library";
import { MusicPanel } from "@/features/music";
import { formatTime } from "@/lib/format";
import { ScrollContainerContext } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";

import { AudioPanel } from "./components/AudioPanel";
import { FormatPanel } from "./components/FormatPanel";
import { ItemSheet } from "./components/ItemSheet";
import { SyncPanel } from "./components/SyncPanel";
import { TimingPanel } from "./components/TimingPanel";
import { ExportPanel } from "./export/ExportPanel";
import { useProject, useVideoTimeline } from "./hooks";
import { PreviewStage, TimelineDock } from "./preview/PreviewStage";
import { usePreviewPlayer } from "./preview/use-preview-player";
import { videoMediaStore, videoMusicStore } from "./store";

type ToolId = "media" | "music" | "timing" | "sync" | "audio" | "format" | "export";

/** Ferramentas da barra inferior ("export" fica no topo, como botão principal). */
const TOOLS: { id: Exclude<ToolId, "export">; icon: LucideIcon }[] = [
  { id: "media", icon: Images },
  { id: "music", icon: Music },
  { id: "sync", icon: Activity },
  { id: "timing", icon: Clock },
  { id: "audio", icon: Volume2 },
  { id: "format", icon: RectangleVertical },
];

/** Elementos em que a barra de espaço já tem função própria. */
const SPACE_OWNERS =
  "input, textarea, select, button, a, [role=slider], [role=radio], [role=switch], [role=dialog], [role=menu], [contenteditable=true]";

function TopBar({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <header className="shrink-0 border-b bg-card pt-safe">
      <div className="flex h-12 items-center gap-2 pr-3 pl-1 md:pl-4">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
          <Link to="/" aria-label={t("videoMaker.exit")}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="truncate text-sm font-semibold tracking-tight">{t("videoMaker.title")}</h1>
        {children}
      </div>
    </header>
  );
}

/** Projeto vazio: só o convite para adicionar mídias. */
function StartScreen() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-12">
          <MediaLibrary store={videoMediaStore} />
        </div>
      </div>
    </div>
  );
}

/**
 * Editor: prévia sempre visível no centro, faixa das mídias logo abaixo e uma barra
 * fixa de ferramentas no rodapé. A ferramenta aberta aparece ao lado da prévia
 * (telas largas) ou entre a faixa e a barra (celular).
 */
function Editor() {
  const { t } = useTranslation();
  const [tool, setTool] = useState<ToolId | null>("media");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const timeline = useVideoTimeline();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const preview = usePreviewPlayer(timeline, canvasRef, boxRef);
  const aspect = useProject((s) => s.aspect);
  const hasMusic = useStore(videoMusicStore, (s) => s.track !== null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { player } = preview;

  // Espaço = tocar/pausar, de qualquer lugar do editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(SPACE_OWNERS)) return;
      e.preventDefault();
      player?.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);

  const panels: Record<ToolId, ReactNode> = {
    media: <MediaLibrary store={videoMediaStore} onOpenItem={setOpenItem} embedded />,
    music: <MusicPanel store={videoMusicStore} />,
    sync: <SyncPanel timeline={timeline} onGoToMusic={() => setTool("music")} />,
    timing: <TimingPanel timeline={timeline} />,
    audio: <AudioPanel />,
    format: <FormatPanel />,
    export: <ExportPanel timeline={timeline} />,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar>
        <p className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
          {formatTime(timeline.durationSec, false)} · {aspect}
        </p>
        <span className="flex-1" />
        <Button
          size="sm"
          variant={tool === "export" ? "secondary" : "default"}
          aria-pressed={tool === "export"}
          onClick={() => setTool((cur) => (cur === "export" ? null : "export"))}
        >
          <Download />
          {t("videoMaker.tools.export")}
        </Button>
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PreviewStage preview={preview} canvasRef={canvasRef} boxRef={boxRef} />
          <TimelineDock preview={preview} timeline={timeline} onOpenItem={setOpenItem} />
        </div>

        {tool && (
          <aside
            aria-label={t(`videoMaker.tools.${tool}`)}
            className="flex max-h-[42dvh] min-h-0 shrink-0 flex-col border-t bg-background lg:max-h-none lg:w-[380px] lg:border-t-0 lg:border-l xl:w-[420px]"
          >
            <header className="hidden h-11 shrink-0 items-center justify-between border-b pr-2 pl-4 lg:flex">
              <h2 className="text-sm font-semibold">{t(`videoMaker.tools.${tool}`)}</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("videoMaker.closePanel")}
                onClick={() => setTool(null)}
              >
                <X />
              </Button>
            </header>
            <ScrollContainerContext value={panelRef}>
              <div key={tool} ref={panelRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {panels[tool]}
              </div>
            </ScrollContainerContext>
          </aside>
        )}
      </div>

      <nav aria-label={t("videoMaker.toolbar")} className="shrink-0 border-t bg-card pb-safe">
        <ul className="mx-auto flex max-w-2xl items-stretch px-1 sm:justify-center sm:gap-2">
          {TOOLS.map(({ id, icon: Icon }) => {
            const active = tool === id;
            const dot = id === "music" && hasMusic;
            return (
              <li key={id} className="min-w-0 flex-1 sm:w-20 sm:flex-none">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTool(active ? null : id)}
                  className="group flex h-15 w-full flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-foreground"
                >
                  <span
                    className={cn(
                      "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground group-hover:bg-accent-foreground/15",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {dot && !active && <span className="absolute top-0.5 right-1.5 size-1.5 rounded-full bg-primary" />}
                  </span>
                  <span className="max-w-full truncate px-0.5">{t(`videoMaker.tools.${id}`)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <ItemSheet id={openItem} timeline={timeline} onClose={() => setOpenItem(null)} />
    </div>
  );
}

export function VideoMakerPage() {
  const hasMedia = useStore(videoMediaStore, (s) => s.order.length > 0);
  return hasMedia ? <Editor /> : <StartScreen />;
}
