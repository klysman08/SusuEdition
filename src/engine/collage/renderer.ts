/**
 * Renderizador WebGL2 da colagem. Mesmo código no preview (canvas da página) e no
 * export (OffscreenCanvas em Worker).
 *
 * Passe 1: fundo + cada célula (recorte da foto, cantos arredondados com
 * antisserrilhado por SDF). Passe 2 (só com filtro ativo): filtro de cor sobre a
 * imagem inteira, lendo o framebuffer do passe 1.
 */
import { FILTER_GLSL, FILTER_KEYS, FILTER_UNIFORMS, isNeutralFilter, type FilterAdjust } from "../render/filters";
import type { Size } from "../types";
import type { Rect } from "./layout";

export interface SceneCell {
  /** Retângulo em px da saída. */
  rect: Rect;
  /** Chave estável da textura (ex.: `${id}:full`); `null` = célula vazia/carregando. */
  key: string | null;
  source: TexImageSource | null;
  /** Janela visível da foto, 0..1 (ver `cropWindow`). */
  window: Rect;
}

export interface CollageScene {
  size: Size;
  background: string;
  /** Raio dos cantos de cada célula (px da saída). */
  radius: number;
  cells: readonly SceneCell[];
  filter: FilterAdjust;
  /** Cor das células ainda sem foto (preview). */
  placeholder?: string;
}

export interface CollageRenderer {
  render(scene: CollageScene): void;
  /** Maior lado suportado pela GPU (texturas e framebuffers). */
  readonly maxSize: number;
  retain(keep: ReadonlySet<string>): void;
  /** Libera recursos GPU. `releaseContext` também descarta o contexto (canvas temporário). */
  dispose(opts?: { releaseContext?: boolean }): void;
}

const VS = `#version 300 es
in vec2 a_pos;
uniform vec4 u_rect;
uniform vec4 u_uv;
uniform vec2 u_res;
uniform bool u_flipV;
out vec2 v_uv;
out vec2 v_px;
void main() {
  vec2 p = u_rect.xy + a_pos * u_rect.zw;
  v_px = p;
  gl_Position = vec4(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0, 0.0, 1.0);
  vec2 uv = u_uv.xy + a_pos * u_uv.zw;
  if (u_flipV) uv.y = 1.0 - uv.y;
  v_uv = uv;
}`;

const CELL_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_px;
uniform sampler2D u_tex;
uniform bool u_hasTex;
uniform vec3 u_fill;
uniform vec4 u_rect;
uniform float u_radius;
out vec4 o;
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 half_ = u_rect.zw * 0.5;
  float r = min(u_radius, min(half_.x, half_.y));
  float d = sdRoundBox(v_px - (u_rect.xy + half_), half_, r);
  float a = clamp(0.5 - d, 0.0, 1.0);
  vec4 t = u_hasTex ? texture(u_tex, v_uv) : vec4(u_fill, 1.0);
  a *= t.a;
  o = vec4(t.rgb * a, a);
}`;

const FILTER_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
${FILTER_GLSL}
out vec4 o;
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  o = vec4(applyFilter(texture(u_tex, v_uv).rgb, uv), 1.0);
}`;

function parseColor(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createCollageRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  opts: { preserveDrawingBuffer?: boolean } = {},
): CollageRenderer {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 indisponível");

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  const link = (fsSrc: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    const loc = (name: string) => gl.getUniformLocation(p, name);
    return { p, loc };
  };
  const cell = link(CELL_FS);
  const filter = link(FILTER_FS);
  const CU = {
    rect: cell.loc("u_rect"),
    uv: cell.loc("u_uv"),
    res: cell.loc("u_res"),
    flipV: cell.loc("u_flipV"),
    tex: cell.loc("u_tex"),
    hasTex: cell.loc("u_hasTex"),
    fill: cell.loc("u_fill"),
    radius: cell.loc("u_radius"),
  };
  const FU = {
    rect: filter.loc("u_rect"),
    uv: filter.loc("u_uv"),
    res: filter.loc("u_res"),
    flipV: filter.loc("u_flipV"),
    tex: filter.loc("u_tex"),
    aspect: filter.loc("u_fAspect"),
    params: Object.fromEntries(FILTER_KEYS.map((k) => [k, filter.loc(FILTER_UNIFORMS[k])])) as Record<
      keyof FilterAdjust,
      WebGLUniformLocation | null
    >,
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const maxSize = Math.min(
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    ...((gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null) ?? [16384]),
  );

  const textures = new Map<string, { tex: WebGLTexture; uploaded: TexImageSource | null }>();
  const textureFor = (key: string, source: TexImageSource): WebGLTexture => {
    let entry = textures.get(key);
    if (!entry) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      entry = { tex, uploaded: null };
      textures.set(key, entry);
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    if (entry.uploaded !== source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      entry.uploaded = source;
    }
    return entry.tex;
  };

  // Framebuffer do passe 1 quando há filtro.
  let target: { fb: WebGLFramebuffer; tex: WebGLTexture; size: Size } | null = null;
  const ensureTarget = (size: Size) => {
    if (target && target.size.width === size.width && target.size.height === size.height) return target;
    if (target) {
      gl.deleteFramebuffer(target.fb);
      gl.deleteTexture(target.tex);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    target = { fb, tex, size: { ...size } };
    return target;
  };

  return {
    maxSize,
    render(scene) {
      if (gl.isContextLost()) return;
      const { width, height } = scene.size;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const filtered = !isNeutralFilter(scene.filter);
      const fb = filtered ? ensureTarget(scene.size).fb : null;

      // Passe 1: fundo + células.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, width, height);
      const [br, bg, bb] = parseColor(scene.background);
      gl.clearColor(br, bg, bb, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(cell.p);
      gl.uniform2f(CU.res, width, height);
      gl.uniform1i(CU.tex, 0);
      gl.uniform1i(CU.flipV, 0);
      gl.uniform1f(CU.radius, Math.max(0, scene.radius));
      const fill = parseColor(scene.placeholder ?? "#808080");
      gl.uniform3f(CU.fill, fill[0], fill[1], fill[2]);
      gl.activeTexture(gl.TEXTURE0);
      for (const c of scene.cells) {
        const has = !!(c.key && c.source);
        if (has) textureFor(c.key!, c.source!);
        gl.uniform1i(CU.hasTex, has ? 1 : 0);
        gl.uniform4f(CU.rect, c.rect.x, c.rect.y, c.rect.w, c.rect.h);
        gl.uniform4f(CU.uv, c.window.x, c.window.y, c.window.w, c.window.h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // Passe 2: filtro sobre tudo.
      if (filtered && target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.BLEND);
        gl.useProgram(filter.p);
        gl.uniform2f(FU.res, width, height);
        gl.uniform4f(FU.rect, 0, 0, width, height);
        gl.uniform4f(FU.uv, 0, 0, 1, 1);
        gl.uniform1i(FU.flipV, 1);
        gl.uniform1i(FU.tex, 0);
        gl.uniform1f(FU.aspect, width / height);
        for (const k of FILTER_KEYS) gl.uniform1f(FU.params[k], scene.filter[k]);
        gl.bindTexture(gl.TEXTURE_2D, target.tex);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    dispose(opts) {
      for (const entry of textures.values()) gl.deleteTexture(entry.tex);
      textures.clear();
      if (target) {
        gl.deleteFramebuffer(target.fb);
        gl.deleteTexture(target.tex);
      }
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(cell.p);
      gl.deleteProgram(filter.p);
      // Por padrão mantém o contexto: o mesmo canvas pode ganhar outro renderizador (StrictMode).
      if (opts?.releaseContext) gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
