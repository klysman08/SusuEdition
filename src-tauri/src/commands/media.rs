//! Comandos de mídia: registro, processamento de fotos e cache de metadados/thumbnails.

use serde::Serialize;
use tauri::ipc::{Channel, InvokeBody, Request};
use tauri::{AppHandle, Runtime, State};

use crate::error::{AppError, AppResult};
use crate::services::cache::MediaCache;
use crate::services::jobs;
use crate::services::media_types::{MediaMeta, ProcessEvent, RegisteredMedia};
use crate::services::registry::MediaRegistry;

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum RegisterOutcome {
    Ok {
        #[serde(flatten)]
        media: RegisteredMedia,
    },
    #[serde(rename_all = "camelCase")]
    Error { uri: String, error: String },
}

/// Registra caminhos/URIs escolhidos pelo usuário. Rápido: só abre o arquivo e lê o cabeçalho.
#[tauri::command]
pub async fn media_register<R: Runtime>(
    app: AppHandle<R>,
    uris: Vec<String>,
) -> AppResult<Vec<RegisterOutcome>> {
    tauri::async_runtime::spawn_blocking(move || {
        let registry = tauri::Manager::state::<MediaRegistry>(&app);
        uris.into_iter()
            .map(|uri| match registry.register(&app, &uri) {
                Ok(media) => RegisterOutcome::Ok { media },
                Err(e) => RegisterOutcome::Error {
                    uri,
                    error: e.to_string(),
                },
            })
            .collect()
    })
    .await
    .map_err(|e| AppError::Unsupported(e.to_string()))
}

#[tauri::command]
pub fn media_unregister(registry: State<'_, MediaRegistry>, ids: Vec<String>) {
    registry.unregister(&ids);
}

/// Processa fotos (metadados + thumbnail) em paralelo. Os resultados chegam pelo canal
/// conforme ficam prontos; o comando retorna imediatamente.
#[tauri::command]
pub fn media_process_images<R: Runtime>(
    app: AppHandle<R>,
    ids: Vec<String>,
    on_event: Channel<ProcessEvent>,
) {
    jobs::spawn_image_jobs(app, ids, on_event);
}

/// Metadados em cache (vídeos processados anteriormente pelo WebView).
#[tauri::command]
pub fn media_cache_get(cache: State<'_, MediaCache>, ids: Vec<String>) -> Vec<Option<MediaMeta>> {
    ids.iter().map(|id| cache.get_meta(id)).collect()
}

/// Grava no cache o thumbnail gerado pelo WebView (vídeos).
/// Corpo: bytes do thumbnail. Cabeçalhos: `x-media-id`, `x-media-meta` (JSON, URI-encoded).
#[tauri::command]
pub fn media_cache_put(cache: State<'_, MediaCache>, request: Request<'_>) -> AppResult<()> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(|v| {
                percent_encoding::percent_decode_str(v)
                    .decode_utf8_lossy()
                    .into_owned()
            })
            .ok_or_else(|| AppError::Unsupported(format!("cabeçalho ausente: {name}")))
    };
    let id = header("x-media-id")?;
    let meta: MediaMeta = serde_json::from_str(&header("x-media-meta")?)
        .map_err(|e| AppError::Unsupported(e.to_string()))?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::Unsupported("corpo deve ser binário".into()));
    };
    cache.put(&id, &meta, bytes)
}
