/**
 * Filtros de cor (RF-C6), aplicados num passe final de shader sobre a imagem inteira.
 * Compartilhado: a colagem usa agora; o Video Maker pode reutilizar o mesmo GLSL.
 *
 * Um filtro = preset (com intensidade 0..1) + ajustes manuais somados por cima.
 */

export interface FilterAdjust {
  /** −1..1 */
  brightness: number;
  /** −1..1 */
  contrast: number;
  /** −1..1 (−1 = sem cor) */
  saturation: number;
  /** −1 (frio) .. 1 (quente) */
  temperature: number;
  /** 0..1 */
  vignette: number;
  /** 0..1 — preto e branco */
  grayscale: number;
  /** 0..1 */
  sepia: number;
  /** 0..1 — pretos lavados (aspecto de filme) */
  fade: number;
}

export const FILTER_KEYS = [
  "brightness",
  "contrast",
  "saturation",
  "temperature",
  "vignette",
  "grayscale",
  "sepia",
  "fade",
] as const satisfies readonly (keyof FilterAdjust)[];

/** Ajustes com faixa −1..1 (os demais são 0..1). */
export const SIGNED_KEYS: ReadonlySet<keyof FilterAdjust> = new Set([
  "brightness",
  "contrast",
  "saturation",
  "temperature",
]);

export const NEUTRAL_ADJUST: FilterAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  vignette: 0,
  grayscale: 0,
  sepia: 0,
  fade: 0,
};

export const FILTER_PRESETS = {
  none: {},
  vivid: { contrast: 0.15, saturation: 0.45, brightness: 0.03 },
  warm: { temperature: 0.55, saturation: 0.1, brightness: 0.03 },
  cool: { temperature: -0.55, contrast: 0.05 },
  mono: { grayscale: 1, contrast: 0.15 },
  noir: { grayscale: 1, contrast: 0.5, brightness: -0.06, vignette: 0.55 },
  sepia: { sepia: 0.9, contrast: 0.05 },
  vintage: { sepia: 0.35, fade: 0.55, saturation: -0.2, vignette: 0.4, temperature: 0.2 },
  dramatic: { contrast: 0.45, saturation: -0.15, vignette: 0.5, brightness: -0.04 },
  soft: { fade: 0.35, contrast: -0.2, brightness: 0.06, saturation: -0.05 },
} as const satisfies Record<string, Partial<FilterAdjust>>;

export type FilterPresetId = keyof typeof FILTER_PRESETS;
export const FILTER_PRESET_IDS = Object.keys(FILTER_PRESETS) as FilterPresetId[];

export interface FilterSettings {
  preset: FilterPresetId;
  /** 0..1 — quanto do preset é aplicado. */
  intensity: number;
  adjust: FilterAdjust;
}

export const DEFAULT_FILTER: FilterSettings = { preset: "none", intensity: 1, adjust: NEUTRAL_ADJUST };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Parâmetros finais do shader: preset × intensidade + ajustes, nas faixas válidas. */
export function resolveFilter(f: FilterSettings): FilterAdjust {
  const preset: Partial<FilterAdjust> = FILTER_PRESETS[f.preset] ?? {};
  const k = clamp(f.intensity, 0, 1);
  const out = { ...NEUTRAL_ADJUST };
  for (const key of FILTER_KEYS) {
    const v = (preset[key] ?? 0) * k + f.adjust[key];
    out[key] = SIGNED_KEYS.has(key) ? clamp(v, -1, 1) : clamp(v, 0, 1);
  }
  return out;
}

export function isNeutralFilter(a: FilterAdjust): boolean {
  return FILTER_KEYS.every((k) => Math.abs(a[k]) < 1e-4);
}

/**
 * GLSL (ES 3.0) do filtro. Declara os uniforms `u_f*` e `vec3 applyFilter(vec3 c, vec2 uv)`.
 * `u_fAspect` = largura/altura, para a vinheta ficar redonda em qualquer proporção.
 */
export const FILTER_GLSL = `
uniform float u_fBrightness;
uniform float u_fContrast;
uniform float u_fSaturation;
uniform float u_fTemperature;
uniform float u_fVignette;
uniform float u_fGrayscale;
uniform float u_fSepia;
uniform float u_fFade;
uniform float u_fAspect;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 applyFilter(vec3 c, vec2 uv) {
  c = c + u_fBrightness * 0.3;
  float k = u_fContrast >= 0.0 ? 1.0 + u_fContrast * 1.5 : 1.0 + u_fContrast * 0.8;
  c = (c - 0.5) * k + 0.5;
  c = mix(vec3(dot(c, LUMA)), c, 1.0 + u_fSaturation);
  c += vec3(0.09, 0.02, -0.09) * u_fTemperature;
  c = mix(c, vec3(dot(c, LUMA)), u_fGrayscale);
  vec3 sep = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
  c = mix(c, sep, u_fSepia);
  c = c * (1.0 - 0.22 * u_fFade) + 0.1 * u_fFade;
  vec2 d = (uv - 0.5) * 2.0;
  d *= u_fAspect >= 1.0 ? vec2(1.0, 1.0 / u_fAspect) : vec2(u_fAspect, 1.0);
  float v = smoothstep(0.35, 1.25, length(d));
  c *= 1.0 - u_fVignette * 0.8 * v;
  return clamp(c, 0.0, 1.0);
}
`;

export const FILTER_UNIFORMS: Record<keyof FilterAdjust, string> = {
  brightness: "u_fBrightness",
  contrast: "u_fContrast",
  saturation: "u_fSaturation",
  temperature: "u_fTemperature",
  vignette: "u_fVignette",
  grayscale: "u_fGrayscale",
  sepia: "u_fSepia",
  fade: "u_fFade",
};
