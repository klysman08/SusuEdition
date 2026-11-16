/**
 * "Fotos" de exemplo das prévias dos templates, desenhadas em canvas (o app não embute
 * nenhuma imagem). Paisagens e retratos misturados, para as prévias mostrarem também o
 * enquadramento e o fundo desfocado.
 */
import type { Size } from "@/engine/types";

export interface SampleImage {
  canvas: HTMLCanvasElement;
  size: Size;
}

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

function gradient(c: CanvasRenderingContext2D, h: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/** Colinas em camadas: cada uma é uma curva suave de lado a lado. */
function hills(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: number,
  amp: number,
  phase: number,
  color: string,
) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 40) {
    const y =
      h * base -
      amp * h * (0.6 * Math.sin((x / w) * Math.PI * 2 + phase) + 0.4 * Math.sin((x / w) * Math.PI * 5 + phase * 2));
    c.lineTo(x, y);
  }
  c.lineTo(w, h);
  c.closePath();
  c.fill();
}

const sunset: Draw = (c, w, h) => {
  c.fillStyle = gradient(c, h, [
    [0, "#2b1055"],
    [0.45, "#d53369"],
    [0.75, "#fbb040"],
    [1, "#ffe29a"],
  ]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#fff4c2";
  c.beginPath();
  c.arc(w * 0.62, h * 0.6, Math.min(w, h) * 0.13, 0, Math.PI * 2);
  c.fill();
  hills(c, w, h, 0.74, 0.06, 0.4, "#7a2a5e");
  hills(c, w, h, 0.84, 0.07, 2.1, "#3d1a45");
  hills(c, w, h, 0.94, 0.05, 4, "#1b0f2a");
};

const ocean: Draw = (c, w, h) => {
  c.fillStyle = gradient(c, h, [
    [0, "#4facfe"],
    [0.55, "#c2f0ff"],
    [0.56, "#1a7fb8"],
    [1, "#0b3d68"],
  ]);
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(255,255,255,0.35)";
  c.lineWidth = Math.max(2, h * 0.006);
  for (let i = 0; i < 6; i++) {
    const y = h * (0.62 + i * 0.065);
    c.beginPath();
    c.moveTo(w * (0.1 + 0.11 * i), y);
    c.lineTo(w * (0.38 + 0.09 * i), y);
    c.stroke();
  }
  // veleiro
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(w * 0.3, h * 0.3);
  c.lineTo(w * 0.3, h * 0.56);
  c.lineTo(w * 0.44, h * 0.56);
  c.closePath();
  c.fill();
  c.fillStyle = "#ff6b6b";
  c.beginPath();
  c.moveTo(w * 0.28, h * 0.36);
  c.lineTo(w * 0.28, h * 0.56);
  c.lineTo(w * 0.19, h * 0.56);
  c.closePath();
  c.fill();
  c.fillStyle = "#0d2740";
  c.fillRect(w * 0.17, h * 0.565, w * 0.29, h * 0.025);
};

const city: Draw = (c, w, h) => {
  c.fillStyle = gradient(c, h, [
    [0, "#0f0c29"],
    [0.6, "#302b63"],
    [1, "#f7797d"],
  ]);
  c.fillRect(0, 0, w, h);
  const heights = [0.42, 0.6, 0.35, 0.7, 0.5, 0.62, 0.38, 0.55, 0.45];
  const bw = w / heights.length;
  heights.forEach((k, i) => {
    const top = h * (1 - k);
    c.fillStyle = i % 2 ? "#15132e" : "#1e1b40";
    c.fillRect(i * bw, top, bw * 0.92, h - top);
    c.fillStyle = "#ffd76a";
    for (let r = 0; r < 14; r++) {
      for (let col = 0; col < 3; col++) {
        if ((i * 7 + r * 3 + col * 5) % 4 === 0) continue;
        const y = top + h * 0.03 + r * h * 0.045;
        if (y > h * 0.97) continue;
        c.fillRect(i * bw + bw * (0.14 + col * 0.25), y, bw * 0.13, h * 0.018);
      }
    }
  });
};

const mountains: Draw = (c, w, h) => {
  c.fillStyle = gradient(c, h, [
    [0, "#89f7fe"],
    [1, "#e0f7fa"],
  ]);
  c.fillRect(0, 0, w, h);
  const peak = (x: number, top: number, half: number, color: string) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(w * (x - half), h);
    c.lineTo(w * x, h * top);
    c.lineTo(w * (x + half), h);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(w * x, h * top);
    c.lineTo(w * (x - half * 0.22), h * (top + (1 - top) * 0.22));
    c.lineTo(w * (x + half * 0.22), h * (top + (1 - top) * 0.22));
    c.closePath();
    c.fill();
  };
  peak(0.3, 0.3, 0.42, "#4b6cb7");
  peak(0.72, 0.2, 0.5, "#3a5795");
  hills(c, w, h, 0.86, 0.04, 1, "#2e8b57");
  hills(c, w, h, 0.95, 0.04, 3.3, "#1f6b43");
};

