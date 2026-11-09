//! Arquivos de exportação: o MP4 é escrito primeiro num arquivo temporário (o muxer
//! precisa voltar e corrigir cabeçalhos — escrita posicional), e só no fim é movido
//! ou copiado para o destino escolhido (pasta Vídeos, "Salvar como" ou `content://`).

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::{AppError, AppResult};

struct ExportFile {
    path: PathBuf,
    file: Option<File>,
    bytes: u64,
}

pub struct ExportRegistry {
    dir: PathBuf,
    files: Mutex<HashMap<String, ExportFile>>,
}

fn not_found(id: &str) -> AppError {
    AppError::Unsupported(format!("exportação desconhecida: {id}"))
}

/// Extensões aceitas na saída (vídeo e colagem).
const EXTENSIONS: [&str; 4] = [".mp4", ".jpg", ".jpeg", ".png"];

/// Nome de arquivo seguro (sem separadores de caminho), com extensão de saída
/// conhecida (`.mp4` se não houver).
pub fn sanitize_file_name(name: &str) -> String {
    let base: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let base = base.trim().trim_start_matches('.').to_string();
    let base = if base.is_empty() {
        "SusuEdition".to_string()
    } else {
        base
    };
    let lower = base.to_ascii_lowercase();
    if EXTENSIONS.iter().any(|ext| lower.ends_with(ext)) {
        base
    } else {
        format!("{base}.mp4")
    }
}

/// Caminho livre: `nome.mp4`, `nome (2).mp4`, `nome (3).mp4`…
pub fn unique_path(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let (stem, ext) = file_name.rsplit_once('.').unwrap_or((file_name, "mp4"));
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}).{ext}")))
        .find(|p| !p.exists())
        .expect("sequência infinita")
}

impl ExportRegistry {
    pub fn new(cache_root: &Path) -> AppResult<Self> {
        let dir = cache_root.join("exports");
        // Restos de exportações interrompidas (app fechado no meio) são descartados.
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir)?;
        Ok(Self {
            dir,
            files: Mutex::new(HashMap::new()),
        })
    }

    pub fn temp_dir(&self) -> &Path {
        &self.dir
    }

    pub fn begin(&self) -> AppResult<String> {
        let id = blake3::hash(
            format!(
                "{:?}{:?}",
                std::time::SystemTime::now(),
                std::thread::current().id()
            )
            .as_bytes(),
        )
        .to_hex()[..16]
            .to_string();
        let path = self.dir.join(format!("{id}.mp4"));
        let file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .read(true)
            .write(true)
            .open(&path)?;
        self.files.lock().unwrap().insert(
            id.clone(),
            ExportFile {
                path,
                file: Some(file),
                bytes: 0,
            },
        );
        Ok(id)
    }

    pub fn write(&self, id: &str, position: u64, data: &[u8]) -> AppResult<()> {
        let mut files = self.files.lock().unwrap();
        let entry = files.get_mut(id).ok_or_else(|| not_found(id))?;
        let file = entry.file.as_mut().ok_or_else(|| not_found(id))?;
        file.seek(SeekFrom::Start(position))?;
        file.write_all(data)?;
        entry.bytes = entry.bytes.max(position + data.len() as u64);
        Ok(())
    }

    /// Fecha o arquivo temporário e devolve (caminho, tamanho).
    pub fn finish(&self, id: &str) -> AppResult<(PathBuf, u64)> {
        let mut files = self.files.lock().unwrap();
        let entry = files.get_mut(id).ok_or_else(|| not_found(id))?;
        if let Some(mut f) = entry.file.take() {
            f.flush()?;
            f.sync_all()?;
        }
        Ok((entry.path.clone(), entry.bytes))
    }

    pub fn temp_path(&self, id: &str) -> AppResult<PathBuf> {
        let files = self.files.lock().unwrap();
        files
            .get(id)
            .map(|e| e.path.clone())
            .ok_or_else(|| not_found(id))
    }

    /// Move o temporário para `dest` (renomeia; copia se estiver em outro volume).
    pub fn move_to(&self, id: &str, dest: &Path) -> AppResult<()> {
        let src = self.temp_path(id)?;
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        if fs::rename(&src, dest).is_err() {
            fs::copy(&src, dest)?;
            let _ = fs::remove_file(&src);
        }
        self.files.lock().unwrap().remove(id);
        Ok(())
    }

    /// Remove o registro após uma cópia bem-sucedida feita por outro caminho (ex.: `content://`).
    pub fn forget(&self, id: &str) {
        if let Some(e) = self.files.lock().unwrap().remove(id) {
            let _ = fs::remove_file(e.path);
        }
    }

    pub fn discard(&self, id: &str) {
        if let Some(mut e) = self.files.lock().unwrap().remove(id) {
            drop(e.file.take());
            let _ = fs::remove_file(e.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_sanitized() {
        assert_eq!(sanitize_file_name("Férias 2024"), "Férias 2024.mp4");
        assert_eq!(sanitize_file_name("../../x.mp4"), "_.._x.mp4");
        assert_eq!(sanitize_file_name("a/b\\c:d"), "a_b_c_d.mp4");
        assert_eq!(sanitize_file_name("  "), "SusuEdition.mp4");
        assert_eq!(sanitize_file_name("clip.MP4"), "clip.MP4");
        assert_eq!(sanitize_file_name("colagem.jpg"), "colagem.jpg");
        assert_eq!(sanitize_file_name("colagem.png"), "colagem.png");
        assert_eq!(sanitize_file_name("x.exe"), "x.exe.mp4");
    }

    #[test]
    fn positional_writes_and_move() {
        let root = std::env::temp_dir().join(format!("susu-export-test-{}", std::process::id()));
        let reg = ExportRegistry::new(&root).unwrap();
        let id = reg.begin().unwrap();
        reg.write(&id, 4, b"WXYZ").unwrap();
        reg.write(&id, 0, b"abcd").unwrap();
        let (path, bytes) = reg.finish(&id).unwrap();
        assert_eq!(bytes, 8);
        assert_eq!(fs::read(&path).unwrap(), b"abcdWXYZ");

        let out_dir = root.join("out");
        let first = unique_path(&out_dir, "v.mp4");
        reg.move_to(&id, &first).unwrap();
        assert_eq!(fs::read(&first).unwrap(), b"abcdWXYZ");
        assert!(!path.exists());
        assert_eq!(unique_path(&out_dir, "v.mp4"), out_dir.join("v (2).mp4"));

        let id2 = reg.begin().unwrap();
        let p2 = reg.temp_path(&id2).unwrap();
        reg.discard(&id2);
        assert!(!p2.exists());
        assert!(reg.write(&id2, 0, b"x").is_err());
        let _ = fs::remove_dir_all(root);
    }
}
