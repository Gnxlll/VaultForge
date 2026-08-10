#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod encryption;
mod utils;

use database::DbState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let conn = database::init(app.handle()).expect("Failed to initialize database");
            app.manage(DbState {
                db: Mutex::new(Some(conn)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::folder_ops::add_folder,
            commands::folder_ops::get_folders,
            commands::folder_ops::delete_folder,
            commands::ide_ops::open_folder_in_ide,
            commands::secret_ops::generate_jwt_secret,
            commands::secret_ops::generate_generic_secret,
            commands::password_ops::generate_password,
            commands::password_ops::generate_passphrase,
            commands::vault_ops::create_vault_item,
            commands::vault_ops::get_vault_items,
            commands::vault_ops::update_vault_item,
            commands::vault_ops::unlock_vault_item,
            commands::project_ops::save_project,
            commands::project_ops::get_projects,
                commands::project_ops::delete_project,
            commands::file_ops::encrypt_file,
            commands::file_ops::get_secure_files,
            commands::file_ops::decrypt_file,
            commands::file_ops::decrypt_file_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}