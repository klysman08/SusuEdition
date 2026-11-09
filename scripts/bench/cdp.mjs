// Utilitário: avalia expressões e tira screenshots no WebView2 via CDP.
import { writeFileSync } from "node:fs";
export async function connect(port) {
  const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const waiting = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) {
      waiting.get(m.id)(m);
      waiting.delete(m.id);
    } else if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    else if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning"))
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq;
      waiting.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Runtime.enable");
  return {
    errors,
    ev: async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails)
        throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails));
      return r.result?.result?.value;
    },
    shot: async (file) => {
      const s = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(s.result.data, "base64"));
    },
    close: () => ws.close(),
  };
}
