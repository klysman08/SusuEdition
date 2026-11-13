import { AnimateIcon } from "@animate-ui/react/icons";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { useStore } from "zustand";

import type { AnimatedIcon } from "@/app/navigation";
import { Activity } from "@/components/animate-ui/icons/activity";
import { ArrowLeft } from "@/components/animate-ui/icons/arrow-left";
import { Download } from "@/components/animate-ui/icons/download";
import { Image } from "@/components/animate-ui/icons/image";
import { Music } from "@/components/animate-ui/icons/music";
import { RectangleVertical } from "@/components/animate-ui/icons/rectangle-vertical";
import { Redo2 } from "@/components/animate-ui/icons/redo-2";
import { Save } from "@/components/animate-ui/icons/save";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { Undo2 } from "@/components/animate-ui/icons/undo-2";
import { Volume2 } from "@/components/animate-ui/icons/volume-2";
import { X } from "@/components/animate-ui/icons/x";
import { WindowControls } from "@/components/common/WindowControls";
import { Button } from "@/components/ui/button";
import { MediaLibrary } from "@/features/media-library";
import { MusicPanel } from "@/features/music";
import { formatTime } from "@/lib/format";
import { ScrollContainerContext } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { dragRegion } from "@/platform/window";

import { AudioPanel } from "./components/AudioPanel";
import { CropDialog } from "./components/CropDialog";
import { FiltersPanel } from "./components/FiltersPanel";
import { FormatPanel } from "./components/FormatPanel";
import { ItemSheet } from "./components/ItemSheet";
import { TimingPanel } from "./components/TimingPanel";
import { TrimDialog } from "./components/TrimDialog";
import { splitClipAt } from "./clip-actions";
import { ExportPanel } from "./export/ExportPanel";
import { historyStore, redo, undo } from "./history";
import { useProject, useVideoTimeline } from "./hooks";
import { PreviewStage, TimelineDock } from "./preview/PreviewStage";
import { usePreviewPlayer } from "./preview/use-preview-player";
import { projectSession, saveNow } from "./project-session";
import { ProjectList } from "./projects/ProjectList";
import { ProjectMenu } from "./projects/ProjectMenu";
import { videoMediaStore, videoMusicStore, videoProjectStore } from "./store";

type ToolId = "media" | "music" | "timing" | "audio" | "filters" | "format" | "export";

/** Ferramentas da barra inferior ("export" fica no topo, como botão principal). */
const TOOLS: { id: Exclude<ToolId, "export">; icon: AnimatedIcon }[] = [
  { id: "media", icon: Image },
  { id: "music", icon: Music },
  { id: "timing", icon: Activity },
  { id: "audio", icon: Volume2 },
  { id: "filters", icon: Sparkles },
  { id: "format", icon: RectangleVertical },
];

/** Onde o usuário está digitando (ou num diálogo): atalhos de uma tecla não valem. */
const TYPING = "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]";

/** Elementos em que a barra de espaço já tem função própria. */
const SPACE_OWNERS =
  "input, textarea, select, button, a, [role=slider], [role=radio], [role=switch], [role=dialog], [role=menu], [contenteditable=true]";

const isWideScreen = () => typeof matchMedia === "function" && matchMedia("(min-width: 1024px)").matches;

/**
 * Barra do editor. No Windows ela também é a alça da janela (o espaço vazio arrasta,
 * duplo clique maximiza) e termina nos controles da janela.
 */
