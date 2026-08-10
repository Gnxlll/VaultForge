pub mod schema;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState {
    pub db: Mutex<Option<Connection>>,
}

pub fn init(app_handle: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    // Store the database locally in the app's standard data directory
    let app_dir = app_handle.path().app_data_dir().expect("Failed to get app data dir");
    
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    let db_path: PathBuf = app_dir.join("vaultforge.sqlite");
    let conn = Connection::open(db_path)?;

    // Run migrations / table creation
    schema::init_tables(&conn)?;

    Ok(conn)
}