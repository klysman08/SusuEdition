//! Registro das mídias importadas na sessão: `id → origem` (caminho local ou `content://`).
//!
//! O frontend nunca recebe acesso direto ao sistema de arquivos: ele só conhece
//! ids, e os bytes são servidos pelo protocolo `susu://` a partir deste registro.

use std::collections::{HashMap, VecDeque};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::str::FromStr;
use std::sync::{Arc, Mutex, RwLock};
use std::time::UNIX_EPOCH;

use tauri::{AppHandle, Runtime};
use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

use super::media_types::{MediaKind, RegisteredMedia};
use crate::error::{AppError, AppResult};

/// Máximo de arquivos mantidos abertos para o protocolo (evita reabrir a cada Range;
/// no Android cada abertura passa pelo ContentResolver).
const MAX_OPEN_FILES: usize = 24;

#[derive(Debug)]
pub struct Entry {
    pub uri: String,
    pub path: FilePath,
    pub mime: String,
    pub kind: MediaKind,
    pub size: u64,
}

#[derive(Default)]
pub struct MediaRegistry {
    entries: RwLock<HashMap<String, Arc<Entry>>>,
    open_files: Mutex<OpenFiles>,
}

#[derive(Default)]
struct OpenFiles {
    map: HashMap<String, Arc<Mutex<File>>>,
    order: VecDeque<String>,
}

pub fn media_id(uri: &str, size: u64, modified_ms: Option<i64>) -> String {
    let mut h = blake3::Hasher::new();
    h.update(uri.as_bytes());
    h.update(b"|");
    h.update(&size.to_le_bytes());
    h.update(b"|");
    h.update(&modified_ms.unwrap_or(0).to_le_bytes());
    h.finalize().to_hex()[..32].to_string()
}

/// Nome amigável a partir de um caminho ou URI (`content://…/image%3A12` → `image:12`).
pub fn display_name(uri: &str) -> String {
    let last = uri
        .rsplit(['/', '\\'])
        .find(|s| !s.is_empty())
        .unwrap_or(uri);
    percent_encoding::percent_decode_str(last)
        .decode_utf8_lossy()
        .into_owned()
}

/// Detecta o tipo pelo conteúdo (URIs `content://` não têm extensão confiável),
/// com fallback pela extensão do nome.
pub fn sniff_kind(header: &[u8], name: &str) -> (MediaKind, String) {
    if let Some(t) = infer::get(header) {
        let kind = match t.matcher_type() {
            infer::MatcherType::Image => MediaKind::Image,
            infer::MatcherType::Video => MediaKind::Video,
            _ => MediaKind::Unknown,
        };
        if kind != MediaKind::Unknown {
            return (kind, t.mime_type().to_string());
        }
    }
    let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => (MediaKind::Image, "image/jpeg".into()),
        "png" => (MediaKind::Image, "image/png".into()),
        "webp" => (MediaKind::Image, "image/webp".into()),
        "gif" => (MediaKind::Image, "image/gif".into()),
        "heic" | "heif" => (MediaKind::Image, "image/heif".into()),
        "mp4" | "m4v" => (MediaKind::Video, "video/mp4".into()),
        "mov" => (MediaKind::Video, "video/quicktime".into()),
        "webm" => (MediaKind::Video, "video/webm".into()),
        "mkv" => (MediaKind::Video, "video/x-matroska".into()),
        _ => (MediaKind::Unknown, "application/octet-stream".into()),
    }
}

impl MediaRegistry {
    fn open_path<R: Runtime>(app: &AppHandle<R>, path: &FilePath) -> std::io::Result<File> {
        let mut opts = OpenOptions::new();
        opts.read(true);
        app.fs().open(path.clone(), opts)
    }

