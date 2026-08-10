use std::process::Command;
use std::path::Path;

#[tauri::command]
pub fn open_folder_in_ide(path: String, ide_bin: String) -> Result<(), String> {
    if !Path::new(&path).is_dir() {
        return Err("DIRECTORY_NOT_FOUND: The project folder no longer exists.".into());
    }

    // Windows usually requires spawning via cmd for paths/aliases like "code"
    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("cmd");
    #[cfg(target_os = "windows")]
    cmd.args(["/C", &ide_bin, &path]);

    // macOS and Linux
    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new(&ide_bin);
    #[cfg(not(target_os = "windows"))]
    cmd.arg(&path);

    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("FAILED_TO_LAUNCH_IDE: {}", e)),
    }
}