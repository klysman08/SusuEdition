/**
 * Análise da música quando o leitor nativo não abre o arquivo.
 *
 * O WebView decodifica a trilha (Mediabunny ou o decodificador do navegador). Um arquivo
 * de áudio vira uma cópia WAV no cache — daí em diante análise, prévia e exportação usam
 * essa cópia. O áudio de um MP4 (vídeo, ou áudio HE-AAC baixado do Instagram) é só
 * analisado aqui: a prévia e a exportação já leem o original pelo WebView.
 */
import { computePeaks, detectBeats, encodeWav, type AudioAnalysis } from "@/engine/audio";
import { decodeAudioMono, decodeAudioPcm } from "@/engine/decode/decode-audio";
import type { MediaBackend } from "@/platform/media";

/** Mesma taxa e resolução da waveform da análise nativa. */
const ANALYSIS_RATE = 11_025;
const PEAK_BUCKETS = 4000;

export class UndecodableAudioError extends Error {
  constructor() {
    super("formato de áudio não suportado");
  }
}

export async function analyzeAudioWithFallback(
  backend: MediaBackend,
  id: string,
  kind: "audio" | "video",
): Promise<AudioAnalysis> {
  try {
    return await backend.analyzeAudio(id);
  } catch (err) {
    // No navegador a análise já usa o decodificador do WebView: não há reserva.
    if (backend.name !== "tauri") throw err;
    const source = backend.probeSource(id);
    const url = backend.mediaUrl(id);

    if (kind === "audio") {
      const pcm = await decodeAudioPcm(source, url);
      if (!pcm) throw new UndecodableAudioError();
      await backend.storeConverted(id, encodeWav(pcm), "wav");
      return backend.analyzeAudio(id);
    }

    // Vídeo (ou áudio dentro de MP4): só a análise; prévia e exportação leem o original.
    const mono = await decodeAudioMono(source, url, ANALYSIS_RATE);
    if (!mono || mono.samples.length === 0) throw new UndecodableAudioError();
    const analysis: AudioAnalysis = {
      durationSec: mono.samples.length / ANALYSIS_RATE,
      sourceRate: mono.sourceRate,
      channels: mono.channels,
      peaks: computePeaks(mono.samples, PEAK_BUCKETS),
      ...detectBeats(mono.samples, ANALYSIS_RATE),
    };
    await backend.cacheAudioAnalysis(id, analysis).catch(() => {});
    return analysis;
  }
}
