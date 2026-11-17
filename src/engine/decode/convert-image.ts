/**
 * Conversão de fotos HEIC/HEIF/AVIF para JPEG, num worker (a decodificação é pesada).
 * O resultado é guardado pelo backend e passa a ser servido no lugar do original.
 */

export type ConvertibleImage = "heif" | "avif";

export interface ConvertImageRequest {
  id: number;
  format: ConvertibleImage;
  blob: Blob;
}

export type ConvertImageResult = { id: number; ok: true; jpeg: Blob } | { id: number; ok: false; error: string };

/** Formato que precisa de conversão, pelo MIME ou pela extensão do nome; `null` = nenhum. */
export function convertibleImage(mime: string | undefined, name = ""): ConvertibleImage | null {
  const m = (mime ?? "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (m === "image/heif" || m === "image/heic" || m === "image/heif-sequence" || ext === "heic" || ext === "heif")
    return "heif";
  if (m === "image/avif" || ext === "avif") return "avif";
  return null;
}

/** Workers simultâneos: cada um usa centenas de MB numa foto de 48 MP. */
const MAX_WORKERS = 2;

type Job = { req: ConvertImageRequest; resolve: (b: Blob) => void; reject: (e: Error) => void };

const workers: Worker[] = [];
const idle: Worker[] = [];
const queue: Job[] = [];
/** Conversão em andamento em cada worker. */
const busy = new Map<Worker, Job>();
let seq = 0;

function spawn(): Worker {
  const w = new Worker(new URL("./convert-image.worker.ts", import.meta.url), {
    type: "module",
    name: "susu-convert-image",
  });
  w.onmessage = (e: MessageEvent<ConvertImageResult>) => {
    const job = busy.get(w);
    busy.delete(w);
    if (job?.req.id === e.data.id) {
      if (e.data.ok) job.resolve(e.data.jpeg);
      else job.reject(new Error(e.data.error));
    }
    idle.push(w);
    pump();
  };
  w.onerror = (e) => {
    // Worker caiu (ex.: falta de memória numa foto enorme): falha a conversão dele e
    // troca por um novo na próxima.
    busy.get(w)?.reject(new Error(e.message || "falha ao converter a foto"));
    busy.delete(w);
    workers.splice(workers.indexOf(w), 1);
    w.terminate();
    pump();
  };
  workers.push(w);
  return w;
}

function pump() {
  while (queue.length > 0) {
    const w = idle.pop() ?? (workers.length < MAX_WORKERS ? spawn() : null);
    if (!w) return;
    const job = queue.shift()!;
    busy.set(w, job);
    w.postMessage(job.req);
  }
}

/** Converte uma foto HEIC/HEIF/AVIF em JPEG (orientação aplicada). */
export function convertImageToJpeg(blob: Blob, format: ConvertibleImage): Promise<Blob> {
  return new Promise((resolve, reject) => {
    queue.push({ req: { id: ++seq, format, blob }, resolve, reject });
    pump();
  });
}
