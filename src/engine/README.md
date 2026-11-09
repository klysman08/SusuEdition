# engine/

Motor de mídia do SusuEdition — **TypeScript puro, sem React e sem Tauri**, para ser testável no Vitest e reutilizável no preview (thread principal) e no export (Web Worker).

| Módulo | Responsabilidade | Marco |
| --- | --- | --- |
| `types.ts` | Tipos de domínio compartilhados | M0 |
| `format/` | Resoluções de saída e bitrates | M0 |
| `timeline/` | Regras de duração, excesso de mídia, fade-out da música | M0/M3 |
| `decode/` | Mediabunny + WebCodecs, cache LRU de frames | M1/M4 |
| `render/` | Compositor WebGL2 (fit/cover, fade) e filtros de cor (GLSL compartilhado) | M3/M6 |
| `audio/` | Mixagem, ducking, fades, AAC | M2–M4 |
| `export/` | Pipeline em Worker, mux MP4 em streaming | M4 |
| `collage/` | Layouts em árvore, enquadramento por célula, renderizador WebGL2 e export PNG/JPEG em Worker | M6 |
