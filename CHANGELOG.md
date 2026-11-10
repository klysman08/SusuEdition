# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.7.0] — 2026-11-10 · Editor e ritmo

### Added
- **Estilos de sincronia** com a música (ferramenta Ritmo): Dinâmico (acelera nas partes intensas, respira nas calmas), Constante, Compassos e Acentos, com ajuste de flexibilidade.
- **Mapa da música**: energia, compassos e mudanças de seção (refrão, drop, pausa) calculados a partir das batidas e da waveform; aparecem na faixa abaixo das mídias.
- Detecção de BPM/batidas também no modo navegador (detector em TypeScript).
- Barra de espaço toca/pausa de qualquer lugar do editor; duplo clique numa mídia da faixa abre os ajustes dela; botão "voltar ao início".

### Changed
- **Video Maker virou um editor de tela cheia**: prévia sempre visível, faixa das mídias logo abaixo e barra fixa de ferramentas no rodapé (Mídias, Música, Ritmo, Tempo, Áudio, Formato); a ferramenta aberta fica ao lado da prévia no desktop e abaixo da faixa no celular. Exportar é o botão principal no topo.
- No editor a navegação do app encolhe para um trilho de ícones (desktop) ou some (celular, com botão de voltar).
- A sincronia com as batidas escolhe todos os cortes de uma vez (programação dinâmica) em vez de empurrar cada corte para a batida vizinha, e vem ligada por padrão. O ajuste "desvio máximo" deu lugar a "flexibilidade".

## [0.6.0] — 2026-11-09 · M6 Photo Collage

### Added
- **Photo Collage** em cinco passos: Fotos, Layout, Margens, Filtros e Exportar, com prévia ao vivo (WebGL2) ao lado no desktop e acima no celular.
- **Layouts** para qualquer quantidade de fotos: automático (linhas justificadas pelas proporções das fotos, o mínimo de corte), grade, destaque à esquerda/topo/direita/embaixo e combinações de linhas e colunas; proporções 9:16, 16:9, 4:3, 1:1, 4:5 e 3:4.
- **Margem externa, espaço entre fotos e cantos arredondados** (0 por padrão) e cor de fundo; as medidas escalam com a resolução exportada.
- **Ajuste de cada foto**: toque para selecionar, arraste para reposicionar, zoom por pinça, roda do mouse, slider ou teclado (setas, + e −); **trocar fotos** segurando e arrastando ou pelo botão "Trocar"; redefinir ou remover a foto.
- **Filtros** sobre a colagem inteira: 10 presets (Vívido, Quente, Frio, P&B, Noir, Sépia, Vintage, Dramático, Suave) com miniaturas da sua foto e intensidade, mais ajustes de brilho, contraste, saturação, temperatura, vinheta, P&B, sépia e desbotado.
- **Exportar** JPEG (qualidade 60–100%) ou PNG em Padrão (1080 no lado menor), Alta (2160) ou Máxima (4096 no lado maior), gerado num Worker; salvo em **Imagens/SusuEdition** ou onde você escolher.

### Changed
- Biblioteca de mídias aceita o modo "só fotos" (seletor, arrastar e soltar e mensagens).
- Remover uma mídia só libera o arquivo quando nenhuma outra parte do app (vídeo, colagem, música) ainda o usa.

### Fixed
- Nomes de arquivo exportados aceitam `.jpg`/`.png` (antes tudo virava `.mp4`).

### Performance (Windows, app nativo, resolução máxima 3277×4096)
- 14 fotos de 12 MP → JPEG em 0,87 s; 100 fotos → PNG em 2,3 s / JPEG em 2,5 s. Nenhuma tarefa longa na interface (tudo no Worker), heap JS ≤ 10 MB.

## [0.5.0] — 2026-11-09 · M5 Sincronia com as batidas

### Added
- **Sincronizar com as batidas** (aba Tempo): cada corte vai para a batida mais próxima — batidas fortes têm prioridade — sem passar do desvio máximo escolhido (±0,1 a 2 s). Respeita a duração mínima (0,5 s), o que resta de cada vídeo e mantém a duração total.
- Batidas da música e cortes alinhados desenhados na faixa da timeline; contador de cortes alinhados e BPM.
- Vale para a prévia e para a exportação.

### Fixed
- Diferenças de poucos milissegundos entre o vídeo e o trecho da música não geram mais aviso nem fade-out.

### Verified
- Export 1080p de 30 fotos sincronizado a uma faixa de 124 BPM: trocas de cena a 8 ms em média (máx. 21 ms, < 1 quadro) das batidas reais.

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
