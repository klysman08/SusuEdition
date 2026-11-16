/**
 * Aplicar um template: num vídeo novo (o editor abre vazio, já configurado, esperando
 * as mídias) ou no projeto que está aberto.
 */
import type { AspectRatio } from "@/engine/types";
import { resetHistory, withoutHistory } from "@/features/video-maker/history";
import { newProject } from "@/features/video-maker/project-session";
import { DEFAULT_VIDEO_PROJECT, pickSettings } from "@/features/video-maker/project-store";
import { videoProjectStore } from "@/features/video-maker/store";

import { templateSettings, type VideoTemplate } from "./catalog";

/**
 * Começa um vídeo novo com o template. O projeto aberto é salvo antes; o novo nasce
 * quando a primeira mídia entra, e a edição do template vale para tudo o que for adicionado.
 */
export async function createFromTemplate(template: VideoTemplate, aspect?: AspectRatio): Promise<void> {
  await newProject();
  await withoutHistory(async () => {
    videoProjectStore.getState().hydrate(templateSettings(template, DEFAULT_VIDEO_PROJECT, aspect));
  });
  resetHistory();
}

/**
 * Aplica o template ao projeto aberto, mantendo mídias, música, cortes manuais e ajustes
 * por mídia. É uma edição como outra qualquer: Ctrl+Z desfaz.
 */
export function applyToCurrentProject(template: VideoTemplate, aspect?: AspectRatio): void {
  const store = videoProjectStore.getState();
  store.replaceSettings(templateSettings(template, pickSettings(store), aspect ?? store.aspect));
}

/** Tira a marca do template (os ajustes ficam como estão). */
export function forgetTemplate(): void {
  videoProjectStore.getState().replaceSettings({ templateId: null });
}

/** Volta os ajustes ao padrão do app — usado quando o projeto ainda está vazio. */
export async function clearTemplate(): Promise<void> {
  await withoutHistory(async () => videoProjectStore.getState().reset());
  resetHistory();
}
