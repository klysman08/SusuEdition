# SusuEdition — Roadmap

> Cada marco termina com CI verde, uma tag de versão e notas no [CHANGELOG.md](CHANGELOG.md). Requisitos citados por ID estão em [SPEC.md](SPEC.md).

## M0 — Fundação · `v0.0.x`
- [x] PLAN.md, SPEC.md, ROADMAP.md e ADRs
- [x] Repositório privado no GitHub
- [x] Scaffold Tauri v2 + React + TS + Vite + Tailwind v4 + shadcn/ui
- [x] Tema dark/light/sistema, i18n pt-BR/en, shell responsivo (sidebar / bottom-nav)
- [x] Estrutura de módulos (`engine/`, `features/`, `platform/`, Rust `commands/services/protocol`)
- [x] Lint, typecheck, Vitest, fmt, clippy, cargo test
- [x] Motor de timeline: durações, excesso de mídia (drop/fit), fade-out de 3s (testado)
- [x] CI (`ci.yml`) e Release por tag (`release.yml`: Windows `.exe/.msi` + Android `.apk`)

## M1 — Mídia & I/O · `v0.1.0`
- [x] Picker multi-seleção (fotos/vídeos; Photo Picker no Android) e arrastar arquivos para a janela — RF-V4
- [x] Protocolo `susu://media` com HTTP Range; `content://` lido via `tauri-plugin-fs` (sem Kotlin próprio) — RNF-6
- [x] Fotos em Rust: dimensões pelo cabeçalho, EXIF (orientação/data), thumbnail com decodificação JPEG reduzida (DCT) — RF-V7
- [x] Vídeos em Web Worker (Mediabunny): duração, rotação, áudio, codec, suporte a decodificação, thumbnail
- [x] Cache em disco de thumbnails + metadados por `blake3(uri|tamanho|data)` — RNF-2, RNF-3
- [x] Biblioteca virtualizada, reordenar (mouse, toque com pressão longa, teclado), ordenar, embaralhar, seleção/remoção — RF-V5, RF-V6
- [x] Benchmark de import com 150 itens (100 fotos + 50 vídeos) no app nativo
- [ ] Validar no Android real (Photo Picker + `content://`) — depende do APK do CI

> Movidos para o M4 (export): plugin nativo `tauri-plugin-susu-media` (MediaStore, wake lock) e versionar `src-tauri/gen/android` (exige Android SDK local).

## M2 — Música · `v0.2.0`
- [x] Import e decode (Symphonia: MP3, M4A/AAC, WAV, OGG, FLAC e trilha de áudio de MP4/MOV) — RF-V9
- [x] Waveform + seleção do trecho (alças, arrastar, ±0,1 s, 15/30/60 s/inteira) com prévia de áudio — RF-V10
- [x] Detecção de batidas/BPM em Rust com cache; "alinhar às batidas" ao ajustar o trecho — RF-V11
- [ ] Validar com músicas reais variadas (gêneros, BPM lento/rápido) e no Android

## M3 — Timeline + Preview · `v0.3.0`
- [x] Aspect ratios e fit/cover/fill/fundo desfocado ou cor — RF-V1, RF-V2
- [x] Passo Tempo: duração total (música/personalizada/soma), tempo por foto/vídeo, excesso (deixar de fora/encurtar) — RF-V13…RF-V16
- [x] Compositor WebGL2 + transições corte/fade (fade centrado no corte, mistura exata via framebuffer) — RF-V19
- [x] Preview com play/scrub e faixa da timeline — RF-V20
- [x] Áudio dos vídeos + volumes + ducking; ajustes por mídia (início, duração, enquadramento, som, volume) — RF-V8, RF-V12
- [ ] Validar o preview no Android (WebView + `content://` em `<video>`)

