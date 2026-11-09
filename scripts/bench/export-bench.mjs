// Benchmark de exportação no app nativo: importa mídias + música, ajusta e exporta via UI.
// Uso: node export-bench.mjs <port> <mediaDir> <music> <quality 720p|1080p|4K> <fps 30|60> <outPng>
import { readdirSync } from "node:fs";
import path from "node:path";
import { connect } from "./cdp.mjs";
const [port, mediaDir, music, quality = "1080p", fps = "30", outPng] = process.argv.slice(2);
const c = await connect(port);
const tab = (n) =>
  `(() => { const t = [...document.querySelectorAll('[role=tab]')].find(t => t.textContent.includes(${JSON.stringify(n)})); t.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); return new Promise(r => setTimeout(r, 700)); })()`;
const clickText = (sel, text) =>
  `(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`;
await c.ev(`location.hash = "#/video-maker"; new Promise(r => setTimeout(r, 1200))`);
if (process.env.IMPORT !== "0") {
  await c.ev(tab("Mídias"));
  const files = readdirSync(mediaDir)
    .sort()
    .map((f) => path.join(mediaDir, f));
  const t0 = Date.now();
  await c.ev(`window.__susu.store.getState().clear(); window.__susu.importPaths(${JSON.stringify(files)})`);
  console.log("import ms:", Date.now() - t0);
  await c.ev(tab("Música"));
  console.log("music:", await c.ev(`window.__susuMusic.loadPath(${JSON.stringify(music)})`));
  await c.ev(tab("Tempo"));
  await c.ev(clickText("[role=radio]", "Fade"));
  await c.ev(
    `(() => { const k = document.getElementById('keep-video-audio'); if (k && k.getAttribute('aria-checked') !== 'true') k.click(); })()`,
  );
}
await c.ev(tab("Exportar"));
await c.ev(clickText("[role=radio]", quality));
await c.ev(clickText("[role=radio]", fps));
const summary = (await c.ev(`[...document.querySelectorAll('main section')].map(s => s.innerText).join(' || ')`))
  .split("\n")
  .filter(Boolean)
  .join(" | ");
console.log("panel:", summary.slice(0, 400));
await c.ev(clickText("button", "Exportar vídeo"));
const t0 = Date.now();
let text = "";
let maxHeap = 0;
for (;;) {
  await new Promise((r) => setTimeout(r, 1000));
  const s = await c.ev(
    `({ t: document.querySelector('[role=dialog]')?.innerText ?? '', heap: performance.memory.usedJSHeapSize })`,
  );
  text = s.t;
  maxHeap = Math.max(maxHeap, s.heap);
  if (/pronto|ready|Não foi possível|cancelada/i.test(text)) break;
  if (Date.now() - t0 > 20 * 60 * 1000) break;
}
console.log("export wall ms:", Date.now() - t0, "| max JS heap MB:", Math.round(maxHeap / 1048576));
console.log("dialog:", text.replace(/\n+/g, " | "));
if (outPng) await c.shot(outPng);
console.log("errors:", c.errors.slice(0, 5));
c.close();
