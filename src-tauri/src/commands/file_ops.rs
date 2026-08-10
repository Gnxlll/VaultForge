use crate::database::DbState;
use crate::encryption::key_derivation::derive_key;
use crate::utils::validation::{validate_id, validate_passcode};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use rand::RngCore;
use rand::rngs::OsRng;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, State};
use zeroize::Zeroize;

#[derive(Serialize, Deserialize)]
pub struct SecureFileMetadata {
    pub id: String,
    pub original_filename: String,
    pub file_size: i64,
    pub hint: String,
    pub created_at: String,
}

#[tauri::command]
pub fn encrypt_file(
    app: AppHandle,
    state: State<'_, DbState>,
    id: String,
    source_path: String,
    passcode: String,
    hint: String,
) -> Result<(), String> {
    validate_id(&id)?;
    validate_passcode(&passcode)?;

    // 1. Read the target file
    let path = Path::new(&source_path);
    if !path.exists() || !path.is_file() {
        return Err("FILE_NOT_FOUND: The selected file does not exist.".into());
    }
    
    let original_filename = path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
        
    let plaintext_bytes = fs::read(path).map_err(|e| format!("FAILED_TO_READ: {}", e))?;
    let file_size = plaintext_bytes.len() as i64;

    // 2. Generate Cryptographic Primitives
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);
    
    let mut key = derive_key(&passcode, &salt)?;
    
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // 3. Encrypt
    let cipher = Aes256Gcm::new((&key).into());
    let ciphertext = cipher.encrypt(nonce, plaintext_bytes.as_ref())
        .map_err(|_| "ENCRYPTION_FAILED".to_string())?;
        
    key.zeroize(); // Secure memory wipe

    // 4. Save Encrypted File locally
    let app_dir = app.path().app_data_dir().map_err(|_| "APP_DIR_ERROR")?;
    let secure_files_dir = app_dir.join("secure_files");
    if !secure_files_dir.exists() {
        fs::create_dir_all(&secure_files_dir).map_err(|_| "DIR_CREATION_FAILED")?;
    }
    
    let encrypted_file_path = secure_files_dir.join(format!("{}.enc", id));
    fs::write(&encrypted_file_path, ciphertext).map_err(|_| "FAILED_TO_WRITE_ENCRYPTED_FILE")?;

    // 5. Store Metadata in SQLite
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    // We must link it to a vault_item per our Phase 2 schema
    let vault_item_id = format!("v_{}", id);
    
    conn.execute(
        "INSERT INTO vault_items (id, type, title, encrypted_data) VALUES (?1, 'file', ?2, ?3)",
        params![vault_item_id, original_filename, b"FILE_POINTER"],
    ).map_err(|e| format!("DB_ERROR: {}", e))?;

    conn.execute(
        "INSERT INTO secure_files (id, vault_item_id, original_filename, encrypted_file_path, file_size, salt, nonce, hint) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id, 
            vault_item_id, 
            original_filename, 
            encrypted_file_path.to_string_lossy().to_string(),
            file_size,
            salt,
            nonce_bytes,
            hint
        ],
    ).map_err(|e| format!("DB_ERROR: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_secure_files(state: State<'_, DbState>) -> Result<Vec<SecureFileMetadata>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    let mut stmt = conn.prepare("SELECT id, original_filename, file_size, hint, created_at FROM secure_files ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let file_iter = stmt.query_map([], |row| {
        Ok(SecureFileMetadata {
            id: row.get(0)?,
            original_filename: row.get(1)?,
            file_size: row.get(2)?,
            hint: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for f in file_iter {
        files.push(f.map_err(|e| e.to_string())?);
    }

    Ok(files)
}

#[tauri::command]
pub fn decrypt_file(
    state: State<'_, DbState>,
    id: String,
    passcode: String,
    export_path: String,
) -> Result<(), String> {
    validate_id(&id)?;
    validate_passcode(&passcode)?;

    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DATABASE_ERROR")?;

    // Fetch cryptography metadata
    let mut stmt = conn.prepare("SELECT encrypted_file_path, salt, nonce FROM secure_files WHERE id = ?1")
        .map_err(|e| e.to_string())?;
        
    let (encrypted_path, salt, nonce_bytes): (String, Vec<u8>, Vec<u8>) = stmt.query_row(params![id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).map_err(|_| "FILE_RECORD_NOT_FOUND".to_string())?;

    // Read encrypted bytes
    let ciphertext = fs::read(&encrypted_path).map_err(|_| "FAILED_TO_READ_ENCRYPTED_FILE")?;

    // Derive key & decrypt
    let mut key = derive_key(&passcode, &salt)?;
    let cipher = Aes256Gcm::new((&key).into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext_bytes = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "DECRYPTION_FAILED: Invalid passcode or corrupt data".to_string())?;
        
    key.zeroize();

    // Write exported file
    fs::write(&export_path, plaintext_bytes).map_err(|_| "FAILED_TO_EXPORT_FILE")?;

    Ok(())
}