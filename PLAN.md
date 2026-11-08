# SusuEdition — Plano do Projeto

> App de edição de vídeos e fotos para **Windows 11** e **Android (APK)**, construído com **Tauri v2**.
> Documentos relacionados: [SPEC.md](SPEC.md) (especificações) · [ROADMAP.md](ROADMAP.md) (marcos) · [docs/adr](docs/adr) (decisões de arquitetura).

## 1. Visão

O SusuEdition transforma uma pasta de fotos e vídeos + uma música em um vídeo pronto para redes sociais em poucos toques, e monta colagens de fotos com filtros. Dois módulos:

1. **Video Maker** — aspect ratio, fit/cover, fotos + vídeos, música com recorte, duração total, tempo por foto/vídeo, sincronização com as batidas, áudio original dos vídeos, transições corte/fade.
2. **Photo Collage** — layouts, aspect ratio, margem/espaçamento (0 por padrão), filtros aplicados sobre a colagem.

Princípios:

- **Performance primeiro**: 100+ mídias para gerar um vídeo de 1 min sem travar a UI e sem estourar memória — inclusive em Android intermediário.
- **Um só código para os dois alvos**: mesma UI e mesmo motor de render no Windows e no Android.
- **Elegante e responsivo**: shadcn/ui, dark e light mode, layout desktop (sidebar) e mobile (bottom-nav).
- **Modular**: cada feature isolada, motor de mídia independente de React, testes nas regras de negócio.
- **Privado e offline**: todo processamento local, sem telemetria.

## 2. Decisões principais

| Tema | Decisão | ADR |
| --- | --- | --- |
| Framework | Tauri v2 (Rust + WebView), React 19 + TypeScript + Vite | [0001](docs/adr/0001-tauri-react-stack.md) |
| Motor de vídeo | **WebCodecs unificado** (WebView2 / Android WebView Chromium) + **Mediabunny** (demux/mux MP4) + composição **WebGL2** | [0002](docs/adr/0002-webcodecs-engine.md) |
| Trabalho pesado nativo | Rust: I/O com Range, thumbnails, cache, decode de áudio (symphonia), detecção de batidas | [0002](docs/adr/0002-webcodecs-engine.md) |
| UI | Tailwind v4 + shadcn/ui + lucide; tema dark/light/sistema | [0001](docs/adr/0001-tauri-react-stack.md) |
| Estado | Zustand (+ zundo para undo/redo) | — |
| Idioma | i18next — pt-BR (padrão) + en | — |
| Export | MP4 H.264 + AAC, até **4K 30/60fps** com fallback automático | [0002](docs/adr/0002-webcodecs-engine.md) |
| Releases | GitHub Actions por tag `v*` → `.exe`/`.msi` + `.apk` no GitHub Release | [0003](docs/adr/0003-release-pipeline.md) |

## 3. Arquitetura

```
┌──────────────────────────── WebView (React) ────────────────────────────┐
│  features/  (UI: video-maker, photo-collage, media-library, music, ...) │
│        │ Zustand stores                                                 │
│  engine/  (TS puro, sem React)                                          │
│   ├─ timeline  → regras de duração, beat-sync, segmentos               │
│   ├─ render    → compositor WebGL2 (fit/cover, fade, filtros)          │
│   ├─ decode    → Mediabunny + VideoDecoder, cache de frames            │
│   ├─ audio     → mixagem, fades, AudioEncoder                          │
│   ├─ export    → Worker + OffscreenCanvas + VideoEncoder + mux MP4     │
│   └─ collage   → layouts e geometria                                    │
│  platform/ (wrappers tipados de comandos Tauri — bindings tauri-specta) │
└──────────────┬──────────────────────────────▲───────────────────────────┘
               │ invoke / susu:// (Range)      │ eventos de progresso
┌──────────────▼──────────────── Rust (src-tauri) ────────────────────────┐
│ commands/ media · audio · project · export                              │
│ services/ thumbnails · beat · waveform · cache                          │
│ protocol/ media  (susu://media/<id> com HTTP Range)                     │
│ plugins/tauri-plugin-susu-media (Kotlin: content://, MediaStore, wake)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Pipeline de mídia (estratégia de performance)

1. **Nunca carregar arquivos inteiros no JS.** Um protocolo `susu://media/<id>` registrado em Rust serve bytes com **HTTP Range**: caminhos locais no Windows e `content://` no Android (aberto via `tauri-plugin-fs`, que devolve um descritor do ContentResolver). Mantém até 24 arquivos abertos para não reabrir a cada Range. O Mediabunny lê por ranges.
2. **Import** (implementado no M1):
   - registro rápido (abre o arquivo e lê 64 bytes para detectar o tipo) → itens aparecem na hora como *pendentes*;
   - **fotos em Rust**: dimensões pelo cabeçalho, EXIF (orientação/data), JPEG decodificado já reduzido no domínio DCT (1/2–1/8), thumbnail JPEG de 320 px, N−1 threads puxando de uma fila (termina na ordem da grade);
   - **vídeos em Web Worker** (Mediabunny + WebCodecs, 2–3 workers): duração, rotação, áudio, codec, `canDecode`, thumbnail WebP;
   - **cache em disco** (`<app_cache>/media/{thumbs,meta}`) por `blake3(uri|tamanho|data)`: reabrir é instantâneo;
   - atualizações aplicadas no store em lotes (≈120 ms) e cada tile assina só o próprio item; a grade é **virtualizada** (só as linhas visíveis existem no DOM).
