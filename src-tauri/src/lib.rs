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
        .invoke_handler(tauri::generate_handler![commands::app::app_info])
        .setup(|app| {
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
