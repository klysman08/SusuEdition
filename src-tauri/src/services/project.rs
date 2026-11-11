//! Projetos salvos: um JSON por projeto em `<app_data_dir>/projects/<id>.json`.
//!
//! O conteúdo pertence ao frontend (formato versionado lá). Aqui só garantimos
//! gravação atômica, ids seguros e a leitura do campo `summary` para a lista.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::error::{AppError, AppResult};

/// Projetos são pequenos (referências + ajustes); isto barra gravações absurdas.
const MAX_PROJECT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct ProjectStore {
    dir: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEntry {
    pub id: String,
    /// Campo `summary` do arquivo; `null` se ausente.
    pub summary: serde_json::Value,
    pub modified_ms: i64,
}

/// Ids vêm do frontend (UUID): só letras, dígitos, `-` e `_` (evita path traversal).
pub fn is_valid_project_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

impl ProjectStore {
    pub fn new(root: &Path) -> AppResult<Self> {
        let dir = root.join("projects");
        fs::create_dir_all(&dir)?;
        Ok(Self { dir })
    }

    fn path(&self, id: &str) -> AppResult<PathBuf> {
        if !is_valid_project_id(id) {
            return Err(AppError::Unsupported(format!(
                "id de projeto inválido: {id}"
            )));
        }
        Ok(self.dir.join(format!("{id}.json")))
    }

    /// Todos os projetos legíveis, do mais recente para o mais antigo.
    pub fn list(&self) -> AppResult<Vec<ProjectEntry>> {
        let mut out = Vec::new();
        for entry in fs::read_dir(&self.dir)? {
            let Ok(entry) = entry else { continue };
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let Some(id) = path.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            if !is_valid_project_id(id) {
                continue;
            }
            let Ok(bytes) = fs::read(&path) else { continue };
            let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
                continue;
            };
            let modified_ms = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            out.push(ProjectEntry {
                id: id.to_string(),
                summary: value
                    .get_mut("summary")
                    .map(serde_json::Value::take)
                    .unwrap_or(serde_json::Value::Null),
                modified_ms,
            });
        }
        out.sort_by_key(|e| std::cmp::Reverse(e.modified_ms));
        Ok(out)
    }

    /// Conteúdo do projeto; `None` se não existir.
    pub fn read(&self, id: &str) -> AppResult<Option<String>> {
        match fs::read_to_string(self.path(id)?) {
            Ok(s) => Ok(Some(s)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Grava de forma atômica (temporário + rename): um fechamento inesperado no meio
    /// do autosave nunca deixa o projeto pela metade.
    pub fn write(&self, id: &str, json: &str) -> AppResult<()> {
        let path = self.path(id)?;
        if json.len() > MAX_PROJECT_BYTES {
            return Err(AppError::Unsupported("projeto grande demais".into()));
        }
        if serde_json::from_str::<serde_json::Value>(json).is_err() {
            return Err(AppError::Unsupported("projeto não é um JSON válido".into()));
        }
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, json.as_bytes())?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        match fs::remove_file(self.path(id)?) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(name: &str) -> (ProjectStore, PathBuf) {
        let root =
            std::env::temp_dir().join(format!("susu-project-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        (ProjectStore::new(&root).unwrap(), root)
    }

    #[test]
    fn validates_ids() {
        assert!(is_valid_project_id("3f2a-9c_B"));
        assert!(is_valid_project_id("0b1e6a52-7d1e-4c3a-9f0e-2a4b5c6d7e8f"));
        assert!(!is_valid_project_id(""));
        assert!(!is_valid_project_id("../x"));
        assert!(!is_valid_project_id("a/b"));
        assert!(!is_valid_project_id("a.json"));
        assert!(!is_valid_project_id(&"a".repeat(65)));
    }

    #[test]
    fn writes_reads_lists_and_deletes() {
        let (s, root) = store("roundtrip");
        assert!(s.read("abc").unwrap().is_none());
        s.write(
            "abc",
            r#"{"version":1,"summary":{"name":"Praia"},"media":[]}"#,
        )
        .unwrap();
        s.write("def", r#"{"version":1}"#).unwrap();
        assert!(s.read("abc").unwrap().unwrap().contains("Praia"));

        let list = s.list().unwrap();
        assert_eq!(list.len(), 2);
        let abc = list.iter().find(|e| e.id == "abc").unwrap();
        assert_eq!(abc.summary["name"], "Praia");
        assert!(
            list.iter()
                .find(|e| e.id == "def")
                .unwrap()
                .summary
                .is_null()
        );

        // Regravar substitui o conteúdo e não deixa temporário para trás.
        s.write("abc", r#"{"version":1,"summary":{"name":"Serra"}}"#)
            .unwrap();
        assert!(s.read("abc").unwrap().unwrap().contains("Serra"));
        assert!(!root.join("projects").join("abc.tmp").exists());

        s.delete("abc").unwrap();
        s.delete("abc").unwrap();
        assert_eq!(s.list().unwrap().len(), 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_bad_ids_and_invalid_json() {
        let (s, root) = store("reject");
        assert!(s.write("../evil", "{}").is_err());
        assert!(s.read("a/b").is_err());
        assert!(s.write("ok", "not json").is_err());
        assert!(s.list().unwrap().is_empty());
        let _ = fs::remove_dir_all(&root);
    }
}