function TopBar({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const drag = dragRegion();
  return (
    <header {...drag} className="flex shrink-0 border-b bg-card pt-safe">
      <div {...drag} className="flex h-12 min-w-0 flex-1 items-center gap-1 pr-2 pl-1 sm:gap-1.5 sm:pr-3 md:pl-3">
        <AnimateIcon animateOnHover asChild>
          <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link to="/" aria-label={t("videoMaker.exit")}>
              <ArrowLeft />
            </Link>
          </Button>
        </AnimateIcon>
        {children}
      </div>
      <WindowControls className="h-12 border-l border-border/60" />
    </header>
  );
}

/** Projeto vazio: o convite para adicionar mídias e os projetos salvos para continuar. */
function StartScreen() {
  const { t } = useTranslation();
  const loading = useStore(projectSession, (s) => s.status === "loading");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar>
        <h1 {...dragRegion()} className="truncate pl-2 text-sm font-semibold tracking-tight">
          {t("videoMaker.title")}
        </h1>
        <span {...dragRegion()} className="h-full flex-1" />
      </TopBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 md:py-10">
          {loading ? (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground"
            >
              <Loader2 className="size-6 animate-spin" aria-hidden />
              {t("projects.loading")}
            </div>
          ) : (
            <>
              <MediaLibrary store={videoMediaStore} />
              <section aria-labelledby="recent-projects" className="empty:hidden">
                <ProjectList
                  limit={6}
                  className="mt-3"
                  header={
                    <h2 id="recent-projects" className="text-base font-semibold">
                      {t("projects.continue")}
                    </h2>
                  }
                />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Editor: prévia sempre visível no centro, faixa do tempo (mídias + áudio) logo abaixo
 * e uma barra fixa de ferramentas no rodapé. A ferramenta aberta aparece ao lado da
 * prévia (telas largas) ou numa gaveta baixa entre a faixa e a barra (celular) — no
 * celular nenhuma ferramenta abre sozinha, para a prévia ficar com a tela.
 */
function Editor() {
  const { t } = useTranslation();
  const [tool, setTool] = useState<ToolId | null>(() => (isWideScreen() ? "media" : null));
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [trimItem, setTrimItem] = useState<string | null>(null);
  const [cropItem, setCropItem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const timeline = useVideoTimeline();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const preview = usePreviewPlayer(timeline, canvasRef, boxRef);
  const aspect = useProject((s) => s.aspect);
  const hasMusic = useStore(videoMusicStore, (s) => s.track !== null);
  const hasFilter = useProject(
    (s) => s.filter.preset !== "none" || Object.values(s.filter.adjust).some((v) => v !== 0),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const { player } = preview;
  // A mídia selecionada some da seleção se sair do vídeo (removida ou sem tempo).
  const selectedId = picked && timeline.segments.some((s) => s.mediaId === picked) ? picked : null;

  const canUndo = useStore(historyStore, (s) => s.canUndo);
  const canRedo = useStore(historyStore, (s) => s.canRedo);
  const saveStatus = useStore(projectSession, (s) => s.status);
  const timelineRef = useRef(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  /** Salvar à mão: grava agora o que o salvamento automático ainda não gravou. */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveNow();
      if (projectSession.getState().status === "error") toast.error(t("projects.saveError"));
      else toast.success(t("projects.savedNow"), { id: "project-saved", duration: 1800 });
    } finally {
      setSaving(false);
    }
  }, [t]);

  // Atalhos do editor: Espaço toca/pausa, Ctrl+S salva, Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y)
  // desfaz/refaz, S divide a mídia no cursor, M põe/tira um marcador na música, Esc sai
  // da prévia ampliada.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest(TYPING) !== null;
      if (e.key === "Escape" && focus && !(e.target instanceof Element && e.target.closest("[role=dialog]"))) {
        setFocus(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!e.repeat) void save();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !typing) {
        const key = e.key.toLowerCase();
        if (key === "z" || key === "y") {
          e.preventDefault();
          void (key === "y" || e.shiftKey ? redo() : undo());
        }
        return;
      }
      if (!typing && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && player) {
        const key = e.key.toLowerCase();
        const now = timelineRef.current;
        if (key === "s") {
          e.preventDefault();
          const id = splitClipAt(now, player.state.timeSec);
          if (id) setPicked(id);
          return;
        }
        if (key === "m" && now.audio) {
          e.preventDefault();
          videoProjectStore.getState().toggleMarker(now.audio.musicInSec + player.state.timeSec);
          return;
        }
      }
      if (e.code !== "Space" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(SPACE_OWNERS)) return;
      e.preventDefault();
      player?.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, focus, save]);

  // Sair do editor grava o que estiver pendente.
  useEffect(() => () => void saveNow(), []);

  const openTrim = useCallback(
    (id: string) => {
      player?.pause();
      setOpenItem(null);
      setTrimItem(id);
    },
    [player],
  );
  const openCrop = useCallback(
    (id: string) => {
      player?.pause();
      setOpenItem(null);
      setCropItem(id);
    },
    [player],
  );
  const openSettings = useCallback(
    (id: string) => {
      player?.pause();
      setOpenItem(id);
    },
    [player],
  );
  /** Duplo toque numa mídia da faixa: vídeos abrem o recorte; fotos, os ajustes. */
  const openFromTimeline = useCallback(
    (id: string) => {
      if (videoMediaStore.getState().items[id]?.kind === "video") openTrim(id);
      else openSettings(id);
    },
    [openTrim, openSettings],
  );

  const panels: Record<ToolId, ReactNode> = {
    media: <MediaLibrary store={videoMediaStore} onOpenItem={openSettings} embedded />,
    music: <MusicPanel store={videoMusicStore} />,
    timing: <TimingPanel timeline={timeline} onGoToMusic={() => setTool("music")} />,
    audio: <AudioPanel />,
    filters: <FiltersPanel />,
    format: <FormatPanel />,
    export: <ExportPanel timeline={timeline} />,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!focus && (
        <TopBar>
          <ProjectMenu />
          <p className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums max-sm:hidden">
            {formatTime(timeline.durationSec, false)} · {aspect}
          </p>
          <span {...dragRegion()} className="h-full flex-1" />
          <AnimateIcon animateOnHover asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={saving}
              aria-label={t("projects.save")}
              title={`${t("projects.save")} (Ctrl+S)`}
              onClick={() => void save()}
              className="relative"
            >
              {saving || saveStatus === "saving" ? <Loader2 className="animate-spin" /> : <Save />}
              {/* No celular o estado do salvamento automático aparece aqui (o texto fica só em telas largas). */}
              {(saveStatus === "saved" || saveStatus === "error") && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0.5 right-0.5 size-1.5 rounded-full md:hidden",
                    saveStatus === "error" ? "bg-destructive" : "bg-emerald-500",
                  )}
                />
              )}
            </Button>
          </AnimateIcon>
          <AnimateIcon animateOnHover asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canUndo}
              aria-label={t("videoMaker.undo")}
              title={`${t("videoMaker.undo")} (Ctrl+Z)`}
              onClick={() => void undo()}
            >
              <Undo2 />
            </Button>
          </AnimateIcon>
          <AnimateIcon animateOnHover asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canRedo}
              aria-label={t("videoMaker.redo")}
              title={`${t("videoMaker.redo")} (Ctrl+Shift+Z)`}
              onClick={() => void redo()}
              className="mr-1"
            >
              <Redo2 />
            </Button>
          </AnimateIcon>
          <AnimateIcon animateOnHover asChild>
            <Button
              size="sm"
              variant={tool === "export" ? "secondary" : "default"}
              aria-pressed={tool === "export"}
              onClick={() => setTool((cur) => (cur === "export" ? null : "export"))}
            >
              <Download />
              {t("videoMaker.tools.export")}
            </Button>
          </AnimateIcon>
        </TopBar>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <PreviewStage
            preview={preview}
            canvasRef={canvasRef}
            boxRef={boxRef}
            focus={focus}
            onToggleFocus={() => setFocus((f) => !f)}
          />
          <TimelineDock
            preview={preview}
            timeline={timeline}
            selectedId={selectedId}
            onSelect={setPicked}
            onOpenItem={openFromTimeline}
            onTrim={openTrim}
            onCrop={openCrop}
            onAdjust={openSettings}
            onOpenMusic={() => {
              setFocus(false);
              setTool("music");
            }}
          />
        </div>

        {tool && !focus && (
          <aside
            aria-label={t(`videoMaker.toolTitles.${tool}`)}
            className="flex max-h-[38dvh] min-h-0 shrink flex-col border-t bg-background lg:max-h-none lg:w-[380px] lg:shrink-0 lg:border-t-0 lg:border-l xl:w-[420px]"
          >
            <button
              type="button"
              aria-label={t("videoMaker.closePanel")}
              onClick={() => setTool(null)}
              className="flex h-5 shrink-0 items-center justify-center outline-none focus-visible:bg-accent lg:hidden"
            >
              <span className="h-1 w-9 rounded-full bg-border" />
            </button>
            <header className="hidden h-11 shrink-0 items-center justify-between border-b pr-2 pl-4 lg:flex">
              <h2 className="text-sm font-semibold">{t(`videoMaker.toolTitles.${tool}`)}</h2>
              <AnimateIcon animateOnHover asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("videoMaker.closePanel")}
                  onClick={() => setTool(null)}
                >
                  <X />
                </Button>
              </AnimateIcon>
            </header>
            <ScrollContainerContext value={panelRef}>
              <div
                key={tool}
                ref={panelRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4 sm:pb-4 lg:pt-4"
              >
                {panels[tool]}
              </div>
            </ScrollContainerContext>
          </aside>
        )}
      </div>

      {!focus && (
        <nav aria-label={t("videoMaker.toolbar")} className="shrink-0 border-t bg-card pb-safe">
          <ul className="mx-auto flex max-w-2xl items-stretch px-1 sm:justify-center sm:gap-2">
            {TOOLS.map(({ id, icon: Icon }) => {
              const active = tool === id;
              const dot = (id === "music" && hasMusic) || (id === "filters" && hasFilter);
              return (
                <li key={id} className="min-w-0 flex-1 sm:w-20 sm:flex-none">
                  <AnimateIcon animateOnHover animateOnTap asChild>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTool(active ? null : id)}
                      className="group flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-foreground sm:h-15 sm:gap-1"
                    >
                      <span
                        className={cn(
                          "relative flex h-6 w-10 items-center justify-center rounded-full transition-colors sm:h-7 sm:w-12",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground group-hover:bg-accent-foreground/15",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        {dot && !active && (
                          <span className="absolute top-0.5 right-1.5 size-1.5 rounded-full bg-primary" />
                        )}
                      </span>
                      <span className="max-w-full truncate px-0.5">{t(`videoMaker.tools.${id}`)}</span>
                    </button>
                  </AnimateIcon>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <ItemSheet
        id={openItem}
        timeline={timeline}
        onClose={() => setOpenItem(null)}
        onTrim={openTrim}
        onCrop={openCrop}
        onRelinked={setOpenItem}
      />
      <CropDialog id={cropItem} onClose={() => setCropItem(null)} />
      <TrimDialog id={trimItem} timeline={timeline} onClose={() => setTrimItem(null)} />
    </div>
  );
}

export function VideoMakerPage() {
  const hasMedia = useStore(videoMediaStore, (s) => s.order.length > 0);
  return hasMedia ? <Editor /> : <StartScreen />;
}
