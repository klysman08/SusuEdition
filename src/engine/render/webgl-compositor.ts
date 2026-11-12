/**
 * Compositor WebGL2: desenha um quadro de saída a partir de 1–2 camadas.
 *
 * Cada camada = fundo (cor sólida ou a própria fonte desfocada) + fonte enquadrada
 * (fit/cover/fill). Num fade, a segunda camada é renderizada num framebuffer e
 * misturada por cima com opacidade — mistura exata, sem "vazamento" entre fundos.
 *
 * Funciona com HTMLCanvasElement (preview) e OffscreenCanvas em Worker (export).
 */
import type { FitBackground, FitMode, Size } from "../types";
import { FILTER_GLSL, FILTER_KEYS, FILTER_UNIFORMS, isNeutralFilter, type FilterAdjust } from "./filters";
import type { ClipCrop } from "../timeline/types";
import { croppedSize } from "./crop";
import { coversTarget, fitRect, type Rect } from "./fit";
import { applyMotion, type MotionTransform } from "./motion";

export interface CompositorLayer {
  /** Chave estável da textura (ex.: `${mediaId}:full`). */
  key: string;
  source: TexImageSource;
  /** Tamanho de exibição (já com rotação aplicada). */
  size: Size;
  /** Quartos de volta (horário) que ainda precisam ser aplicados à fonte. */
  quarterTurns?: 0 | 1 | 2 | 3;
  /** Fonte muda a cada quadro (vídeo): reenviar a textura. */
  dynamic: boolean;
  fit: FitMode;
  alpha: number;
  /** Parte da fonte que aparece (fração do tamanho de exibição); ausente = inteira. */
  crop?: ClipCrop | null;
  /** Zoom/deslocamento/giro do momento (Ken Burns). */
  motion?: MotionTransform | null;
  /** Filtro de cor só desta camada (fonte e fundo desfocado dela). */
  filter?: FilterAdjust | null;
}

export interface Compositor {
  readonly size: Size;
  resize(size: Size): void;
  /** `filter`: ajuste de cor aplicado ao quadro inteiro (passe final); `null` = sem filtro. */
  draw(layers: readonly CompositorLayer[], background: FitBackground, filter?: FilterAdjust | null): void;
  /** Libera texturas de chaves que não estão em `keep`. */
  retain(keep: ReadonlySet<string>): void;
  dispose(): void;
}

const VS = `#version 300 es
in vec2 a_pos;
uniform vec4 u_rect;
uniform vec2 u_res;
uniform int u_rot;
uniform bool u_flipV;
uniform vec4 u_uv;
uniform float u_angle;
out vec2 v_uv;
out vec2 v_pos;
void main() {
  // Giro em torno do centro do retângulo, em pixels (não distorce a proporção).
  vec2 d = (a_pos - 0.5) * u_rect.zw;
  float sn = sin(u_angle);
  float cs = cos(u_angle);
  vec2 p = u_rect.xy + 0.5 * u_rect.zw + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  gl_Position = vec4(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0, 0.0, 1.0);
  // Corte: sub-retângulo da fonte, em coordenadas de exibição (antes da rotação da fonte).
  vec2 uv = u_uv.xy + a_pos * u_uv.zw;
  if (u_rot == 1) uv = vec2(uv.y, 1.0 - uv.x);
  else if (u_rot == 2) uv = vec2(1.0 - uv.x, 1.0 - uv.y);
  else if (u_rot == 3) uv = vec2(1.0 - uv.y, uv.x);
  if (u_flipV) uv.y = 1.0 - uv.y;
  v_uv = uv;
  v_pos = a_pos;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_pos;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_dim;
uniform int u_radius;
uniform vec2 u_tap;
uniform bool u_filter;
${FILTER_GLSL}
out vec4 o;
void main() {
  vec3 c;
  if (u_radius == 0) {
    c = texture(u_tex, v_uv).rgb;
  } else {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int x = -u_radius; x <= u_radius; x++) {
      for (int y = -u_radius; y <= u_radius; y++) {
        float w = exp(-float(x * x + y * y) / 4.5);
        acc += texture(u_tex, v_uv + vec2(float(x), float(y)) * u_tap).rgb * w;
        wsum += w;
      }
    }
    c = acc / wsum;
  }
  if (u_filter) c = applyFilter(c, v_pos);
  o = vec4(c * u_dim, 1.0) * u_alpha;
}`;

