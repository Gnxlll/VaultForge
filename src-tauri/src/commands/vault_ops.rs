use crate::database::DbState;
use crate::encryption::aes::{encrypt_vault_payload, decrypt_vault_payload};
use crate::utils::validation::{validate_id, validate_passcode, validate_payload};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;


#[derive(Serialize, Deserialize)]
pub struct VaultItemMetadata {
    pub id: String,
    pub item_type: String, // "credential" or "note"
    pub title: String,
    pub created_at: String,
}

#[tauri::command]
pub fn create_vault_item(
    state: State<'_, DbState>,
    id: String,
    item_type: String,
    title: String,
    plaintext_data: String,
    passcode: String,
) -> Result<(), String> {
    // 1. HARDENING: Validate Inputs
    validate_id(&id)?;
    validate_passcode(&passcode)?;
    validate_payload(&plaintext_data, 10)?;

    if title.len() > 255 {
        return Err("SECURITY_VIOLATION: Title too long.".into());
    }

    // 2. Encrypt the payload before touching the database
    let encrypted_data = encrypt_vault_payload(&passcode, &plaintext_data)?;
    
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    conn.execute(
        "INSERT INTO vault_items (id, type, title, encrypted_data) VALUES (?1, ?2, ?3, ?4)",
        params![id, item_type, title, encrypted_data],
    ).map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_vault_items(state: State<'_, DbState>) -> Result<Vec<VaultItemMetadata>, String> {
    // Only fetches metadata. The encrypted blob stays in SQLite until unlocked.
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    let mut stmt = conn.prepare("SELECT id, type, title, created_at FROM vault_items ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let item_iter = stmt.query_map([], |row| {
        Ok(VaultItemMetadata {
            id: row.get(0)?,
            item_type: row.get(1)?,
            title: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for item in item_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }

    Ok(items)
}

#[tauri::command]
pub fn unlock_vault_item(
    state: State<'_, DbState>,
    id: String,
    passcode: String,
) -> Result<String, String> {
    validate_id(&id)?;
    validate_passcode(&passcode)?;

    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    // Fetch the raw encrypted blob
    let mut stmt = conn.prepare("SELECT encrypted_data FROM vault_items WHERE id = ?1")
        .map_err(|e| e.to_string())?;
        
    let encrypted_data: Vec<u8> = stmt.query_row(params![id], |row| row.get(0))
        .map_err(|_| "ITEM_NOT_FOUND".to_string())?;

    // Attempt to decrypt
    decrypt_vault_payload(&passcode, &encrypted_data)
}

#[tauri::command]
pub fn update_vault_item(
    state: State<'_, DbState>,
    id: String,
    title: String,
    plaintext_data: String,
    passcode: String,
) -> Result<(), String> {
    // Validate inputs
    validate_id(&id)?;
    validate_passcode(&passcode)?;
    validate_payload(&plaintext_data, 1)?;

    // Encrypt the updated payload
    let encrypted_data = encrypt_vault_payload(&passcode, &plaintext_data)?;

    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    conn.execute(
        "UPDATE vault_items SET title = ?1, encrypted_data = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![title, encrypted_data, id],
    ).map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_vault_item(
    state: State<'_, DbState>,
    id: String,
    passcode: String,
) -> Result<(), String> {
    validate_id(&id)?;
    validate_passcode(&passcode)?;

    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    // Verify passcode by decrypting before delete
    let mut stmt = conn
        .prepare("SELECT encrypted_data FROM vault_items WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let encrypted_data: Vec<u8> = stmt
        .query_row(params![id], |row| row.get(0))
        .map_err(|_| "ITEM_NOT_FOUND".to_string())?;

    decrypt_vault_payload(&passcode, &encrypted_data)?;

    conn.execute("DELETE FROM vault_items WHERE id = ?1", params![id])
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}