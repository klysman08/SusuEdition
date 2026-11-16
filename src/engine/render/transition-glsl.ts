/**
 * Shader das transições: recebe o quadro que sai (`u_from`), o que entra (`u_to`) e o
 * progresso `u_p` (0 → 1), e desenha o quadro misturado. `u_kind` é o índice da
 * transição em `TRANSITION_KINDS` — mantenha as duas listas na mesma ordem.
 *
 * Coordenadas: `v_pos` vai de (0,0) no canto superior esquerdo a (1,1). As texturas
 * vêm de framebuffers, por isso a leitura inverte o eixo Y.
 */
export const TRANSITION_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_pos;
void main() {
  gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);
  v_pos = a_pos;
}`;

export const TRANSITION_FS = `#version 300 es
precision highp float;
in vec2 v_pos;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_p;
uniform int u_kind;
uniform float u_aspect;
out vec4 o;

const float PI = 3.14159265;

// Fora do quadro a imagem se espelha (tremores, giros e zooms nunca mostram borda preta).
vec2 mirror(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }
vec3 A(vec2 uv) { uv = mirror(uv); return texture(u_from, vec2(uv.x, 1.0 - uv.y)).rgb; }
vec3 B(vec2 uv) { uv = mirror(uv); return texture(u_to, vec2(uv.x, 1.0 - uv.y)).rgb; }
vec3 pick(vec2 uv, float toB) { return toB > 0.5 ? B(uv) : A(uv); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.3 * noise(p * 2.1 + 7.3) + 0.2 * noise(p * 4.3 + 19.1); }

float ease(float t) { return t * t * (3.0 - 2.0 * t); }
float easeCubic(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }
float easeBack(float t) { float c = 1.70158; float u = t - 1.0; return 1.0 + (c + 1.0) * u * u * u + c * u * u; }
// 0 nas pontas, 1 no meio da transição.
float peak(float p) { return sin(PI * clamp(p, 0.0, 1.0)); }

vec2 zoomed(vec2 uv, float s) { return 0.5 + (uv - 0.5) / s; }
vec2 rotated(vec2 uv, float a) {
  vec2 d = (uv - 0.5) * vec2(u_aspect, 1.0);
  float sn = sin(a);
  float cs = cos(a);
  return vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs) / vec2(u_aspect, 1.0) + 0.5;
}

// Quadro "empurrado": A sai na direção contrária a d e B entra logo atrás.
vec3 pushed(vec2 uv, vec2 d, float t) {
  vec2 q = uv + d * t;
  bool inA = q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0;
  if (inA) return texture(u_from, vec2(q.x, 1.0 - q.y)).rgb;
  q -= d;
  return texture(u_to, vec2(q.x, 1.0 - q.y)).rgb;
}

// Chicote: empurrão com borrão de movimento proporcional à velocidade.
vec3 whip(vec2 uv, vec2 d, float p) {
  float e = easeCubic(p);
  float spread = 0.32 * peak(p);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float t = clamp(e + (float(i) / 11.0 - 0.5) * spread, 0.0, 1.0);
    acc += pushed(uv, d, t);
  }
  return acc / 12.0;
}

// Faixas que deslizam em sentidos alternados, uma depois da outra.
vec3 bands(vec2 uv, float p, bool vertical, float count) {
  float along = vertical ? uv.x : uv.y;
  float index = min(count - 1.0, floor(along * count));
  float stagger = 0.45;
  float local = clamp((p * (1.0 + stagger) - stagger * index / (count - 1.0)), 0.0, 1.0);
  float e = easeCubic(local);
  float dir = mod(index, 2.0) < 0.5 ? 1.0 : -1.0;
  vec2 d = vertical ? vec2(0.0, dir) : vec2(dir, 0.0);
  vec3 c = pushed(uv, d, e);
  // Fresta escura entre as faixas enquanto elas se movem.
  float edge = abs(fract(along * count) - 0.5) * 2.0;
  float gap = smoothstep(1.0 - 0.06, 1.0, edge) * peak(p);
  return c * (1.0 - 0.75 * gap);
}

