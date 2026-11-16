import { sfxEvents, synthSfx, type SfxEvent, type SfxKind } from "@/engine/audio";

/** Agenda os sons com esta antecedência (s): cobre a folga entre um quadro e outro. */
const LOOKAHEAD_SEC = 0.12;

let shared: AudioContext | null = null;
const buffers = new Map<SfxKind, AudioBuffer>();

/** Um `AudioContext` para todos os efeitos (criado no primeiro uso, depois de um gesto do usuário). */
function context(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  shared ??= new AudioContext({ latencyHint: "interactive" });
  if (shared.state === "suspended") void shared.resume().catch(() => {});
  return shared;
}

function bufferFor(ctx: AudioContext, kind: SfxKind): AudioBuffer {
  let buffer = buffers.get(kind);
  if (!buffer || buffer.sampleRate !== ctx.sampleRate) {
    const clip = synthSfx(kind, ctx.sampleRate);
    buffer = ctx.createBuffer(1, clip.samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(clip.samples);
    buffers.set(kind, buffer);
  }
  return buffer;
}

/** Toca um efeito agora (botão "ouvir" das opções). */
export function playSfx(kind: SfxKind, gain = 1): void {
  const ctx = context();
  if (!ctx) return;
  const node = ctx.createGain();
  node.gain.value = Math.min(1, Math.max(0, gain));
  node.connect(ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = bufferFor(ctx, kind);
  src.connect(node);
  src.onended = () => node.disconnect();
  src.start();
}

/**
 * Efeitos sonoros das transições na prévia. O player chama `tick` a cada quadro; os sons
 * que começam logo adiante são agendados no relógio do áudio, então caem no corte mesmo
 * que um quadro atrase.
 */
export class SfxPlayer {
  private events: SfxEvent[] = [];
  /** Próximo som ainda não agendado. */
  private next = 0;
  private live = new Set<AudioBufferSourceNode>();
  private gain: GainNode | null = null;

  /** Novos cortes (o projeto mudou): recalcula os sons a partir de `t`. */
  setSegments(segments: readonly { startSec: number; sfx?: SfxKind }[], t: number): void {
    this.events = sfxEvents(segments);
    this.rewind(t);
  }

  /** Reposiciona depois de tocar/buscar: só sons que começam de `t` em diante tocam. */
  rewind(t: number): void {
    let i = 0;
    while (i < this.events.length && this.events[i]!.startSec < t - 1e-3) i++;
    this.next = i;
  }

  tick(t: number, volume: number): void {
    if (this.next >= this.events.length || volume <= 0) {
      // Sem som: ainda assim avança, para não tocar tudo de uma vez se o volume voltar.
      while (this.next < this.events.length && this.events[this.next]!.startSec <= t) this.next++;
      return;
    }
    if (this.events[this.next]!.startSec > t + LOOKAHEAD_SEC) return;
    const ctx = context();
    if (!ctx) return;
    if (!this.gain || this.gain.context !== ctx) {
      this.gain = ctx.createGain();
      this.gain.connect(ctx.destination);
    }
    this.gain.gain.value = Math.min(1, volume);
    while (this.next < this.events.length && this.events[this.next]!.startSec <= t + LOOKAHEAD_SEC) {
      const ev = this.events[this.next++]!;
      const src = ctx.createBufferSource();
      src.buffer = bufferFor(ctx, ev.kind);
      src.connect(this.gain);
      src.onended = () => this.live.delete(src);
      this.live.add(src);
      src.start(ctx.currentTime + Math.max(0, ev.startSec - t));
    }
  }

  /** Cala o que estiver tocando ou agendado (pausa, busca). */
  stop(): void {
    for (const src of this.live) {
      try {
        src.stop();
      } catch {
        // já terminou
      }
    }
    this.live.clear();
  }

  dispose(): void {
    this.stop();
    this.gain?.disconnect();
    this.gain = null;
    this.events = [];
  }
}
