# SusuEdition — Especificações

> Requisitos funcionais (RF), não-funcionais (RNF) e critérios de aceite. Ver também [PLAN.md](PLAN.md) e [ROADMAP.md](ROADMAP.md).

## 1. Geral

| ID | Requisito |
| --- | --- |
| RF-G1 | Plataformas: Windows 11 (x64, instalador NSIS `.exe` e `.msi`) e Android 8.0+ (API 26+, APK arm64-v8a / armeabi-v7a). |
| RF-G2 | Tema **claro, escuro e sistema**, persistido entre sessões. |
| RF-G3 | Idiomas **pt-BR** (padrão) e **en**, alternáveis em Configurações. |
| RF-G4 | Layout responsivo: sidebar em telas ≥ 768px; bottom-nav em telas menores; respeita safe-area no Android. |
| RF-G5 | Projetos salvos localmente, com **autosave** e recuperação após fechamento inesperado. |
| RF-G6 | Desfazer/refazer nas edições de projeto (Ctrl+Z / Ctrl+Shift+Z no desktop). |
| RF-G7 | Nenhum dado sai do dispositivo; sem telemetria. Logs locais apenas. |

## 2. Video Maker

### 2.1 Formato

| ID | Requisito |
| --- | --- |
| RF-V1 | Aspect ratios: **9:16, 16:9, 4:3, 1:1, 4:5, 3:4**. |
| RF-V2 | Modo de enquadramento global (com override por item): **Fit** (contain, com fundo de cor sólida ou **desfocado**), **Cover** (preenche cortando), **Fill** (estica). |
| RF-V3 | Resoluções: 720p, 1080p, **4K** (lado menor 720/1080/2160) × **30 ou 60 fps**. Dimensões sempre pares. |

Resoluções de saída (classe 1080p): 9:16 → 1080×1920 · 16:9 → 1920×1080 · 4:3 → 1440×1080 · 1:1 → 1080×1080 · 4:5 → 1080×1350 · 3:4 → 1080×1440. Classe 4K multiplica por 2.

### 2.2 Mídias

| ID | Requisito |
| --- | --- |
| RF-V4 | Importar várias fotos (JPEG, PNG, WebP; HEIC no roadmap) e vídeos (MP4/MOV H.264; HEVC/VP9/AV1 conforme suporte do dispositivo) de uma vez. |
| RF-V5 | Grade virtualizada com thumbnails, duração dos vídeos e badge de tipo. |
| RF-V6 | Reordenar por arrastar; ordenar por data de captura, nome ou embaralhar; remover itens. |
| RF-V7 | Respeitar orientação EXIF e metadado de rotação dos vídeos. |
| RF-V8 | Por vídeo: ponto de início (trim), **manter áudio original** (liga/desliga) e volume do clipe. |

### 2.3 Música

| ID | Requisito |
| --- | --- |
| RF-V9 | Importar uma música (MP3, AAC/M4A, WAV, OGG, FLAC). |
| RF-V10 | **Antes de aplicar**, o usuário seleciona a faixa de tempo desejada em uma waveform com alças arrastáveis e ouve a seleção. |
| RF-V11 | Batidas detectadas exibidas sobre a waveform; BPM estimado exibido. |
| RF-V12 | Volume da música; **volume da música nos trechos com vídeo** (ducking) ajustável. |

### 2.4 Tempo

| ID | Requisito |
| --- | --- |
| RF-V13 | Duração total do vídeo: **Ajustar à música** (= seleção), **Personalizada** (15s, 30s, 60s ou valor livre) ou **Soma dos itens**. |
| RF-V14 | Tempo por foto (padrão **2s**) e por vídeo (padrão **5s**; se o vídeo for menor, usa sua duração total) configuráveis separadamente, com override por item. |
| RF-V15 | **Se não houver mídia suficiente para a faixa de áudio**, o vídeo termina com a última mídia e a música é cortada nesse ponto com **fade-out de 3 segundos**. |
| RF-V16 | Se houver mídia demais para a duração total: excluir itens excedentes (com aviso listando-os) **ou** "ajustar para caber" (reduz proporcionalmente, mínimo 0,5s por item). |

### 2.5 Sincronização com batidas e transições

| ID | Requisito |
| --- | --- |
| RF-V17 | Opção **Sincronizar com as batidas**: os cortes são movidos para a batida mais próxima, podendo sobrepor a regra de 2s/5s. |
| RF-V18 | O usuário define o **desvio máximo** permitido (ex.: ±1,0s) em relação à duração configurada. Batidas fortes têm prioridade. |
| RF-V19 | Transições: **Corte direto** ou **Fade** (duração configurável, padrão 0,5s). |

