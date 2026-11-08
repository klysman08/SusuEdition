//! Tipos de mídia compartilhados entre comandos, protocolo e cache.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Image,
    Video,
    Audio,
    Unknown,
}

/// Mídia registrada (ainda sem metadados de conteúdo).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredMedia {
    /// Identificador estável: `blake3(uri|size|mtime)`. Também é a chave de cache.
    pub id: String,
    pub uri: String,
    pub name: String,
    pub kind: MediaKind,
    pub mime: String,
    pub size: u64,
    pub modified_ms: Option<i64>,
}

/// Metadados extraídos do conteúdo (persistidos em cache).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaMeta {
    pub kind: MediaKind,
    /// Dimensões de exibição (rotação/orientação já aplicadas).
    pub width: u32,
    pub height: u32,
    /// Rotação que o renderizador ainda precisa aplicar (vídeos). Fotos: 0 (o thumbnail já sai orientado).
    pub rotation: u16,
    /// Orientação EXIF original (fotos), 1..=8.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orientation: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_sec: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_audio: Option<bool>,
    /// Data de captura em epoch ms (EXIF / metadado do vídeo).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub captured_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    /// O WebView consegue decodificar este vídeo (WebCodecs).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decodable: Option<bool>,
    /// Extensão do thumbnail em cache (`jpg` | `webp`).
    pub thumb_ext: String,
}

/// Evento de progresso do processamento de mídias.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProcessEvent {
    #[serde(rename_all = "camelCase")]
    Done { id: String, meta: MediaMeta },
    #[serde(rename_all = "camelCase")]
    Failed { id: String, error: String },
}

/// Resultado da análise de uma música (persistido em cache).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioAnalysis {
    pub duration_sec: f64,
    pub source_rate: u32,
    pub channels: usize,
    /// Picos normalizados 0..1 para desenhar a waveform.
    pub peaks: Vec<f32>,
    pub bpm: Option<f64>,
    pub beats: Vec<super::beat::Beat>,
}
