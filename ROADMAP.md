# SusuEdition — Roadmap

> Cada marco termina com CI verde, uma tag de versão e notas no [CHANGELOG.md](CHANGELOG.md). Requisitos citados por ID estão em [SPEC.md](SPEC.md).

## M0 — Fundação · `v0.0.x`
- [x] PLAN.md, SPEC.md, ROADMAP.md e ADRs
- [ ] Repositório privado no GitHub
- [ ] Scaffold Tauri v2 + React + TS + Vite + Tailwind v4 + shadcn/ui
- [ ] Tema dark/light/sistema, i18n pt-BR/en, shell responsivo (sidebar / bottom-nav)
- [ ] Estrutura de módulos (`engine/`, `features/`, `platform/`, Rust `commands/services/protocol`)
- [ ] Lint, typecheck, Vitest, fmt, clippy, cargo test
- [ ] CI (`ci.yml`) e Release por tag (`release.yml`: Windows `.exe/.msi` + Android `.apk`)

## M1 — Mídia & I/O · `v0.1.0`
- [ ] Picker multi-seleção (fotos/vídeos) — RF-V4
- [ ] Protocolo `susu://media` com HTTP Range (Windows + `content://` Android) — RNF-6
- [ ] Probe de metadados em Worker; EXIF/rotação — RF-V7
- [ ] Thumbnails em Rust com cache em disco — RNF-2, RNF-3
- [ ] Biblioteca virtualizada, reordenar, ordenar, remover — RF-V5, RF-V6
- [ ] Benchmark de import com 150 itens

## M2 — Música · `v0.2.0`
- [ ] Import e decode (symphonia) — RF-V9
- [ ] Waveform + seleção de faixa com preview de áudio — RF-V10
- [ ] Detecção de batidas/BPM em Rust com cache — RF-V11

## M3 — Timeline + Preview · `v0.3.0`
- [ ] Aspect ratios e fit/cover/fill/fundo desfocado — RF-V1, RF-V2
- [ ] Motor de timeline (regras §2.6) com testes — RF-V13…RF-V16
- [ ] Compositor WebGL2 + transições corte/fade — RF-V19
- [ ] Preview com play/scrub — RF-V20
- [ ] Áudio dos vídeos + volumes + ducking — RF-V8, RF-V12

## M4 — Export · `v0.4.0`
- [ ] Pipeline WebCodecs em Worker + OffscreenCanvas — RF-V21
- [ ] 720p / 1080p / 4K × 30/60 fps com fallback — RF-V3, RF-V23
- [ ] Mux em streaming para disco, progresso/ETA/cancelar — RF-V22
- [ ] Salvar em Vídeos (Windows) / galeria MediaStore (Android) — RF-V24
- [ ] Benchmark export 1 min — RNF-4, RNF-5

## M5 — Beat sync · `v0.5.0`
- [ ] Snapping de cortes com desvio máximo — RF-V17, RF-V18
- [ ] Visualização de batidas e cortes na timeline

## M6 — Photo Collage · `v0.6.0`
- [ ] Layouts e aspect ratios — RF-C2, RF-C3
- [ ] Margem/espaçamento/raio/fundo — RF-C4
- [ ] Pan/zoom e troca de células — RF-C5
- [ ] Filtros WebGL compartilhados — RF-C6
- [ ] Export PNG/JPEG — RF-C7

## M7 — Polimento · `v1.0.0`
- [ ] Projetos, autosave/recuperação, undo/redo — RF-G5, RF-G6
- [ ] Acessibilidade e atalhos — RNF-8
- [ ] QA em Android real (aparelho intermediário e de entrada)
- [ ] Revisão de tamanho do instalador/APK — RNF-7

## Futuro (pós v1)
- HEIC (Android `ImageDecoder` / Windows WIC)
- Ken Burns em fotos, textos e stickers, mais transições
- Templates de vídeo prontos
- Auto-updater (exige releases públicos ou servidor próprio)
- Filtros por foto na colagem, LUTs