    /// Registra uma mídia a partir de um caminho/URI devolvido pelo seletor de arquivos.
    pub fn register<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        uri: &str,
    ) -> AppResult<RegisteredMedia> {
        let path = FilePath::from_str(uri).expect("FilePath::from_str é infalível");
        let mut file = Self::open_path(app, &path)?;
        let meta = file.metadata()?;
        let size = meta.len();
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64);

        let mut header = [0u8; 64];
        let n = read_up_to(&mut file, &mut header)?;
        let name = display_name(uri);
        let (kind, mime) = sniff_kind(&header[..n], &name);

        let id = media_id(uri, size, modified_ms);
        let entry = Arc::new(Entry {
            uri: uri.to_string(),
            path,
            mime: mime.clone(),
            kind,
            size,
        });
        self.entries.write().unwrap().insert(id.clone(), entry);

        Ok(RegisteredMedia {
            id,
            uri: uri.to_string(),
            name,
            kind,
            mime,
            size,
            modified_ms,
        })
    }

    pub fn get(&self, id: &str) -> Option<Arc<Entry>> {
        self.entries.read().unwrap().get(id).cloned()
    }

    pub fn entry(&self, id: &str) -> AppResult<Arc<Entry>> {
        self.get(id)
            .ok_or_else(|| AppError::MediaNotFound(id.to_string()))
    }

    pub fn unregister(&self, ids: &[String]) {
        let mut entries = self.entries.write().unwrap();
        let mut open = self.open_files.lock().unwrap();
        for id in ids {
            entries.remove(id);
            open.map.remove(id);
            open.order.retain(|x| x != id);
        }
    }

    /// Abre um novo handle (uso exclusivo do chamador, ex.: geração de thumbnail).
    pub fn open_new<R: Runtime>(&self, app: &AppHandle<R>, id: &str) -> AppResult<File> {
        let entry = self.entry(id)?;
        Ok(Self::open_path(app, &entry.path)?)
    }

    /// Lê `len` bytes a partir de `offset` usando o cache de arquivos abertos.
    pub fn read_range<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        id: &str,
        offset: u64,
        len: usize,
    ) -> AppResult<Vec<u8>> {
        let handle = self.shared_handle(app, id)?;
        let mut file = handle.lock().unwrap();
        file.seek(SeekFrom::Start(offset))?;
        let mut buf = vec![0u8; len];
        let n = read_up_to(&mut *file, &mut buf)?;
        buf.truncate(n);
        Ok(buf)
    }

    fn shared_handle<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        id: &str,
    ) -> AppResult<Arc<Mutex<File>>> {
        if let Some(h) = self.open_files.lock().unwrap().map.get(id) {
            return Ok(h.clone());
        }
        let file = Arc::new(Mutex::new(self.open_new(app, id)?));
        let mut open = self.open_files.lock().unwrap();
        open.map.insert(id.to_string(), file.clone());
        open.order.push_back(id.to_string());
        while open.order.len() > MAX_OPEN_FILES {
            if let Some(old) = open.order.pop_front() {
                open.map.remove(&old);
            }
        }
        Ok(file)
    }
}

/// Como `read_exact`, mas aceita EOF antes de encher o buffer.
fn read_up_to<R: Read + ?Sized>(r: &mut R, buf: &mut [u8]) -> std::io::Result<usize> {
    let mut total = 0;
    while total < buf.len() {
        match r.read(&mut buf[total..]) {
            Ok(0) => break,
            Ok(n) => total += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_stable_and_distinct() {
        let a = media_id("C:\\a.jpg", 10, Some(1));
        assert_eq!(a, media_id("C:\\a.jpg", 10, Some(1)));
        assert_ne!(a, media_id("C:\\a.jpg", 11, Some(1)));
        assert_eq!(a.len(), 32);
    }

    #[test]
    fn names_from_paths_and_content_uris() {
        assert_eq!(display_name("C:\\fotos\\praia.jpg"), "praia.jpg");
        assert_eq!(display_name("/sdcard/DCIM/v.mp4"), "v.mp4");
        assert_eq!(
            display_name("content://com.android.providers.media.documents/document/image%3A1234"),
            "image:1234"
        );
    }

    #[test]
    fn sniffs_by_content_then_extension() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, b'J', b'F', b'I', b'F'];
        assert_eq!(sniff_kind(&jpeg, "x").0, MediaKind::Image);
        let mp4 = [
            0, 0, 0, 0x18, b'f', b't', b'y', b'p', b'i', b's', b'o', b'm', 0, 0, 0, 0,
        ];
        assert_eq!(sniff_kind(&mp4, "content://x/1").0, MediaKind::Video);
        assert_eq!(sniff_kind(&[], "clip.MOV").1, "video/quicktime");
        assert_eq!(sniff_kind(&[], "doc.pdf").0, MediaKind::Unknown);
    }
}
