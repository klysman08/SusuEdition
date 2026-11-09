// Colagem no app nativo: importa as fotos de uma pasta, exporta pela UI e mede.
// Uso: node scripts/bench/collage-bench.mjs <porta> <pasta> <standard|high|max> <jpeg|png> [screenshot.png]
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { connect } from "./cdp.mjs";

const [port = "9333", dir, quality = "max", format = "jpeg", shotFile] = process.argv.slice(2);
if (!dir) {
  console.error("uso: collage-bench.mjs <porta> <pasta> <standard|high|max> <jpeg|png> [screenshot.png]");
  process.exit(1);
}
const photos = readdirSync(dir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .map((f) => resolve(join(dir, f)));

const cdp = await connect(port);
const tab = (label) =>
  cdp.ev(`(async () => {
    const find = () => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
    for (let i = 0; i < 100 && !find(); i++) await new Promise((r) => setTimeout(r, 100));
    find().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    for (let i = 0; i < 50 && !window.__susu && ${JSON.stringify(label)} === 'Fotos'; i++) await new Promise((r) => setTimeout(r, 100));
    return true;
  })()`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Os rótulos procurados abaixo são os do pt-BR.
if ((await cdp.ev(`localStorage.getItem('susu.language')`)) !== "pt-BR") {
  await cdp.ev(`localStorage.setItem('susu.language', 'pt-BR'); location.reload()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
}
await cdp.ev(`location.hash = '#/photo-collage'`);
await sleep(800);
await tab("Fotos");
await sleep(300);
const t0 = Date.now();
await cdp.ev(`window.__susu.importPaths(${JSON.stringify(photos)})`);
await cdp.ev(`(async () => {
  const s = window.__susu.store;
  while (s.getState().progress.done < s.getState().progress.total) await new Promise((r) => setTimeout(r, 50));
})()`);
const importMs = Date.now() - t0;

await tab("Exportar");
await sleep(1500); // prévia carrega as fotos
const labels = { standard: "Padrão", high: "Alta", max: "Máxima" };
await cdp.ev(`(() => {
  const pick = (txt) => [...document.querySelectorAll('[role=radio], button')].find((b) => b.textContent.trim().startsWith(txt))?.click();
  pick(${JSON.stringify(format === "png" ? "PNG" : "JPEG")});
  pick(${JSON.stringify(labels[quality])});
})()`);
await sleep(300);

const result = await cdp.ev(`(async () => {
  const longs = [];
  const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => longs.push(Math.round(e.duration))));
  po.observe({ type: 'longtask' });
  // Fecha o diálogo de uma exportação anterior.
  while (document.querySelector('[role=dialog]')) {
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
  }
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Exportar imagem'));
  const t = performance.now();
  btn.click();
  let text = '';
  while (performance.now() - t < 120000) {
    text = document.querySelector('[role=dialog]')?.textContent ?? '';
    // Ocupado = diálogo com o botão Cancelar; terminado = pronto, erro ou cancelado.
    if (text && !text.includes('Cancelar')) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  po.disconnect();
  return {
    ms: Math.round(performance.now() - t),
    dialog: text.slice(0, 200),
    longTasks: longs,
    heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576),
  };
})()`);

console.log(
  JSON.stringify({ photos: photos.length, importMs, quality, format, ...result, errors: cdp.errors }, null, 2),
);
if (shotFile) await cdp.shot(shotFile);
cdp.close();
