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