interface Target {
  fb: WebGLFramebuffer | null;
  tex: WebGLTexture | null;
  size: Size;
}

function parseColor(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createWebGLCompositor(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  opts: { preserveDrawingBuffer?: boolean } = {},
): Compositor {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: true,
    // Export: o quadro é capturado do canvas depois de desenhado.
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    powerPreference: "high-performance",
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 indisponível");

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  gl.useProgram(prog);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const U = {
    rect: u("u_rect"),
    res: u("u_res"),
    rot: u("u_rot"),
    flipV: u("u_flipV"),
    uv: u("u_uv"),
    angle: u("u_angle"),
    tex: u("u_tex"),
    alpha: u("u_alpha"),
    dim: u("u_dim"),
    radius: u("u_radius"),
    tap: u("u_tap"),
    filter: u("u_filter"),
    fAspect: u("u_fAspect"),
  };
  const UF = Object.fromEntries(FILTER_KEYS.map((k) => [k, u(FILTER_UNIFORMS[k])])) as Record<
    keyof FilterAdjust,
    WebGLUniformLocation | null
  >;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(U.tex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const newTexture = () => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };

  const newTarget = (size: Size): Target => {
    const tex = newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, size };
  };
  const freeTarget = (t: Target | null) => {
    if (!t) return;
    gl.deleteFramebuffer(t.fb);
    gl.deleteTexture(t.tex);
  };

  let size: Size = { width: canvas.width, height: canvas.height };
  const screen = (): Target => ({ fb: null, tex: null, size });
  let layerTarget: Target | null = null;
  let blurTarget: Target | null = null;
  /** Quadro completo antes do filtro (só existe enquanto há filtro ativo). */
  let frameTarget: Target | null = null;
  const textures = new Map<string, { tex: WebGLTexture; uploaded: TexImageSource | null }>();

  const ensureTargets = () => {
    if (!layerTarget || layerTarget.size.width !== size.width || layerTarget.size.height !== size.height) {
      freeTarget(layerTarget);
      freeTarget(blurTarget);
      layerTarget = newTarget(size);
      const small = {
        width: Math.max(8, Math.round(size.width / 8)),
        height: Math.max(8, Math.round(size.height / 8)),
      };
      blurTarget = newTarget(small);
    }
  };
  const ensureFrameTarget = (): Target => {
    if (!frameTarget || frameTarget.size.width !== size.width || frameTarget.size.height !== size.height) {
      freeTarget(frameTarget);
      frameTarget = newTarget(size);
    }
    return frameTarget;
  };

  const textureFor = (layer: CompositorLayer): WebGLTexture => {
    let entry = textures.get(layer.key);
    if (!entry) {
      entry = { tex: newTexture(), uploaded: null };
      textures.set(layer.key, entry);
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    if (layer.dynamic || entry.uploaded !== layer.source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.source);
      entry.uploaded = layer.source;
    }
    return entry.tex;
  };

  const bindTarget = (t: Target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.size.width, t.size.height);
    gl.uniform2f(U.res, t.size.width, t.size.height);
  };

  const quad = (
    tex: WebGLTexture,
    rect: Rect,
    opts: {
      rot?: number;
      flipV?: boolean;
      alpha?: number;
      dim?: number;
      radius?: number;
      tap?: [number, number];
      filter?: FilterAdjust;
      crop?: ClipCrop | null;
      angle?: number;
    },
  ) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform4f(U.rect, rect.x, rect.y, rect.w, rect.h);
    gl.uniform1i(U.rot, opts.rot ?? 0);
    gl.uniform1i(U.flipV, opts.flipV ? 1 : 0);
    const c = opts.crop;
    gl.uniform4f(U.uv, c?.x ?? 0, c?.y ?? 0, c?.w ?? 1, c?.h ?? 1);
    gl.uniform1f(U.angle, opts.angle ?? 0);
    gl.uniform1f(U.alpha, opts.alpha ?? 1);
    gl.uniform1f(U.dim, opts.dim ?? 1);
    gl.uniform1i(U.radius, opts.radius ?? 0);
    gl.uniform2f(U.tap, opts.tap?.[0] ?? 0, opts.tap?.[1] ?? 0);
    gl.uniform1i(U.filter, opts.filter ? 1 : 0);
    if (opts.filter) {
      for (const k of FILTER_KEYS) gl.uniform1f(UF[k], opts.filter[k]);
      gl.uniform1f(U.fAspect, rect.w / Math.max(1, rect.h));
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  /** Desenha uma camada completa (fundo + fonte) em `target`, opaca. */
  const drawLayer = (layer: CompositorLayer, background: FitBackground, target: Target) => {
    const tex = textureFor(layer);
    const rot = layer.quarterTurns ?? 0;
    const crop = layer.crop ?? null;
    // Com corte, o que se enquadra é só a parte escolhida da fonte.
    const shown = croppedSize(layer.size, crop);
    const rect = applyMotion(fitRect(shown, target.size, layer.fit), layer.motion);
    const needsBg = !coversTarget(rect, target.size);
    const filter = layer.filter && !isNeutralFilter(layer.filter) ? layer.filter : undefined;

    if (needsBg && background.kind === "blur" && blurTarget) {
      // 1) fonte em "cover" num alvo pequeno (1/8), já com um borrão leve
      bindTarget(blurTarget);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const small = fitRect(shown, blurTarget.size, "cover");
      quad(tex, small, {
        rot,
        radius: 2,
        tap: [(0.5 / small.w) * (crop?.w ?? 1), (0.5 / small.h) * (crop?.h ?? 1)],
        filter,
        crop,
      });
      // 2) amplia para o alvo com borrão gaussiano e escurece
      bindTarget(target);
      const strength = Math.max(0.5, Math.min(2, background.strength));
      quad(
        blurTarget.tex!,
        { x: 0, y: 0, w: target.size.width, h: target.size.height },
        {
          flipV: true,
          radius: 2,
          dim: 0.6,
          tap: [strength / blurTarget.size.width, strength / blurTarget.size.height],
        },
      );
    } else {
      bindTarget(target);
      const [r, g, b] = needsBg && background.kind === "color" ? parseColor(background.color) : [0, 0, 0];
      gl.clearColor(r, g, b, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    quad(tex, rect, { rot, filter, crop, angle: layer.motion?.rotation });
  };

  return {
    get size() {
      return size;
    },
    resize(next) {
      if (next.width === size.width && next.height === size.height) return;
      canvas.width = next.width;
      canvas.height = next.height;
      size = { ...next };
    },
    draw(layers, background, filter) {
      if (gl.isContextLost()) return;
      ensureTargets();
      const [first, second] = layers;
      if (!first) {
        bindTarget(screen());
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      // Com filtro, o quadro é montado num framebuffer e passa pelo shader de cor no fim.
      const fx = filter && !isNeutralFilter(filter) ? filter : null;
      const out = fx ? ensureFrameTarget() : screen();
      const full = { x: 0, y: 0, w: size.width, h: size.height };
      drawLayer(first, background, out);
      if (second && second.alpha > 0) {
        drawLayer(second, background, layerTarget!);
        bindTarget(out);
        quad(layerTarget!.tex!, full, { flipV: true, alpha: second.alpha });
      }
      if (fx) {
        bindTarget(screen());
        quad(out.tex!, full, { flipV: true, filter: fx });
      } else if (frameTarget) {
        freeTarget(frameTarget);
        frameTarget = null;
      }
    },
    retain(keep) {
      for (const [key, entry] of textures) {
        if (!keep.has(key)) {
          gl.deleteTexture(entry.tex);
          textures.delete(key);
        }
      }
    },
    dispose() {
      for (const entry of textures.values()) gl.deleteTexture(entry.tex);
      textures.clear();
      freeTarget(layerTarget);
      freeTarget(blurTarget);
      freeTarget(frameTarget);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
    },
  };
}
