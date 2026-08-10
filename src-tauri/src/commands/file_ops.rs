use crate::database::DbState;
use crate::encryption::key_derivation::derive_key;
use crate::utils::validation::{validate_id, validate_passcode};

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm,
    Nonce,
};
use base64::Engine;
use rand::rngs::OsRng;
use rand::RngCore;
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
    pub mime_type: Option<String>,
    pub encrypted_file_path: String,
    pub modified_at: Option<String>,
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

    // ---------------------------------------------------------
    // 1. Read the target file
    // ---------------------------------------------------------

    let path = Path::new(&source_path);

    if !path.exists() || !path.is_file() {
        return Err("FILE_NOT_FOUND: The selected file does not exist.".into());
    }

    let original_filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();

    let plaintext_bytes =
        fs::read(path).map_err(|e| format!("FAILED_TO_READ: {}", e))?;

    let file_size = plaintext_bytes.len() as i64;

    // Determine MIME type by extension
    let mime_type = match path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
    {
        Some(ext)
            if ["png", "jpg", "jpeg", "gif", "bmp", "webp"]
                .contains(&ext.as_str()) =>
        {
            Some(format!(
                "image/{}",
                if ext == "jpg" {
                    "jpeg"
                } else {
                    &ext
                }
            ))
        }

        Some(ext)
            if ["txt", "md", "json", "csv", "log", "xml", "html", "htm"]
                .contains(&ext.as_str()) =>
        {
            Some("text/plain".to_string())
        }

        Some(ext) if ext == "pdf" => Some("application/pdf".to_string()),

        _ => None,
    };

    // ---------------------------------------------------------
    // 2. Generate cryptographic primitives
    // ---------------------------------------------------------

    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);

    let mut key = derive_key(&passcode, &salt)?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);

    let nonce = Nonce::from_slice(&nonce_bytes);

    // ---------------------------------------------------------
    // 3. Encrypt
    // ---------------------------------------------------------

    let cipher = Aes256Gcm::new((&key).into());

    let ciphertext = cipher
        .encrypt(nonce, plaintext_bytes.as_ref())
        .map_err(|_| "ENCRYPTION_FAILED".to_string())?;

    // Wipe derived key from memory
    key.zeroize();

    // ---------------------------------------------------------
    // 4. Save encrypted file locally
    // ---------------------------------------------------------

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "APP_DIR_ERROR".to_string())?;

    let secure_files_dir = app_dir.join("secure_files");

    if !secure_files_dir.exists() {
        fs::create_dir_all(&secure_files_dir)
            .map_err(|_| "DIR_CREATION_FAILED".to_string())?;
    }

    let encrypted_file_path =
        secure_files_dir.join(format!("{}.enc", id));

    fs::write(&encrypted_file_path, ciphertext)
        .map_err(|_| "FAILED_TO_WRITE_ENCRYPTED_FILE".to_string())?;

    // ---------------------------------------------------------
    // 5. Store metadata in SQLite
    // ---------------------------------------------------------

    let db_guard = state
        .db
        .lock()
        .map_err(|_| "DATABASE_LOCK_ERROR".to_string())?;

    let conn = db_guard
        .as_ref()
        .ok_or("DATABASE_ERROR".to_string())?;

    // Link secure file to a vault item
    let vault_item_id = format!("v_{}", id);

    conn.execute(
        "INSERT INTO vault_items
            (id, type, title, encrypted_data)
         VALUES
            (?1, 'file', ?2, ?3)",
        params![
            vault_item_id,
            original_filename,
            b"FILE_POINTER"
        ],
    )
    .map_err(|e| format!("DB_ERROR: {}", e))?;

    conn.execute(
        "INSERT INTO secure_files
            (
                id,
                vault_item_id,
                original_filename,
                encrypted_file_path,
                file_size,
                mime_type,
                salt,
                nonce,
                hint
            )
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            vault_item_id,
            original_filename,
            encrypted_file_path
                .to_string_lossy()
                .to_string(),
            file_size,
            mime_type,
            salt.to_vec(),
            nonce_bytes.to_vec(),
            hint
        ],
    )
    .map_err(|e| format!("DB_ERROR: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_secure_files(
    state: State<'_, DbState>,
) -> Result<Vec<SecureFileMetadata>, String> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| "DATABASE_LOCK_ERROR".to_string())?;

    let conn = db_guard
        .as_ref()
        .ok_or("DATABASE_ERROR".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                original_filename,
                file_size,
                hint,
                created_at,
                mime_type,
                encrypted_file_path
             FROM secure_files
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let file_iter = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let original_filename: String = row.get(1)?;
            let file_size: i64 = row.get(2)?;
            let hint: String = row.get(3)?;
            let created_at: String = row.get(4)?;
            let mime_type: Option<String> = row.get(5)?;
            let encrypted_path: String = row.get(6)?;

            // Try to read modified time of encrypted file
            let modified_at = match std::fs::metadata(&encrypted_path) {
                Ok(meta) => match meta.modified() {
                    Ok(time) => match time.duration_since(
                        std::time::UNIX_EPOCH,
                    ) {
                        Ok(duration) => {
                            Some(duration.as_secs().to_string())
                        }
                        Err(_) => None,
                    },
                    Err(_) => None,
                },
                Err(_) => None,
            };

            Ok(SecureFileMetadata {
                id,
                original_filename,
                file_size,
                hint,
                created_at,
                mime_type,
                encrypted_file_path: encrypted_path,
                modified_at,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();

    for file in file_iter {
        files.push(file.map_err(|e| e.to_string())?);
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

    // ---------------------------------------------------------
    // 1. Get database connection
    // ---------------------------------------------------------

    let db_guard = state
        .db
        .lock()
        .map_err(|_| "DATABASE_LOCK_ERROR".to_string())?;

    let conn = db_guard
        .as_ref()
        .ok_or("DATABASE_ERROR".to_string())?;

    // ---------------------------------------------------------
    // 2. Fetch cryptographic metadata
    // ---------------------------------------------------------

    let mut stmt = conn
        .prepare(
            "SELECT
                encrypted_file_path,
                salt,
                nonce
             FROM secure_files
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let (encrypted_path, salt, nonce_bytes): (
        String,
        Vec<u8>,
        Vec<u8>,
    ) = stmt
        .query_row(params![id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
            ))
        })
        .map_err(|_| "FILE_RECORD_NOT_FOUND".to_string())?;

    // ---------------------------------------------------------
    // 3. Validate cryptographic metadata
    // ---------------------------------------------------------

    if salt.len() != 32 {
        return Err("INVALID_SALT".to_string());
    }

    if nonce_bytes.len() != 12 {
        return Err("INVALID_NONCE".to_string());
    }

    // ---------------------------------------------------------
    // 4. Read encrypted file
    // ---------------------------------------------------------

    let ciphertext = fs::read(&encrypted_path)
        .map_err(|_| "FAILED_TO_READ_ENCRYPTED_FILE".to_string())?;

    // ---------------------------------------------------------
    // 5. Derive key and decrypt
    // ---------------------------------------------------------

    let mut key = derive_key(&passcode, &salt)?;

    let cipher = Aes256Gcm::new((&key).into());

    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| {
            "DECRYPTION_FAILED: Invalid passcode or corrupt data"
                .to_string()
        })?;

    // Wipe key
    key.zeroize();

    // ---------------------------------------------------------
    // 6. Write decrypted file
    // ---------------------------------------------------------

    fs::write(&export_path, plaintext_bytes)
        .map_err(|_| "FAILED_TO_EXPORT_FILE".to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct DecryptPreviewResult {
    pub original_filename: String,
    pub mime: String,
    pub base64: String,
}

#[tauri::command]
pub fn decrypt_file_preview(
    state: State<'_, DbState>,
    id: String,
    passcode: String,
) -> Result<DecryptPreviewResult, String> {
    validate_id(&id)?;
    validate_passcode(&passcode)?;


    let db_guard = state
        .db
        .lock()
        .map_err(|_| "DATABASE_LOCK_ERROR".to_string())?;

    let conn = db_guard
        .as_ref()
        .ok_or("DATABASE_ERROR".to_string())?;

 
    let mut stmt = conn
        .prepare(
            "SELECT
                encrypted_file_path,
                original_filename,
                salt,
                nonce
             FROM secure_files
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let (
        encrypted_path,
        original_filename,
        salt,
        nonce_bytes,
    ): (
        String,
        String,
        Vec<u8>,
        Vec<u8>,
    ) = stmt
        .query_row(params![id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
            ))
        })
        .map_err(|_| "FILE_RECORD_NOT_FOUND".to_string())?;

    if salt.len() != 32 {
        return Err("INVALID_SALT".to_string());
    }

    if nonce_bytes.len() != 12 {
        return Err("INVALID_NONCE".to_string());
    }

    let ciphertext = fs::read(&encrypted_path)
        .map_err(|_| "FAILED_TO_READ_ENCRYPTED_FILE".to_string())?;


    let mut key = derive_key(&passcode, &salt)?;

    let cipher = Aes256Gcm::new((&key).into());

    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| {
            "DECRYPTION_FAILED: Invalid passcode or corrupt data"
                .to_string()
        })?;

    key.zeroize();


    let mime = match Path::new(&original_filename)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
    {
        Some(ext)
            if ["png", "jpg", "jpeg", "gif", "bmp", "webp"]
                .contains(&ext.as_str()) =>
        {
            format!(
                "image/{}",
                if ext == "jpg" {
                    "jpeg"
                } else {
                    &ext
                }
            )
        }

        Some(ext)
            if ["txt", "md", "json", "csv", "log", "xml", "html", "htm"]
                .contains(&ext.as_str()) =>
        {
            "text/plain".to_string()
        }

        Some(ext) if ext == "pdf" => {
            "application/pdf".to_string()
        }

        _ => "application/octet-stream".to_string(),
    };


    let b64 = base64::engine::general_purpose::STANDARD
        .encode(&plaintext_bytes);


    Ok(DecryptPreviewResult {
        original_filename,
        mime,
        base64: b64,
    })
}