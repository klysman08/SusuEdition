//! Comandos expostos ao frontend via `invoke`.
//!
//! Comandos são finos: validam a entrada e delegam para `services/`.
//!
//! - `app`     — informações do app (M0)
//! - `media`   — registro, processamento e cache de mídias (M1)
//! - `audio`   — waveform e detecção de batidas (M2)
//! - `project` — salvar/abrir/autosave (M7)
//! - `export`  — escrita em streaming do MP4 e salvar na galeria (M4)

pub mod app;
pub mod audio;
pub mod media;
