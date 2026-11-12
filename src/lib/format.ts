/** 5 → "0:05", 125 → "2:05", 3725 → "1:02:05". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 65.34 → "1:05.3" (com décimos) ou "1:05". */
export function formatTime(sec: number, tenths = true): string {
  // Em décimos inteiros: 1,2 s não pode virar "0:01.1" por erro de ponto flutuante.
  const t = Math.floor(Math.max(0, sec) * 10 + 1e-6);
  const whole = Math.floor(t / 10);
  const base = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  return tenths ? `${base}.${t % 10}` : base;
}

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number, locale?: string): string {
  let v = Math.max(0, bytes);
  let u = 0;
  while (v >= 1024 && u < UNITS.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toLocaleString(locale, { maximumFractionDigits: v < 10 && u > 0 ? 1 : 0 })} ${UNITS[u]}`;
}
