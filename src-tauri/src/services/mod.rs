//! Lógica nativa, independente do frontend (testável com `cargo test`).
//!
//! - `media_types` — tipos serializados para o frontend
//! - `registry`    — mídias importadas na sessão (`id → caminho/content://`)
//! - `cache`       — thumbnails e metadados em disco
//! - `image`       — EXIF, dimensões e thumbnails de fotos
//! - `jobs`        — fila paralela de processamento
//! - `project`     — projetos salvos (JSON em disco)
//!
//! Planejado: `waveform` e `beat` (M2).

pub mod audio;
pub mod beat;
pub mod cache;
pub mod export;
pub mod image;
pub mod jobs;
pub mod media_types;
pub mod project;
pub mod registry;