const blossom: Draw = (c, w, h) => {
  c.fillStyle = gradient(c, h, [
    [0, "#ff9a9e"],
    [1, "#fad0c4"],
  ]);
  c.fillRect(0, 0, w, h);
  const dots: [number, number, number, string][] = [
    [0.25, 0.3, 0.2, "#ffffffaa"],
    [0.7, 0.24, 0.14, "#a18cd1cc"],
    [0.58, 0.6, 0.26, "#fbc2ebcc"],
    [0.22, 0.75, 0.16, "#84fab0cc"],
    [0.8, 0.82, 0.12, "#ffffffaa"],
  ];
  for (const [x, y, r, color] of dots) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(w * x, h * y, Math.min(w, h) * r, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#e73c7e";
  c.beginPath();
  c.arc(w * 0.5, h * 0.45, Math.min(w, h) * 0.1, 0, Math.PI * 2);
  c.fill();
};

const desert: Draw = (c, w, h) => {
  c.fillStyle = gradient(c, h, [
    [0, "#00c6fb"],
    [0.6, "#b5f1ff"],
    [1, "#fdf2c0"],
  ]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#fffbe0";
  c.beginPath();
  c.arc(w * 0.2, h * 0.2, Math.min(w, h) * 0.08, 0, Math.PI * 2);
  c.fill();
  hills(c, w, h, 0.7, 0.05, 0.9, "#f6c56f");
  hills(c, w, h, 0.82, 0.06, 2.7, "#e8a04a");
  hills(c, w, h, 0.94, 0.04, 5, "#c97b2e");
  // cacto
  c.fillStyle = "#2f7d4f";
  const u = Math.min(w, h);
  c.fillRect(w * 0.7, h * 0.52, u * 0.045, h * 0.28);
  c.fillRect(w * 0.7 - u * 0.07, h * 0.6, u * 0.07, u * 0.035);
  c.fillRect(w * 0.7 - u * 0.07, h * 0.54, u * 0.035, h * 0.09);
  c.fillRect(w * 0.7 + u * 0.045, h * 0.64, u * 0.07, u * 0.035);
  c.fillRect(w * 0.7 + u * 0.08, h * 0.58, u * 0.035, h * 0.09);
};

/** [desenho, largura, altura] — paisagens e retratos alternados. */
const SCENES: [Draw, number, number][] = [
  [sunset, 640, 427],
  [city, 427, 640],
  [ocean, 640, 427],
  [blossom, 480, 600],
  [mountains, 640, 427],
  [desert, 427, 640],
];

let cache: SampleImage[] | null = null;

/** As imagens de exemplo (desenhadas uma vez). */
export function sampleImages(): SampleImage[] {
  if (cache) return cache;
  cache = SCENES.map(([draw, width, height]) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) draw(ctx, width, height);
    return { canvas, size: { width, height } };
  });
  return cache;
}