## M4 — Export · `v0.4.0`
- [x] Pipeline em Worker + OffscreenCanvas: Mediabunny (decodificação frame-accurate) + compositor WebGL2 do preview + H.264 — RF-V21
- [x] Áudio mixado em blocos de 1 s (música, som dos vídeos, fades, ducking) → AAC 48 kHz; encoder AAC em WASM quando o WebView não tem — RF-V21
- [x] 720p / 1080p / 4K × 30/60 fps com fallback automático de qualidade — RF-V3, RF-V23
- [x] Mux em streaming para um temporário (escrita posicional em Rust), progresso/ETA/velocidade/cancelar; checagem de espaço livre — RF-V22, RF-V23
- [x] Destino: Vídeos/SusuEdition (Windows) ou "Salvar como"; no Android o usuário escolhe o local (SAF, `content://`) — RF-V24
- [x] Benchmark export 1 min (Windows): 1080p30 em 10 s, 4K30 em 21 s — RNF-4, RNF-5
- [ ] Validar a exportação no Android real (encoder de hardware, AAC, salvar via SAF)
- [ ] Plugin nativo `plugins/tauri-plugin-susu-media` (Kotlin): salvar direto na galeria (MediaStore) e nome real de `content://`
- [ ] Versionar `src-tauri/gen/android`

## M5 — Beat sync · `v0.5.0`
- [x] Cortes alinhados à batida mais próxima (fortes têm prioridade) dentro do desvio máximo configurável (±0,1–2 s), respeitando duração mínima e o que resta de cada vídeo — RF-V17, RF-V18
- [x] Batidas e cortes alinhados na faixa da timeline; contador "X de Y cortes nas batidas"
- [x] Validado no export: trocas de cena a 8 ms (média) das batidas reais
- [ ] Testar com músicas reais (gêneros variados) e ajustar pesos força × distância

## M6 — Photo Collage · `v0.6.0`
- [x] Layouts e aspect ratios: automático (linhas justificadas pelas proporções), grade, destaque (4 lados) e linhas/colunas por quantidade — RF-C2, RF-C3
- [x] Margem/espaçamento/raio/fundo (0 por padrão, escalam com a resolução) — RF-C4
- [x] Pan/zoom (arrastar, pinça, roda, slider, teclado) e troca de células (segurar e arrastar ou "Trocar") — RF-C5
- [x] Filtros WebGL (`engine/render/filters`): 10 presets com intensidade + 8 ajustes — RF-C6
- [x] Export PNG/JPEG em Worker até 4096 px, `Imagens/SusuEdition` ou "Salvar como" — RF-C7
- [x] Usar os mesmos filtros no Video Maker (aba Filtros, M7)

## M7 — Polimento · `v1.0.0`
- [x] Projetos com autosave: o arquivo guarda os caminhos das mídias (nada é copiado) e os ajustes; recentes no Início — RF-G5
- [x] Timeline: faixa de áudio com waveform e batidas, altura ajustável, zoom e régua
- [x] Ajuste manual: selecionar mídia, arrastar cortes (imã nas batidas), mover, recortar vídeo em modal; duração manual travada na sincronia
- [x] Filtro global no vídeo (prévia e exportação) e prévia maior no celular
- [x] Desfazer/refazer (Ctrl+Z) — RF-G6
- [x] Dividir mídia no cursor, filtro/movimento (Ken Burns)/transição por mídia, marcadores manuais na música
- [x] Localizar arquivo ausente e duplicar projeto
- [ ] Projetos da colagem; reabrir mídias `content://` no Android (permissão persistente no plugin nativo)
- [ ] Acessibilidade e atalhos — RNF-8
- [ ] QA em Android real (aparelho intermediário e de entrada)
- [ ] Revisão de tamanho do instalador/APK — RNF-7

## Futuro (pós v1)
- HEIC (Android `ImageDecoder` / Windows WIC)
- Textos e stickers, mais transições
- Templates de vídeo prontos
- Auto-updater (exige releases públicos ou servidor próprio)
- Filtros por foto na colagem, LUTs
