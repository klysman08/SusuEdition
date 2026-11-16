/**
 * Templates de edição: receitas prontas que configuram o Video Maker inteiro — ritmo
 * dos cortes, transições, movimento, filtro, efeitos e sons.
 *
 * Um template é só um conjunto de ajustes do projeto: nada fica "colado" nas mídias.
 * Por isso ele vale para qualquer quantidade de fotos e vídeos, continua valendo quando
 * você adiciona ou reordena mídias, e tudo pode ser mudado depois no editor.
 */
import { DEFAULT_AUDIO_MIX, type AudioMix } from "@/engine/audio";
import { DEFAULT_VIDEO_EFFECTS, type VideoEffects } from "@/engine/render/effects";
import { NEUTRAL_ADJUST, type FilterAdjust, type FilterPresetId } from "@/engine/render/filters";
import { DEFAULT_TIMELINE_SETTINGS, type TimelineSettings } from "@/engine/timeline";
import type { AspectRatio, FitBackground, FitMode } from "@/engine/types";
import type { VideoProjectSettings } from "@/features/video-maker/project-store";

export const TEMPLATE_IDS = [
  "cinematicBeat",
  "frameShift",
  "grid",
  "velocity",
  "glitch",
  "photoShoot",
  "memories",
  "vintage",
  "travel",
  "recap",
  "noir",
  "party",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** O que o template destaca (vira etiqueta no cartão e filtro da galeria). */
export type TemplateTag = "beat" | "fast" | "calm" | "sound" | "photos";

export interface VideoTemplate {
  id: TemplateId;
  /** Proporção sugerida (dá para trocar ao aplicar). */
  aspect: AspectRatio;
  fit: FitMode;
  background?: FitBackground;
  timeline: Partial<TimelineSettings>;
  filter?: { preset: FilterPresetId; intensity?: number; adjust?: Partial<FilterAdjust> };
  effects?: Partial<VideoEffects>;
  mix?: Partial<AudioMix>;
  tags: readonly TemplateTag[];
}

const BLUR: FitBackground = { kind: "blur", strength: 1 };

export const TEMPLATES: Record<TemplateId, VideoTemplate> = {
  /** Cortes nas batidas fortes, zoom de impacto, clarões e barras de cinema. */
  cinematicBeat: {
    id: "cinematicBeat",
    aspect: "9:16",
    fit: "cover",
    timeline: {
      photoDurationSec: 1.2,
      videoDurationSec: 2.4,
      overflow: "fit",
      beatSync: { enabled: true, preset: "accents", flexibility: 0.8 },
      transition: { kind: "mix", kinds: ["cut", "flash", "cut", "punch"], durationSec: 0.35 },
      photoMotion: "auto",
      motionSet: ["punch", "zoomIn", "punch", "zoomOut"],
      motionOnVideos: true,
    },
    filter: { preset: "dramatic", intensity: 0.8 },
    effects: { letterbox: 0.09, beatPulse: 0.6 },
    tags: ["beat", "fast"],
  },

  /** Colunas e fatias do quadro deslizam em sentidos alternados a cada compasso. */
  frameShift: {
    id: "frameShift",
    aspect: "9:16",
    fit: "cover",
    timeline: {
      photoDurationSec: 1.5,
      videoDurationSec: 2.6,
      overflow: "fit",
      beatSync: { enabled: true, preset: "bars", flexibility: 0.6 },
      transition: { kind: "mix", kinds: ["frameShift", "slices"], durationSec: 0.6 },
      transitionSound: "auto",
      photoMotion: "auto",
      motionSet: ["zoomIn", "zoomOut"],
    },
    filter: { preset: "vivid", intensity: 0.5 },
    mix: { sfxGain: 0.5 },
    tags: ["beat", "sound"],
  },

  /** A próxima mídia surge célula por célula numa grade, com um clique por troca. */
  grid: {
    id: "grid",
    aspect: "4:5",
    fit: "cover",
    timeline: {
      photoDurationSec: 1.8,
      videoDurationSec: 3,
      overflow: "fit",
      beatSync: { enabled: true, preset: "bars", flexibility: 0.6 },
      transition: { kind: "grid", durationSec: 0.9 },
      transitionSound: "click",
      photoMotion: "zoomIn",
    },
    mix: { sfxGain: 0.5 },
    tags: ["beat", "photos", "sound"],
  },

  /** Chicotes de câmera em todas as direções e mergulhos de zoom. */
  velocity: {
    id: "velocity",
    aspect: "9:16",
    fit: "cover",
    timeline: {
      photoDurationSec: 1,
      videoDurationSec: 2,
      overflow: "fit",
      beatSync: { enabled: true, preset: "dynamic", flexibility: 0.7 },
      transition: { kind: "mix", kinds: ["whipLeft", "whipUp", "whipRight", "whipDown", "warp"], durationSec: 0.4 },
      transitionSound: "auto",
      photoMotion: "auto",
      // Cada mídia segue deslizando para o lado de onde o chicote a trouxe.
      motionSet: ["zoomIn", "panLeft", "panUp", "panRight", "panDown"],
      motionOnVideos: true,
    },
    filter: { preset: "vivid", intensity: 0.5 },
    effects: { beatPulse: 0.3 },
    mix: { sfxGain: 0.55 },
    tags: ["beat", "fast", "sound"],
  },

  /** Interferência digital: fatias fora do lugar, cores separadas e blocos. */
  glitch: {
    id: "glitch",
    aspect: "9:16",
    fit: "cover",
    timeline: {
      photoDurationSec: 1.1,
      videoDurationSec: 2.2,
      overflow: "fit",
      beatSync: { enabled: true, preset: "accents", flexibility: 0.8 },
      transition: { kind: "mix", kinds: ["glitch", "pixelate", "glitch", "shake"], durationSec: 0.4 },
      transitionSound: "auto",
      photoMotion: "auto",
      motionSet: ["punch", "pulse"],
      motionOnVideos: true,
    },
    filter: { preset: "cool", intensity: 0.7, adjust: { contrast: 0.2, saturation: 0.15 } },
    effects: { beatPulse: 0.4 },
    mix: { sfxGain: 0.45 },
    tags: ["beat", "fast", "sound"],
  },

  /** Ensaio fotográfico: clarão de flash e som de obturador a cada foto. */
  photoShoot: {
    id: "photoShoot",
    aspect: "4:5",
    fit: "fit",
    background: BLUR,
    timeline: {
      photoDurationSec: 1.5,
      videoDurationSec: 3,
      overflow: "fit",
      beatSync: { enabled: true, preset: "steady", flexibility: 0.3 },
      transition: { kind: "flash", durationSec: 0.3 },
      transitionSound: "shutter",
      photoMotion: "punch",
    },
    filter: { preset: "vivid", intensity: 0.3 },
    mix: { sfxGain: 0.7 },
    tags: ["photos", "sound"],
  },

  /** Lembranças: fotos longas, movimento lento e fusões suaves. */
  memories: {
    id: "memories",
    aspect: "16:9",
    fit: "fit",
    background: BLUR,
    timeline: {
      photoDurationSec: 3.5,
      videoDurationSec: 5,
      overflow: "fit",
      beatSync: { enabled: true, preset: "bars", flexibility: 0.4 },
      transition: { kind: "mix", kinds: ["fade", "blur"], durationSec: 1 },
      photoMotion: "auto",
      keepVideoAudio: true,
    },
    filter: { preset: "warm", intensity: 0.6, adjust: { fade: 0.15 } },
    tags: ["calm", "photos"],
  },

  /** Filme antigo: cores desbotadas, queima de película e clique de projetor. */
  vintage: {
    id: "vintage",
    aspect: "4:3",
    fit: "cover",
    timeline: {
      photoDurationSec: 3,
      videoDurationSec: 4.5,
      beatSync: { enabled: false, preset: "steady", flexibility: 0.3 },
      transition: { kind: "mix", kinds: ["burn", "dipBlack"], durationSec: 0.8 },
      transitionSound: "click",
      photoMotion: "auto",
      motionSet: ["zoomIn", "tiltLeft", "zoomOut", "tiltRight"],
    },
    filter: { preset: "vintage", intensity: 1, adjust: { vignette: 0.15 } },
    mix: { sfxGain: 0.35 },
    tags: ["calm", "sound"],
  },

  /** Diário de viagem em paisagem: cortinas, chicotes e o som original dos vídeos. */
  travel: {
    id: "travel",
    aspect: "16:9",
    fit: "cover",
    timeline: {
      photoDurationSec: 2.2,
      videoDurationSec: 4,
      overflow: "fit",
      beatSync: { enabled: true, preset: "dynamic", flexibility: 0.6 },
      transition: { kind: "mix", kinds: ["wipe", "whipLeft", "iris", "whipRight", "fade"], durationSec: 0.5 },
      transitionSound: "auto",
      photoMotion: "auto",
      keepVideoAudio: true,
    },
    filter: { preset: "vivid", intensity: 0.7 },
    mix: { sfxGain: 0.4 },
    tags: ["beat", "sound"],
  },

  /** Tudo em 15 segundos: cortes secos e rápidos, prontos para os Stories. */
  recap: {
    id: "recap",
    aspect: "9:16",
    fit: "cover",
    timeline: {
      photoDurationSec: 0.6,
      videoDurationSec: 1.2,
      total: { mode: "custom", seconds: 15 },
      overflow: "fit",
      beatSync: { enabled: true, preset: "steady", flexibility: 0.5 },
      transition: { kind: "cut" },
      transitionSound: "pop",
      photoMotion: "punch",
      motionOnVideos: true,
    },
    effects: { beatPulse: 0.5 },
    mix: { sfxGain: 0.4 },
    tags: ["beat", "fast", "sound"],
  },

  /** Preto e branco contrastado, barras de cinema e mergulhos no preto. */
  noir: {
    id: "noir",
    aspect: "16:9",
    fit: "cover",
    timeline: {
      photoDurationSec: 3,
      videoDurationSec: 4.5,
      overflow: "fit",
      beatSync: { enabled: true, preset: "bars", flexibility: 0.5 },
      transition: { kind: "dipBlack", durationSec: 0.9 },
      photoMotion: "zoomIn",
      motionOnVideos: true,
    },
    filter: { preset: "noir", intensity: 1 },
    effects: { letterbox: 0.1 },
    tags: ["calm"],
  },

  /** Festa: giros, saltos e tremores, com a imagem pulsando em cada batida. */
  party: {
    id: "party",
    aspect: "9:16",
    fit: "cover",
    timeline: {
      photoDurationSec: 0.9,
      videoDurationSec: 1.8,
      overflow: "fit",
      beatSync: { enabled: true, preset: "accents", flexibility: 0.8 },
      transition: { kind: "mix", kinds: ["spin", "bounce", "shake", "warp"], durationSec: 0.4 },
      transitionSound: "auto",
      photoMotion: "auto",
      motionSet: ["pulse", "punch"],
      motionOnVideos: true,
    },
    filter: { preset: "vivid", intensity: 1, adjust: { saturation: 0.15 } },
    effects: { beatPulse: 1 },
    mix: { sfxGain: 0.45 },
    tags: ["beat", "fast", "sound"],
  },
};

export const TEMPLATE_LIST: readonly VideoTemplate[] = TEMPLATE_IDS.map((id) => TEMPLATES[id]);

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

/**
 * Ajustes do projeto com o template aplicado sobre `base`.
 *
 * O template manda no ritmo, nas transições, no movimento, no filtro, nos efeitos e nos
 * sons. De `base` ficam o que é escolha de quem edita: a duração total (se o template
 * não define uma), manter o som dos vídeos, os volumes de música e vídeo, os ajustes por
 * mídia, os marcadores e a exportação.
 */
export function templateSettings(
  template: VideoTemplate,
  base: VideoProjectSettings,
  aspect: AspectRatio = template.aspect,
): VideoProjectSettings {
  return {
    ...base,
    aspect,
    fit: template.fit,
    background: template.background ?? base.background,
    timeline: {
      ...DEFAULT_TIMELINE_SETTINGS,
      total: base.timeline.total,
      keepVideoAudio: base.timeline.keepVideoAudio,
      ...template.timeline,
    },
    filter: {
      preset: template.filter?.preset ?? "none",
      intensity: template.filter?.intensity ?? 1,
      adjust: { ...NEUTRAL_ADJUST, ...template.filter?.adjust },
    },
    effects: { ...DEFAULT_VIDEO_EFFECTS, ...template.effects },
    mix: { ...base.mix, sfxGain: DEFAULT_AUDIO_MIX.sfxGain, ...template.mix },
    templateId: template.id,
  };
}
