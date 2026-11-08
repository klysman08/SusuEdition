// Carrega uma música no app nativo via CDP e mede a análise (ver scripts/bench/README.md).
// Uso: node scripts/bench/music-bench.mjs <port> <arquivo> <screenshot.png>
import { writeFileSync } from "node:fs";
const [port, file, out] = process.argv.slice(2);
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const waiting = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    waiting.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await ev(`location.hash = "#/video-maker"; new Promise(r => setTimeout(r, 1200))`);
await ev(
  `(async () => { const t = [...document.querySelectorAll('[role=tab]')].find(t => t.textContent.includes('Música')); t.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); t.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); t.click(); await new Promise(r => setTimeout(r, 600)); })()`,
);
const res = await ev(`(async () => {
  const t0 = performance.now();
  const r = await window.__susuMusic.loadPath(${JSON.stringify(file)});
  const ms = Math.round(performance.now() - t0);
  const s = window.__susuMusic.store.getState();
  const a = s.analysis;
  const b = a?.beats ?? [];
  const intervals = b.slice(1).map((x, i) => x.timeSec - b[i].timeSec);
  const mean = intervals.reduce((x, y) => x + y, 0) / Math.max(1, intervals.length);
  return { r, ms, status: s.status, error: s.error, duration: a?.durationSec, bpm: a?.bpm, beats: b.length,
    firstBeat: b[0]?.timeSec, meanInterval: mean, selection: s.selection };
})()`);
await ev(`new Promise(r => setTimeout(r, 800))`);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(JSON.stringify(res, null, 1));
ws.close();
