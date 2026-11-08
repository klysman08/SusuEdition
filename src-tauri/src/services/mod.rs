//! Lógica nativa pesada, independente de Tauri sempre que possível (testável com `cargo test`).
//!
//! Planejado:
//! - `cache`      — diretório de cache, chaves `blake3(path+size+mtime)`, limpeza (M1)
//! - `thumbnails` — geração paralela de thumbnails WebP (M1)
//! - `waveform`   — picos de áudio para a UI de recorte (M2)
//! - `beat`       — onset (spectral flux) + BPM + beat tracking (M2)
