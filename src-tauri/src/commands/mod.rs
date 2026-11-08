//! Comandos expostos ao frontend via `invoke`.
//!
//! Um arquivo por domínio. Comandos são finos: validam a entrada e delegam
//! para `services/`, onde fica a lógica testável.
//!
//! - `app`     — informações do app (M0)
//! - `media`   — import, probe, thumbnails (M1)
//! - `audio`   — waveform e detecção de batidas (M2)
//! - `project` — salvar/abrir/autosave (M7)
//! - `export`  — escrita em streaming do MP4 e salvar na galeria (M4)

pub mod app;
