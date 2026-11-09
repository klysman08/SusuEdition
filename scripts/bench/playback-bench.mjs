// Mede fps e tarefas longas durante 30 s de reprodução do preview (ver scripts/bench/README.md).
// Uso: node scripts/bench/playback-bench.mjs <port>
import { connect } from "./cdp.mjs";
const c = await connect(process.argv[2]);
console.log(
  JSON.stringify(
    await c.ev(`(async () => {
  const long = [];
  const obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(Math.round(e.duration))));
  obs.observe({ type: "longtask", buffered: false });
  let frames = 0, worst = 0, last = performance.now();
  let run = true;
  const tick = () => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; frames++; if (run) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__susuPreview.seek(0); window.__susuPreview.play();
  await new Promise(r => setTimeout(r, 30000));
  run = false; window.__susuPreview.pause(); obs.disconnect();
  return { seconds: 30, fps: Math.round(frames / 30), worstFrameMs: Math.round(worst), longTasks: long.length, longest: Math.max(0, ...long), heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576) };
})()`),
  ),
);
console.log("errors:", c.errors);
c.close();