### 2.6 Regras da timeline

Entrada: mídias ordenadas, `photoSec`, `videoSec`, overrides, duração total `T`, seleção da música `[in, out]`, batidas, `beatSync {enabled, maxDeviation}`, transição.

1. Duração base: foto = `photoSec`; vídeo = `min(videoSec, duraçãoDoClipe − sourceIn)`; override por item vence.
2. `S = Σ durações`.
3. `S < T` → vídeo termina em `S`; música termina em `S` com fade-out de `min(3s, S)`.
4. `S > T` → excedentes excluídos ou redução proporcional (RF-V16).
5. Beat sync (quando ativo): para cada corte ideal `c`, escolher a batida `b` que maximiza força e minimiza `|b − c|`, com `|b − c| ≤ maxDeviation`, duração resultante ≥ 0,5s e, para vídeos, ≤ duração disponível. Sem batida válida → mantém `c`.
6. Saída: `TimelineSegment {mediaId, start, duration, sourceIn, sourceOut, transitionIn, keepAudio, audioGain}` + `AudioPlan {musicIn, musicOut, fadeOut, duckingGain}`.
7. Função **pura e determinística** — mesmo input, mesmo output.

### 2.7 Preview e export

| ID | Requisito |
| --- | --- |
| RF-V20 | Preview em tempo real em resolução reduzida, com play/pause e scrub. |
| RF-V21 | Export MP4 (H.264 High + AAC-LC 48 kHz estéreo 192 kbps). Bitrate: 720p 6 Mbps, 1080p 12 Mbps, 4K 40 Mbps (×1,5 para 60 fps). |
| RF-V22 | Progresso com ETA e **cancelamento**. |
| RF-V23 | Antes de exportar: checar suporte do encoder (fallback 4K → 1080p com aviso) e espaço livre em disco. |
| RF-V24 | Destino: Windows → `Vídeos/SusuEdition` (ou "Salvar como"); Android → galeria (MediaStore, `Movies/SusuEdition`). |

## 3. Photo Collage

| ID | Requisito |
| --- | --- |
| RF-C1 | Selecionar várias fotos (2 a 20+). |
| RF-C2 | Aspect ratios: 1:1, 4:5, 9:16, 16:9, 4:3, 3:4. |
| RF-C3 | Layouts: templates de grade/mosaico por quantidade + layout automático. |
| RF-C4 | **Margem externa** e **espaçamento interno**, ambos **0 por padrão**; raio de canto; cor de fundo. Medidas em px de uma imagem de 1080 no lado menor, escaladas na exportação (a prévia e o arquivo ficam iguais). |
| RF-C5 | Pan/zoom da foto dentro da célula; trocar fotos de célula arrastando. |
| RF-C6 | **Filtros sobre a colagem**: brilho, contraste, saturação, temperatura, vinheta, P&B, sépia e presets, com intensidade. |
| RF-C7 | Export PNG ou JPEG (qualidade ajustável) até 4096px no lado maior; destino como RF-V24 (`Pictures/SusuEdition`). Resoluções: Padrão (1080 no lado menor), Alta (2160), Máxima (4096 no lado maior), limitadas pela GPU. |

## 4. Requisitos não-funcionais (orçamentos de performance)

Referência: notebook intermediário (4 núcleos, GPU integrada) e Android intermediário (6 GB RAM).

| ID | Requisito | Meta |
| --- | --- | --- |
| RNF-1 | UI responsiva durante import/export | Thread principal sem tarefas > 50 ms; trabalho pesado em Worker/Rust |
| RNF-2 | Import de 150 mídias (100 fotos + 50 vídeos) | Grade interativa < 1s; todos os thumbnails < 20s (desktop) / < 45s (Android) |
| RNF-3 | Thumbnails em cache | Reabrir projeto com 150 itens < 2s |
| RNF-4 | Memória durante export | < 1,5 GB desktop; < 700 MB Android |
| RNF-5 | Export 1 min 1080p30 com encoder por hardware | ≤ 1,5× tempo real desktop; ≤ 3× Android |
| RNF-6 | Arquivos nunca carregados inteiros no JS | Leitura por Range via `susu://` |
| RNF-7 | Tamanho do instalador | Windows < 15 MB; APK < 40 MB |
| RNF-8 | Acessibilidade | Navegação por teclado, foco visível, contraste AA nos dois temas |

## 5. Fora de escopo (v1)

Textos/legendas, stickers, Ken Burns, transições além de corte/fade, edição multi-trilha, iOS, nuvem.
