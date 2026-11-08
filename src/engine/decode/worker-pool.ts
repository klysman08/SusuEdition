/**
 * Pool genérico de Web Workers com fila FIFO. Cada worker processa uma tarefa por vez
 * e responde com uma mensagem contendo o mesmo `id` da requisição.
 */
export interface PoolTask {
  id: string;
}

interface Pending<Res> {
  resolve: (r: Res) => void;
  reject: (e: unknown) => void;
}

export class WorkerPool<Req extends PoolTask, Res extends PoolTask> {
  private readonly idle: Worker[] = [];
  private readonly all: Worker[] = [];
  private readonly queue: { req: Req; transfer?: Transferable[] }[] = [];
  private readonly pending = new Map<string, Pending<Res>>();
  private readonly busy = new Map<Worker, string>();

  constructor(
    private readonly createWorker: () => Worker,
    readonly size: number,
  ) {}

  run(req: Req, transfer?: Transferable[]): Promise<Res> {
    return new Promise<Res>((resolve, reject) => {
      this.pending.set(req.id, { resolve, reject });
      this.queue.push({ req, transfer });
      this.pump();
    });
  }

  /** Remove da fila tarefas ainda não iniciadas. */
  cancel(ids: Iterable<string>): void {
    const set = new Set(ids);
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const id = this.queue[i]!.req.id;
      if (set.has(id)) {
        this.queue.splice(i, 1);
        this.pending.get(id)?.reject(new DOMException("cancelado", "AbortError"));
        this.pending.delete(id);
      }
    }
  }

  get queued(): number {
    return this.queue.length;
  }

  dispose(): void {
    for (const w of this.all) w.terminate();
    this.all.length = 0;
    this.idle.length = 0;
    for (const p of this.pending.values()) p.reject(new DOMException("pool encerrado", "AbortError"));
    this.pending.clear();
    this.queue.length = 0;
  }

  private spawn(): Worker {
    const w = this.createWorker();
    w.onmessage = (e: MessageEvent<Res>) => this.finish(w, e.data.id, (p) => p.resolve(e.data));
    w.onerror = (e) => {
      e.preventDefault();
      const id = this.busy.get(w);
      // Worker quebrado: descarta e cria outro na próxima tarefa.
      this.all.splice(this.all.indexOf(w), 1);
      w.terminate();
      if (id) this.finish(w, id, (p) => p.reject(new Error(e.message || "falha no worker")), false);
    };
    this.all.push(w);
    return w;
  }

  private finish(w: Worker, id: string, settle: (p: Pending<Res>) => void, reuse = true): void {
    this.busy.delete(w);
    const p = this.pending.get(id);
    this.pending.delete(id);
    if (p) settle(p);
    if (reuse) this.idle.push(w);
    this.pump();
  }

  private pump(): void {
    while (this.queue.length > 0) {
      const worker = this.idle.pop() ?? (this.all.length < this.size ? this.spawn() : undefined);
      if (!worker) return;
      const { req, transfer } = this.queue.shift()!;
      this.busy.set(worker, req.id);
      worker.postMessage(req, transfer ?? []);
    }
  }
}
