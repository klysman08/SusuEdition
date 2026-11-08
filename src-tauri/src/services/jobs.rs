//! Fila de processamento de fotos em paralelo.
//!
//! N threads puxam o próximo índice de uma fila compartilhada: os itens terminam
//! aproximadamente na ordem da biblioteca, então a grade se preenche de cima para baixo.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

use super::cache::MediaCache;
use super::image::process_image;
use super::media_types::ProcessEvent;
use super::registry::MediaRegistry;

/// Threads de decodificação: deixa um núcleo livre para a UI. Máximo 6 (memória no Android).
pub fn worker_count() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get().saturating_sub(1))
        .unwrap_or(2)
        .clamp(1, 6)
}

pub fn spawn_image_jobs<R: Runtime>(
    app: AppHandle<R>,
    ids: Vec<String>,
    channel: Channel<ProcessEvent>,
) {
    let ids = Arc::new(ids);
    let next = Arc::new(AtomicUsize::new(0));
    let workers = worker_count().min(ids.len().max(1));

    for _ in 0..workers {
        let (app, ids, next, channel) = (app.clone(), ids.clone(), next.clone(), channel.clone());
        std::thread::spawn(move || {
            let registry = app.state::<MediaRegistry>();
            let cache = app.state::<MediaCache>();
            loop {
                let i = next.fetch_add(1, Ordering::Relaxed);
                let Some(id) = ids.get(i) else { break };
                let event = process_one(&app, &registry, &cache, id);
                if channel.send(event).is_err() {
                    break; // a janela foi fechada / o canal caiu
                }
            }
        });
    }
}

fn process_one<R: Runtime>(
    app: &AppHandle<R>,
    registry: &MediaRegistry,
    cache: &MediaCache,
    id: &str,
) -> ProcessEvent {
    if let Some(meta) = cache.get_meta(id) {
        return ProcessEvent::Done {
            id: id.to_string(),
            meta,
        };
    }
    let failed = |error: String| ProcessEvent::Failed {
        id: id.to_string(),
        error,
    };

    let entry = match registry.entry(id) {
        Ok(e) => e,
        Err(e) => return failed(e.to_string()),
    };
    let file = match registry.open_new(app, id) {
        Ok(f) => f,
        Err(e) => return failed(e.to_string()),
    };
    match process_image(file, &entry.mime) {
        Ok((meta, thumb)) => {
            if let Err(e) = cache.put(id, &meta, &thumb) {
                log::warn!("falha ao gravar cache de {id}: {e}");
            }
            ProcessEvent::Done {
                id: id.to_string(),
                meta,
            }
        }
        Err(e) => {
            log::warn!("falha ao processar {}: {e}", entry.uri);
            failed(e.to_string())
        }
    }
}
