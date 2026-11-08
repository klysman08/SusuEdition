//! SusuEdition — núcleo nativo (Tauri v2).
//!
//! Organização:
//! - `commands/` — fronteira com o frontend (`invoke`)
//! - `services/` — lógica nativa (thumbnails, áudio, batidas, cache)
//! - `protocol/` — protocolo `susu://` com HTTP Range
//! - `error`     — `AppError` serializável

pub mod commands;
pub mod error;
pub mod protocol;
pub mod services;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(services::registry::MediaRegistry::default())
        .register_asynchronous_uri_scheme_protocol(protocol::SCHEME, protocol::handle)
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::audio::audio_analyze,
            commands::media::media_register,
            commands::media::media_unregister,
            commands::media::media_process_images,
            commands::media::media_cache_get,
            commands::media::media_cache_put,
        ])
        .setup(|app| {
            let cache_root = app.path().app_cache_dir()?;
            app.manage(services::cache::MediaCache::new(&cache_root)?);
            log::info!(
                "SusuEdition {} iniciado em {}/{}",
                app.package_info().version,
                std::env::consts::OS,
                std::env::consts::ARCH
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o SusuEdition");
}
