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
import { coversTarget, fitRect, type Rect } from "./fit";

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
}

export interface Compositor {
  readonly size: Size;
  resize(size: Size): void;
  draw(layers: readonly CompositorLayer[], background: FitBackground): void;
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
out vec2 v_uv;
void main() {
  vec2 p = u_rect.xy + a_pos * u_rect.zw;
  gl_Position = vec4(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0, 0.0, 1.0);
  vec2 uv = a_pos;
  if (u_rot == 1) uv = vec2(uv.y, 1.0 - uv.x);
  else if (u_rot == 2) uv = vec2(1.0 - uv.x, 1.0 - uv.y);
  else if (u_rot == 3) uv = vec2(1.0 - uv.y, uv.x);
  if (u_flipV) uv.y = 1.0 - uv.y;
  v_uv = uv;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_dim;
uniform int u_radius;
uniform vec2 u_tap;
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
    tex: u("u_tex"),
    alpha: u("u_alpha"),
    dim: u("u_dim"),
    radius: u("u_radius"),
    tap: u("u_tap"),
  };

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
    opts: { rot?: number; flipV?: boolean; alpha?: number; dim?: number; radius?: number; tap?: [number, number] },
  ) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform4f(U.rect, rect.x, rect.y, rect.w, rect.h);
    gl.uniform1i(U.rot, opts.rot ?? 0);
    gl.uniform1i(U.flipV, opts.flipV ? 1 : 0);
    gl.uniform1f(U.alpha, opts.alpha ?? 1);
    gl.uniform1f(U.dim, opts.dim ?? 1);
    gl.uniform1i(U.radius, opts.radius ?? 0);
    gl.uniform2f(U.tap, opts.tap?.[0] ?? 0, opts.tap?.[1] ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  /** Desenha uma camada completa (fundo + fonte) em `target`, opaca. */
  const drawLayer = (layer: CompositorLayer, background: FitBackground, target: Target) => {
    const tex = textureFor(layer);
    const rot = layer.quarterTurns ?? 0;
    const rect = fitRect(layer.size, target.size, layer.fit);
    const needsBg = !coversTarget(rect, target.size);

    if (needsBg && background.kind === "blur" && blurTarget) {
      // 1) fonte em "cover" num alvo pequeno (1/8), já com um borrão leve
      bindTarget(blurTarget);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const small = fitRect(layer.size, blurTarget.size, "cover");
      quad(tex, small, { rot, radius: 2, tap: [0.5 / small.w, 0.5 / small.h] });
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
    quad(tex, rect, { rot });
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
    draw(layers, background) {
      if (gl.isContextLost()) return;
      ensureTargets();
      const [first, second] = layers;
      if (!first) {
        bindTarget(screen());
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      drawLayer(first, background, screen());
      if (second && second.alpha > 0) {
        drawLayer(second, background, layerTarget!);
        bindTarget(screen());
        quad(layerTarget!.tex!, { x: 0, y: 0, w: size.width, h: size.height }, { flipV: true, alpha: second.alpha });
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
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
    },
  };
}
