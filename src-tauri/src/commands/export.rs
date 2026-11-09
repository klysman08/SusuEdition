//! Comandos de exportação: o WebView envia os bytes do MP4 em pedaços (escrita
//! posicional num temporário) e, no fim, o arquivo vai para o destino final.

use std::io::Write;
use std::str::FromStr;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

use crate::error::{AppError, AppResult};
use crate::services::export::{ExportRegistry, sanitize_file_name, unique_path};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportInfo {
    /// Espaço livre onde o temporário é escrito.
    pub free_bytes: Option<u64>,
    /// Pasta padrão de destino (desktop). `None` no celular: o usuário escolhe ao salvar.
    pub default_dir: Option<String>,
}

fn default_dir<R: Runtime>(app: &AppHandle<R>) -> Option<std::path::PathBuf> {
    if cfg!(mobile) {
        return None;
    }
    app.path().video_dir().ok().map(|d| d.join("SusuEdition"))
}

#[tauri::command]
pub fn export_info<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ExportRegistry>,
) -> ExportInfo {
    ExportInfo {
        free_bytes: fs4::available_space(registry.temp_dir()).ok(),
        default_dir: default_dir(&app).map(|d| d.to_string_lossy().into_owned()),
    }
}

#[tauri::command]
pub fn export_begin(registry: State<'_, ExportRegistry>) -> AppResult<String> {
    registry.begin()
}

/// Corpo: bytes. Cabeçalhos: `x-export-id`, `x-position`.
#[tauri::command]
pub fn export_write(registry: State<'_, ExportRegistry>, request: Request<'_>) -> AppResult<()> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unsupported(format!("cabeçalho ausente: {name}")))
    };
    let id = header("x-export-id")?;
    let position: u64 = header("x-position")?
        .parse()
        .map_err(|_| AppError::Unsupported("x-position inválido".into()))?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::Unsupported("corpo deve ser binário".into()));
    };
    registry.write(id, position, bytes)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinishedExport {
    pub temp_path: String,
    pub bytes: u64,
}

#[tauri::command]
pub fn export_finish(registry: State<'_, ExportRegistry>, id: String) -> AppResult<FinishedExport> {
    let (path, bytes) = registry.finish(&id)?;
    Ok(FinishedExport {
        temp_path: path.to_string_lossy().into_owned(),
        bytes,
    })
}

/// Salva no destino: `None` = pasta padrão (Vídeos/SusuEdition), caminho local ou URI `content://`.
/// Retorna o caminho/URI final.
#[tauri::command]
pub async fn export_save<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    file_name: String,
    destination: Option<String>,
) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let registry = app.state::<ExportRegistry>();
        match destination {
            None => {
                let dir = default_dir(&app).ok_or_else(|| {
                    AppError::Unsupported("sem pasta padrão: escolha o destino".into())
                })?;
                let dest = unique_path(&dir, &sanitize_file_name(&file_name));
                registry.move_to(&id, &dest)?;
                Ok(dest.to_string_lossy().into_owned())
            }
            Some(dest) if dest.starts_with("content://") || dest.starts_with("file://") => {
                let src = registry.temp_path(&id)?;
                let mut opts = OpenOptions::new();
                opts.write(true).create(true).truncate(true);
                let target = FilePath::from_str(&dest).expect("infalível");
                let mut out = app.fs().open(target, opts)?;
                let mut input = std::fs::File::open(&src)?;
                std::io::copy(&mut input, &mut out)?;
                out.flush()?;
                registry.forget(&id);
                Ok(dest)
            }
            Some(dest) => {
                let path = std::path::PathBuf::from(&dest);
                if path.exists() {
                    std::fs::remove_file(&path)?;
                }
                registry.move_to(&id, &path)?;
                Ok(dest)
            }
        }
    })
    .await
    .map_err(|e| AppError::Unsupported(e.to_string()))?
}

#[tauri::command]
pub fn export_discard(registry: State<'_, ExportRegistry>, id: String) {
    registry.discard(&id);
}