void main() {
  vec2 uv = v_pos;
  float p = clamp(u_p, 0.0, 1.0);
  vec3 c;

  if (u_kind == 0) {
    // fade
    c = mix(A(uv), B(uv), p);
  } else if (u_kind == 1) {
    // dipBlack: escurece até o preto e volta na mídia seguinte
    c = p < 0.5 ? A(uv) * (1.0 - ease(p * 2.0)) : B(uv) * ease(p * 2.0 - 1.0);
  } else if (u_kind == 2) {
    // blur: as duas mídias se dissolvem desfocadas
    float r = 0.045 * peak(p);
    float m = smoothstep(0.25, 0.75, p);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float rad = r * sqrt((fi + 0.5) / 14.0);
      vec2 off = rad * vec2(cos(fi * 2.399963), sin(fi * 2.399963)) * vec2(1.0, u_aspect);
      acc += mix(A(uv + off), B(uv + off), m);
    }
    c = acc / 14.0;
  } else if (u_kind == 3) {
    // flash: clarão branco de câmera em cima do corte
    float f = pow(peak(p), 1.6);
    c = mix(pick(uv, step(0.5, p)), vec3(1.0), f);
  } else if (u_kind == 4) {
    // punch: a mídia avança num zoom com borrão radial e a seguinte assenta
    float e = easeCubic(p);
    float m = smoothstep(0.38, 0.62, p);
    float k = 0.12 * peak(p);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float s = 1.0 - k * float(i) / 7.0;
      vec2 q = 0.5 + (uv - 0.5) * s;
      acc += mix(A(zoomed(q, 1.0 + 0.55 * e)), B(zoomed(q, 1.4 - 0.4 * easeOut(p))), m);
    }
    c = acc / 8.0 + 0.12 * peak(p);
  } else if (u_kind == 5) {
    // shake: tremor que some depois do corte, com as cores se separando
    float amp = 0.035 * pow(peak(p), 0.8);
    vec2 off = amp * vec2(sin(p * 47.0), cos(p * 61.0) * u_aspect * 0.6);
    float toB = step(0.5, p);
    vec2 q = zoomed(uv, 1.0 + 0.06 * peak(p)) + off;
    vec2 split = vec2(amp * 0.5, 0.0);
    c = vec3(pick(q + split, toB).r, pick(q, toB).g, pick(q - split, toB).b);
  } else if (u_kind == 6) {
    // bounce: a próxima mídia salta do centro, passando um pouco do tamanho final
    float s = mix(0.25, 1.0, easeBack(p));
    vec2 q = zoomed(uv, s);
    bool inside = q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0 && p > 0.02;
    c = inside ? texture(u_to, vec2(q.x, 1.0 - q.y)).rgb : A(zoomed(uv, 1.0 + 0.08 * p)) * (1.0 - 0.65 * ease(p));
  } else if (u_kind == 7) {
    c = whip(uv, vec2(1.0, 0.0), p);
  } else if (u_kind == 8) {
    c = whip(uv, vec2(-1.0, 0.0), p);
  } else if (u_kind == 9) {
    c = whip(uv, vec2(0.0, 1.0), p);
  } else if (u_kind == 10) {
    c = whip(uv, vec2(0.0, -1.0), p);
  } else if (u_kind == 11) {
    // spin: giro rápido com borrão angular
    float e = easeCubic(p);
    float m = smoothstep(0.42, 0.58, p);
    float turn = 2.4;
    float spread = 0.5 * peak(p);
    float zoom = 1.0 + 0.45 * peak(p);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
      float j = (float(i) / 9.0 - 0.5) * spread;
      vec2 qa = zoomed(rotated(uv, e * turn + j), zoom);
      vec2 qb = zoomed(rotated(uv, (e - 1.0) * turn + j), zoom);
      acc += mix(A(qa), B(qb), m);
    }
    c = acc / 10.0;
  } else if (u_kind == 12) {
    // warp: mergulho num zoom contínuo que atravessa de uma mídia para a outra
    float e = easeCubic(p);
    float m = smoothstep(0.44, 0.56, p);
    float k = 0.3 * peak(p);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
      float s = 1.0 - k * float(i) / 9.0;
      vec2 q = 0.5 + (uv - 0.5) * s;
      acc += mix(A(zoomed(q, mix(1.0, 3.2, e))), B(zoomed(q, mix(0.32, 1.0, e))), m);
    }
    c = acc / 10.0;
  } else if (u_kind == 13) {
    // glitch: fatias deslocadas, cores separadas e troca aos saltos
    float g = peak(p);
    float tick = floor(p * 14.0);
    float band = floor(uv.y * 26.0);
    float h = hash(vec2(band, tick));
    float h2 = hash(vec2(tick, band * 3.7));
    float shift = (h - 0.5) * 0.22 * g * step(0.45, h2);
    float toB = step(0.5 + (h2 - 0.5) * 0.45, p);
    vec2 q = uv + vec2(shift, 0.0);
    vec2 split = vec2(0.02 * g * (0.4 + h), 0.0);
    c = vec3(pick(q + split, toB).r, pick(q, toB).g, pick(q - split, toB).b);
    c *= 1.0 - 0.22 * g * step(0.82, hash(vec2(floor(uv.y * 180.0), tick)));
    c += 0.1 * g * step(0.93, h);
  } else if (u_kind == 14) {
    // pixelate: blocos crescem, a mídia troca e os blocos somem
    float s = 0.075 * pow(peak(p), 1.5);
    vec2 cell = vec2(s, s * u_aspect);
    vec2 q = s > 0.002 ? (floor(uv / cell) + 0.5) * cell : uv;
    c = pick(q, step(0.5, p));
  } else if (u_kind == 15) {
    // wipe: cortina diagonal com borda suave
    float f = 0.1;
    float e = mix(-f, 1.0 + f, ease(p));
    float x = uv.x + 0.22 * (uv.y - 0.5);
    float m = 1.0 - smoothstep(e - f, e + f, x);
    c = mix(A(uv), B(uv), m) + 0.25 * (1.0 - abs(2.0 * m - 1.0)) * peak(p);
  } else if (u_kind == 16) {
    // iris: círculo que abre a partir do centro
    float f = 0.06;
    float radius = length((uv - 0.5) * vec2(u_aspect, 1.0)) / (0.5 * length(vec2(u_aspect, 1.0)));
    float e = mix(-f, 1.0 + f, ease(p));
    float m = 1.0 - smoothstep(e - f, e + f, radius);
    c = mix(A(uv) * (1.0 - 0.35 * peak(p)), B(uv), m);
  } else if (u_kind == 17) {
    // burn: queima de filme — a mídia se desfaz em manchas com borda incandescente
    float n = fbm(uv * vec2(u_aspect, 1.0) * 3.2);
    float th = mix(-0.2, 1.2, p);
    float m = 1.0 - smoothstep(th - 0.04, th + 0.04, n);
    float glow = smoothstep(th - 0.02, th + 0.06, n) * (1.0 - smoothstep(th + 0.06, th + 0.24, n));
    c = mix(A(uv), B(uv), m);
    c += vec3(1.0, 0.5, 0.12) * glow * 1.6 * peak(p);
    c += vec3(1.0, 0.62, 0.25) * 0.3 * pow(peak(p), 2.0);
  } else if (u_kind == 18) {
    // frameShift: colunas que sobem e descem alternadas
    c = bands(uv, p, true, 5.0);
  } else if (u_kind == 19) {
    // slices: fatias horizontais que entram dos dois lados
    c = bands(uv, p, false, 6.0);
  } else {
    // grid: a próxima mídia aparece célula por célula numa grade
    vec2 count = u_aspect >= 1.0 ? vec2(max(3.0, floor(3.0 * u_aspect + 0.5)), 3.0) : vec2(3.0, max(3.0, floor(3.0 / u_aspect + 0.5)));
    vec2 cell = min(count - 1.0, floor(uv * count));
    vec2 local = fract(uv * count);
    float start = 0.04 + 0.72 * hash(cell + 3.0);
    float lp = clamp((p - start) / 0.22, 0.0, 1.0);
    float grow = easeOut(lp);
    vec2 dist = abs(local - 0.5) * 2.0;
    bool shown = lp > 0.0 && max(dist.x, dist.y) <= grow;
    c = shown ? B(uv) : A(uv) * (1.0 - 0.25 * peak(p));
    float line = smoothstep(0.93, 1.0, max(dist.x, dist.y)) * peak(p);
    c *= 1.0 - 0.85 * line;
  }

  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
