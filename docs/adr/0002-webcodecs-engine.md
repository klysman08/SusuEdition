# ADR 0002 — Motor de vídeo: WebCodecs unificado

- Status: aceito
- Data: 2026-11-08

## Contexto
O app precisa compor fotos e vídeos e exportar MP4 até 4K em Windows e Android, com 100+ mídias, sem travar a UI.
Alternativas avaliadas: FFmpeg nativo (sidecar no Windows + fork do ffmpeg-kit no Android) e híbrido.

## Decisão
- Decode/encode via **WebCodecs** (`VideoDecoder`, `VideoEncoder`, `AudioEncoder`), que usa aceleração por hardware da plataforma (Media Foundation / MediaCodec).
- **Mediabunny** para demux e mux MP4.
- Composição em **WebGL2** dentro de **Worker + OffscreenCanvas**.
- Rust responsável por: servir bytes com HTTP Range (`susu://`), thumbnails e cache, decode de áudio (symphonia) e detecção de batidas.

## Consequências
- Mesmo código de render nos dois alvos; APK sem +30–60 MB de FFmpeg; sem questões de licença GPL.
- Suporte a codecs depende do WebView/dispositivo (ex.: HEVC no Windows exige extensão). Mitigação: `isConfigSupported` + aviso; transcodificação nativa fica como opção futura.
- 4K depende do encoder do aparelho: fallback automático para 1080p.
