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
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const base = `${m}:${String(whole).padStart(2, "0")}`;
  return tenths ? `${base}.${Math.floor((rest - whole) * 10)}` : base;
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
