//! Cache em disco de thumbnails e metadados, indexado pelo id da mídia.
//!
//! Layout: `<app_cache_dir>/media/{thumbs,meta}/<id>.<ext>`

use std::fs;
use std::path::{Path, PathBuf};

use super::media_types::{AudioAnalysis, MediaMeta};
use crate::error::AppResult;

#[derive(Debug, Clone)]
pub struct MediaCache {
    thumbs: PathBuf,
    meta: PathBuf,
    audio: PathBuf,
}

/// Versão do formato da análise de áudio: mudar o algoritmo invalida o cache antigo.
const AUDIO_ANALYSIS_VERSION: u32 = 1;

/// Ids são hex gerados por nós; qualquer outra coisa é rejeitada (evita path traversal).
pub fn is_valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_hexdigit())
}

fn is_valid_ext(ext: &str) -> bool {
    matches!(ext, "jpg" | "webp" | "png")
}

impl MediaCache {
    pub fn new(root: &Path) -> AppResult<Self> {
        let thumbs = root.join("media").join("thumbs");
        let meta = root.join("media").join("meta");
        let audio = root.join("media").join("audio");
        fs::create_dir_all(&thumbs)?;
        fs::create_dir_all(&meta)?;
        fs::create_dir_all(&audio)?;
        Ok(Self {
            thumbs,
            meta,
            audio,
        })
    }

    pub fn get_meta(&self, id: &str) -> Option<MediaMeta> {
        if !is_valid_id(id) {
            return None;
        }
        let bytes = fs::read(self.meta.join(format!("{id}.json"))).ok()?;
        let meta: MediaMeta = serde_json::from_slice(&bytes).ok()?;
        // Só vale se o thumbnail também existir.
        self.thumb_path(id, &meta.thumb_ext)
            .filter(|p| p.exists())
            .map(|_| meta)
    }

    /// Grava thumbnail e metadados. O thumbnail é gravado primeiro: metadados
    /// existentes sempre apontam para um thumbnail completo.
    pub fn put(&self, id: &str, meta: &MediaMeta, thumb: &[u8]) -> AppResult<()> {
        let Some(thumb_path) = self.thumb_path(id, &meta.thumb_ext) else {
            return Err(crate::error::AppError::Unsupported(format!(
                "cache key inválida: {id}"
            )));
        };
        write_atomic(&thumb_path, thumb)?;
        let json = serde_json::to_vec(meta).expect("MediaMeta é serializável");
        write_atomic(&self.meta.join(format!("{id}.json")), &json)?;
        Ok(())
    }

    fn audio_path(&self, id: &str) -> Option<PathBuf> {
        is_valid_id(id).then(|| {
            self.audio
                .join(format!("{id}.v{AUDIO_ANALYSIS_VERSION}.json"))
        })
    }

    pub fn get_audio(&self, id: &str) -> Option<AudioAnalysis> {
        let bytes = fs::read(self.audio_path(id)?).ok()?;
        serde_json::from_slice(&bytes).ok()
    }

    pub fn put_audio(&self, id: &str, analysis: &AudioAnalysis) -> AppResult<()> {
        let Some(path) = self.audio_path(id) else {
            return Err(crate::error::AppError::Unsupported(format!(
                "cache key inválida: {id}"
            )));
        };
        let json = serde_json::to_vec(analysis).expect("AudioAnalysis é serializável");
        write_atomic(&path, &json)?;
        Ok(())
    }

    pub fn thumb_path(&self, id: &str, ext: &str) -> Option<PathBuf> {
        (is_valid_id(id) && is_valid_ext(ext)).then(|| self.thumbs.join(format!("{id}.{ext}")))
    }

    /// Procura o thumbnail de um id em qualquer extensão suportada.
    pub fn find_thumb(&self, id: &str) -> Option<(PathBuf, &'static str)> {
        for (ext, mime) in [
            ("jpg", "image/jpeg"),
            ("webp", "image/webp"),
            ("png", "image/png"),
        ] {
            if let Some(p) = self.thumb_path(id, ext).filter(|p| p.exists()) {
                return Some((p, mime));
            }
        }
        None
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::media_types::MediaKind;

    fn meta() -> MediaMeta {
        MediaMeta {
            kind: MediaKind::Image,
            width: 4000,
            height: 3000,
            rotation: 0,
            orientation: Some(1),
            duration_sec: None,
            has_audio: None,
            captured_at: None,
            codec: None,
            decodable: None,
            thumb_ext: "jpg".into(),
        }
    }

    #[test]
    fn roundtrip_and_validation() {
        let dir = std::env::temp_dir().join(format!("susu-cache-test-{}", std::process::id()));
        let cache = MediaCache::new(&dir).unwrap();
        assert!(cache.get_meta("abc123").is_none());
        cache.put("abc123", &meta(), b"jpegbytes").unwrap();
        assert_eq!(cache.get_meta("abc123"), Some(meta()));
        assert_eq!(cache.find_thumb("abc123").unwrap().1, "image/jpeg");
        // ids inválidos nunca viram caminhos
        assert!(cache.thumb_path("../etc/passwd", "jpg").is_none());
        assert!(cache.thumb_path("abc123", "exe").is_none());
        assert!(cache.put("../x", &meta(), b"").is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
