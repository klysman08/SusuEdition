# Benchmarks

Medem o import de mídias no **app nativo** (WebView2 controlado via Chrome DevTools Protocol).

1. Gere as mídias de teste (fora do repositório):
   ```bash
   python scripts/bench/gen-media.py ../susu-bench-media
   ```
2. Compile o app com os ganchos de depuração (`window.__susu`):
   ```bash
   VITE_SUSU_DEBUG=1 pnpm tauri build --no-bundle
   ```
3. Abra o app com a porta de depuração do WebView2 (PowerShell):
   ```powershell
   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9333"
   ./src-tauri/target/release/susuedition.exe
   ```
4. Rode o benchmark (cache frio: apague antes `%LOCALAPPDATA%\com.klysman.susuedition\media`):
   ```bash
   node scripts/bench/import-bench.mjs 9333 ../susu-bench-media . cold
   ```

Saída: tempo total, primeiro item visível, primeira miniatura, status por item, heap JS e um screenshot (`<label>.png`).

| Data | Máquina | Cenário | Frio | Quente |
| --- | --- | --- | --- | --- |
| 2026-11-08 | Windows 11, desktop | 100 fotos + 50 vídeos (479 MB) | 3,7 s | 56 ms |

## Música

```bash
node scripts/bench/music-bench.mjs 9333 caminho/para/musica.mp3 musica.png
```

| Data | Máquina | Arquivo | Frio | Quente | Resultado |
| --- | --- | --- | --- | --- | --- |
| 2026-11-08 | Windows 11, desktop | MP3 sintético 3 min, 124 BPM | 243 ms | 13 ms | 123,6 BPM, 362 batidas |

## Reprodução do preview

Com mídias e música já carregadas no Video Maker (aba Formato ou Tempo):

```bash
node scripts/bench/playback-bench.mjs 9333
```

| Data | Máquina | Cenário | fps | Pior quadro | Tarefas longas | Heap JS |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-09 | Windows 11, desktop (tela 100 Hz) | 12 fotos + 3 vídeos, fundo desfocado | 99 | 65 ms | 2 (máx. 56 ms) | 7 MB |

## Exportação

Importa todas as mídias da pasta + a música, liga fade e som dos vídeos, e exporta pela UI:

```bash
node scripts/bench/export-bench.mjs 9333 ../susu-bench-media musica.mp3 1080p 30 export.png
```

Com `IMPORT=0` reaproveita o projeto já aberto (só troca a qualidade e exporta).

| Data | Máquina | Cenário | Tempo | Arquivo | Heap JS máx. |
| --- | --- | --- | --- | --- | --- |
| 2026-11-09 | Windows 11, desktop | 1 min, 1080p30, só fotos | 10 s | 29 MB | 24 MB |
| 2026-11-09 | Windows 11, desktop | 1 min, 4K30, fotos + vídeos | 21 s | 191 MB | 40 MB |

## Colagem

Importa as fotos da pasta na Photo Collage e exporta pela UI (rótulos em pt-BR; o script ajusta o idioma):

```bash
node scripts/bench/collage-bench.mjs 9333 ../susu-bench-media max jpeg colagem.png
```

| Data | Máquina | Cenário | Saída | Tempo | Tarefas longas | Heap JS |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-09 | Windows 11, desktop | 14 fotos (12 MP, 2 com EXIF girado), layout auto | JPEG 3277×4096 | 0,87 s | 0 | 8 MB |
| 2026-11-09 | Windows 11, desktop | 100 fotos (60 × 12 MP) | PNG 3277×4096 | 2,3 s | 0 | 10 MB |
| 2026-11-09 | Windows 11, desktop | 100 fotos (60 × 12 MP) | JPEG 3277×4096 | 2,5 s | 0 | 10 MB |
