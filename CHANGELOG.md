# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.4.0] — 2026-11-09 · M4 Exportação

### Added
- Passo **Exportar**: 720p, 1080p ou 4K a 30/60 fps, resolução final, duração, tamanho máximo estimado e destino.
- Exportação em Web Worker: vídeos decodificados quadro a quadro (Mediabunny/WebCodecs), mesma composição WebGL2 do preview, H.264 High por hardware e áudio AAC 48 kHz estéreo (música + som dos vídeos com fades e ducking).
- Fallback automático: se o aparelho não codifica 4K, exporta em 1080p (e avisa); se não há AAC nativo, usa um encoder AAC em WASM.
- MP4 gravado em streaming num temporário pelo Rust (memória constante) e movido para **Vídeos/SusuEdition** ou para onde você escolher; no Android, o local é escolhido no seletor do sistema.
- Progresso com porcentagem, tempo restante e velocidade; cancelar a qualquer momento; tela mantida ligada (quando suportado).
- Abrir o vídeo ou mostrar na pasta ao terminar; checagem de espaço livre antes de começar.

### Performance (Windows, 1 min, 150 mídias importadas)
- 1080p30: 10 s (~6× tempo real), heap JS máx. 24 MB.
- 4K30 com fotos e vídeos misturados: 21 s (~2,8× tempo real), heap JS máx. 40 MB.

## [0.3.0] — 2026-11-09 · M3 Timeline + Preview

### Added
- Passo **Formato**: proporções 9:16, 16:9, 4:3, 1:1, 4:5, 3:4; enquadramento Inteira/Preencher/Esticar; fundo desfocado ou cor.
- Passo **Tempo**: duração total (trecho da música, personalizada ou soma das mídias), tempo por foto e por vídeo, o que fazer com mídia excedente, corte seco ou fade (0,2–2 s), som dos vídeos, volumes da música/vídeos e ducking; resumo com avisos (mídias de fora, música cortada com fade-out de 3 s).
- **Prévia** ao vivo (WebGL2) com play/pausa, barra de posição e faixa da timeline com miniaturas.
- **Ajustes por mídia** (toque numa mídia): início do vídeo, duração própria, enquadramento, manter som e volume.

### Fixed
- `susu://` agora entrega o arquivo inteiro quando não há cabeçalho Range (fotos acima de 8 MB eram cortadas).

### Performance
- Reprodução de 30 s no Windows: ~99 fps (taxa da tela), 2 tarefas longas (~56 ms) nas trocas de vídeo, heap JS de 7 MB.

## [0.2.0] — 2026-11-08 · M2 Música

### Added
- Passo **Música** no Video Maker: escolher a faixa (MP3, M4A/AAC, WAV, OGG, FLAC ou a trilha de áudio de um MP4/MOV).
- Waveform interativa: arrastar alças de início/fim, mover o trecho, tocar fora para levar a borda até lá, ajuste fino de ±0,1 s, atalhos 15/30/60 s/inteira e navegação por teclado.
- Detecção de BPM e batidas em Rust (Symphonia + spectral flux + programação dinâmica), com cache; as batidas aparecem na waveform e as bordas podem "grudar" nelas.
- Seleção inicial inteligente: pula a introdução em silêncio e termina numa batida.
- Prévia do trecho com cursor de reprodução (streaming por HTTP Range).

### Performance
- Música de 3 min: análise em ~0,25 s (cache frio) e 13 ms (cache quente) no desktop.

### Changed
- CI: jobs Rust ~10× mais rápidos (filtro de caminhos, dependências sem otimização, clippy só no Linux); APK de release só para arm64/armv7.

## [0.1.0] — 2026-11-08 · M1 Mídia & I/O

### Added
- Biblioteca de mídias no Video Maker: importar fotos e vídeos (seletor nativo, Photo Picker no Android, arrastar arquivos para a janela).
- Grade virtualizada com thumbnails, duração dos vídeos e numeração; reordenar arrastando (mouse, toque com pressão longa, teclado); ordenar por data/nome, embaralhar; seleção e remoção.
- Protocolo `susu://` em Rust com HTTP Range (arquivos nunca carregados inteiros no WebView); `content://` no Android via `tauri-plugin-fs`.
- Fotos processadas em Rust em paralelo: dimensões pelo cabeçalho, EXIF (orientação e data), thumbnail com decodificação JPEG reduzida.
- Vídeos processados em Web Workers (Mediabunny + WebCodecs): duração, rotação, áudio, codec, suporte a decodificação, data de criação e thumbnail.
- Cache em disco de thumbnails e metadados — reabrir 150 mídias leva ~60 ms.

### Performance (Windows, build release, 100 fotos + 50 vídeos)
- Cache frio: 150 itens prontos em 3,7 s (primeiro item visível em 80 ms).
- Cache quente: 56 ms.

## [0.0.1] — 2026-11-08

### Added
- Plano, especificações, roadmap e ADRs do projeto.
- Base Tauri v2 + React 19 + Vite + Tailwind v4 + shadcn/ui.
- Tema claro/escuro/sistema e idiomas pt-BR/en.
- Shell responsivo (sidebar no desktop, bottom-nav no mobile) e páginas iniciais.
- Motor de timeline (durações, excesso de mídia, fade-out de 3s) com testes.
- CI (lint, typecheck, testes, clippy) e release por tag (Windows `.exe`/`.msi` + Android `.apk`).
