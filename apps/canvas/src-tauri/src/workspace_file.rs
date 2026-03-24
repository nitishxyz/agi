use std::{fs, path::PathBuf};

fn otto_file_path(project_path: &str) -> Result<PathBuf, String> {
    let trimmed = project_path.trim();
    if trimmed.is_empty() {
        return Err("Project path is required".to_string());
    }
    Ok(PathBuf::from(trimmed).join("otto.yaml"))
}

#[tauri::command]
pub fn workspace_file_exists(project_path: String) -> Result<bool, String> {
    let file_path = otto_file_path(&project_path)?;
    Ok(file_path.exists())
}

#[tauri::command]
pub fn workspace_file_read(project_path: String) -> Result<String, String> {
    let file_path = otto_file_path(&project_path)?;
    fs::read_to_string(&file_path)
        .map_err(|error| format!("Failed to read {}: {error}", file_path.display()))
}

#[tauri::command]
pub fn workspace_file_write(project_path: String, content: String) -> Result<(), String> {
    let file_path = otto_file_path(&project_path)?;
    fs::write(&file_path, content)
        .map_err(|error| format!("Failed to write {}: {error}", file_path.display()))
}
