// Benchmark E2E do import no app nativo (WebView2 via Chrome DevTools Protocol).
// Uso: node scripts/bench/import-bench.mjs <port> <mediaDir> <outDir> <label>  (ver scripts/bench/README.md)
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [port, mediaDir, outDir, label = "run"] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("nenhuma página no WebView");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let seq = 0;
const waiting = new Map();
const errors = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") {
    errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    waiting.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};

await send("Runtime.enable");
await send("Performance.enable");
await evaluate(`location.hash = "#/video-maker"; new Promise(r => setTimeout(r, 1500))`);
await evaluate(`window.__susu ? (window.__susu.store.getState().clear(), 'ok') : 'no hooks'`);

const files = readdirSync(mediaDir)
  .sort()
  .map((f) => path.join(mediaDir, f));

const result = await evaluate(`(async () => {
  const s = window.__susu.store;
  const t0 = performance.now();
  let firstReady = null, firstVisible = null;
  const unsub = s.subscribe((st) => {
    if (firstVisible === null && st.order.length > 0) firstVisible = performance.now() - t0;
    if (firstReady === null && st.order.some((id) => st.items[id].status === "ready")) firstReady = performance.now() - t0;
  });
  await window.__susu.importPaths(${JSON.stringify(files)});
  const total = performance.now() - t0;
  unsub();
  const st = s.getState();
  const status = {};
  const errs = [];
  for (const id of st.order) {
    const it = st.items[id];
    status[it.status] = (status[it.status] || 0) + 1;
    if (it.status === "error") errs.push(it.name + ": " + it.error);
  }
  const imgs = st.order.map((id) => st.items[id]).filter((i) => i.kind === "image");
  const vids = st.order.map((id) => st.items[id]).filter((i) => i.kind === "video");
  return {
    totalMs: Math.round(total),
    firstVisibleMs: Math.round(firstVisible),
    firstReadyMs: Math.round(firstReady),
    items: st.order.length,
    status,
    errors: errs.slice(0, 5),
    rotatedPhotos: imgs.filter((i) => (i.meta?.orientation ?? 1) >= 5).length,
    videoSample: vids.slice(0, 2).map((v) => v.meta),
    undecodable: vids.filter((v) => v.meta?.decodable === false).length,
  };
})()`);

await evaluate(`new Promise(r => setTimeout(r, 1500))`);
const metrics = (await send("Performance.getMetrics")).result.metrics;
const heap = metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(path.join(outDir, `${label}.png`), Buffer.from(shot.result.data, "base64"));

console.log(
  JSON.stringify(
    { label, ...result, jsHeapMB: Math.round(heap / 1048576), consoleErrors: errors.slice(0, 5) },
    null,
    2,
  ),
);
ws.close();
