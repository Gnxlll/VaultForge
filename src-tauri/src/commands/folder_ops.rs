use crate::database::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub preferred_ide: Option<String>,
}

#[tauri::command]
pub fn add_folder(
    state: State<'_, DbState>,
    id: String,
    name: String,
    path: String,
    description: Option<String>,
    preferred_ide: Option<String>,
) -> Result<(), String> {
    // Security: Validate path exists and is a directory
    let p = Path::new(&path);
    if !p.exists() {
        return Err("INVALID_PATH: Path does not exist".into());
    }
    if !p.is_dir() {
        return Err("DIRECTORY_NOT_FOUND: Path is not a directory".into());
    }

    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    conn.execute(
        "INSERT INTO folders (id, name, path, description, preferred_ide) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, path, description, preferred_ide],
    ).map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_folders(state: State<'_, DbState>) -> Result<Vec<Folder>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    let mut stmt = conn.prepare("SELECT id, name, path, description, preferred_ide FROM folders ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let folder_iter = stmt.query_map([], |row| {
        Ok(Folder {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            description: row.get(3)?,
            preferred_ide: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut folders = Vec::new();
    for folder in folder_iter {
        folders.push(folder.map_err(|e| e.to_string())?);
    }

    Ok(folders)
}

#[tauri::command]
pub fn delete_folder(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}