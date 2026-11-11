//! Comandos de projeto: listar, ler, gravar (autosave) e apagar.

use tauri::State;

use crate::error::AppResult;
use crate::services::project::{ProjectEntry, ProjectStore};

#[tauri::command]
pub async fn project_list(store: State<'_, ProjectStore>) -> AppResult<Vec<ProjectEntry>> {
    store.list()
}

#[tauri::command]
pub async fn project_read(store: State<'_, ProjectStore>, id: String) -> AppResult<Option<String>> {
    store.read(&id)
}

#[tauri::command]
pub async fn project_write(
    store: State<'_, ProjectStore>,
    id: String,
    json: String,
) -> AppResult<()> {
    store.write(&id, &json)
}

#[tauri::command]
pub async fn project_delete(store: State<'_, ProjectStore>, id: String) -> AppResult<()> {
    store.delete(&id)
}
