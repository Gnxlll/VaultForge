use crate::database::DbState;
use rusqlite::params;
use tauri::State;
use serde::Serialize;

#[tauri::command]
pub fn save_project(
    state: State<'_, DbState>,
    id: String,
    name: String,
    path: String,
    ide: String,
    status: String,
    favorite: bool,
    tags: String,
    notes: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    // Upsert logic (Insert or Update)
    conn.execute(
        "INSERT INTO projects (id, name, path, ide, status, favorite, tags, notes) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET 
         name=excluded.name, path=excluded.path, ide=excluded.ide, 
         status=excluded.status, favorite=excluded.favorite, 
         tags=excluded.tags, notes=excluded.notes",
        params![id, name, path, ide, status, favorite, tags, notes],
    ).map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

#[derive(Serialize)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub ide: String,
    pub status: String,
    pub favorite: i32,
    pub tags: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_projects(state: State<'_, DbState>) -> Result<Vec<ProjectInfo>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    let mut stmt = conn.prepare("SELECT id, name, path, ide, status, favorite, tags, notes, created_at, updated_at FROM projects ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let project_iter = stmt.query_map([], |row| {
        Ok(ProjectInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            ide: row.get(3)?,
            status: row.get(4)?,
            favorite: row.get(5)?,
            tags: row.get(6)?,
            notes: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for p in project_iter {
        projects.push(p.map_err(|e| e.to_string())?);
    }

    Ok(projects)
}

#[tauri::command]
pub fn delete_project(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}