3. **Imagens** decodificadas só quando necessárias, já redimensionadas para a resolução de saída (`createImageBitmap` com `resizeWidth/Height`); orientação EXIF respeitada; **cache LRU** de texturas; pré-carga apenas dos próximos N itens.
4. **Preview** em resolução reduzida (~540p) com pool de no máximo 2–3 decoders (clipe atual + próximo).
5. **Export** em **Worker + OffscreenCanvas**: agendador de frames → `VideoDecoder` (frame-accurate) → composição WebGL → `VideoEncoder` H.264 (`prefer-hardware`, fallback software) com **backpressure** → mux MP4 em **streaming para disco** (chunks enviados ao Rust). Progresso, ETA, cancelamento, checagem de espaço livre e wake lock no Android.
6. **Áudio** mixado em blocos: música recortada + áudio dos vídeos com ganho por clipe + volume da música nos trechos de vídeo; fades; `AudioEncoder` AAC 48 kHz estéreo.

### 3.2 Motor de timeline

Módulo TS puro (`src/engine/timeline`), determinístico e coberto por testes. Recebe mídias, configurações e batidas e devolve **segmentos** consumidos igualmente pelo preview e pelo export. Regras detalhadas em [SPEC.md §2.6](SPEC.md#26-regras-da-timeline).

### 3.3 Detecção de batidas

Rust (`services/audio` + `services/beat`, implementado no M2): Symphonia → mono a **11.025 Hz** em streaming (média por janela, ~8× menos memória que PCM estéreo 44,1 kHz) → envelope de onset (spectral flux, STFT 1024/hop 256 ≈ 43 quadros/s) → BPM por autocorrelação com prioridade log-normal em 120 BPM (evita erros de oitava) → beat tracking por programação dinâmica (Ellis, 2007) → `{bpm, beats[{timeSec, strength}]}` + 4.000 picos de waveform. Resultado em cache (`media/audio/<id>.v1.json`). Uma música de 3 min é analisada em ~0,25 s no desktop.

## 4. Estrutura de pastas

```
SusuEdition/
├─ PLAN.md · SPEC.md · ROADMAP.md · README.md · CHANGELOG.md
├─ docs/adr/                  # decisões de arquitetura
├─ .github/workflows/         # ci.yml, release.yml
├─ scripts/                   # bump-version.mjs, utilitários
├─ src/
│  ├─ app/                    # providers (tema, i18n), layouts, rotas
│  ├─ components/ui/          # componentes shadcn gerados
│  ├─ components/common/      # componentes compartilhados do app
│  ├─ features/               # uma pasta por feature (components/, hooks/, store.ts, index.ts)
│  │  ├─ home/ video-maker/ photo-collage/ media-library/ music/ export/ settings/
│  ├─ engine/                 # motor de mídia sem React
│  │  ├─ timeline/ render/ decode/ audio/ export/ collage/
│  ├─ platform/               # ponte tipada com o Tauri
│  ├─ i18n/locales/           # pt-BR.json, en.json
│  ├─ lib/                    # utilitários genéricos
│  └─ styles/
├─ src-tauri/
│  ├─ src/{main.rs, lib.rs, error.rs, commands/, services/, protocol/}
│  ├─ capabilities/           # permissões desktop/mobile
│  └─ gen/android/            # projeto Android gerado
└─ plugins/tauri-plugin-susu-media/   # plugin nativo (Rust + Kotlin)
```

### Convenções

- Features só importam de `engine/`, `platform/`, `components/` e `lib/` — nunca de outra feature diretamente (exceto via `index.ts` público).
- `engine/` não importa React nem Tauri; recebe dependências por parâmetro (testável no Vitest).
- Strings de UI sempre via i18n.
- Commits no padrão **Conventional Commits** (`feat:`, `fix:`, `perf:`, `chore:` …); versão sincronizada por `scripts/bump-version.mjs`.

## 5. Qualidade

- Frontend: ESLint, Prettier, `tsc --noEmit`, Vitest.
- Rust: `cargo fmt`, `cargo clippy -D warnings`, `cargo test`.
- CI em todo push/PR; release por tag.
- Benchmarks de performance (M7): import de 150 itens, export 1 min 1080p/4K, pico de memória.

## 6. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Codec não suportado pelo WebView (ex.: HEVC sem extensão no Windows) | Detectar com `VideoDecoder.isConfigSupported`, avisar o usuário; roadmap: transcodificação nativa |
| HEIC no Android/Windows | Decodificação nativa (Android `ImageDecoder` / Windows WIC) no roadmap |
| Android mata o app durante export longo | Wake lock + export em blocos + retomada; aviso para manter a tela aberta |
| Memória com fotos de alta resolução | Decodificação redimensionada + LRU + pré-carga limitada |
| Encoder 4K indisponível no aparelho | `VideoEncoder.isConfigSupported` + fallback automático para 1080p |
| Auto-updater não baixa de repositório privado | Updater fica no roadmap (repo público de releases ou servidor próprio) |
