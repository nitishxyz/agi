use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TeamState {
    pub name: String,
    pub public_key: String,
    pub encrypted_key: String,
    pub git_name: String,
    pub git_email: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectState {
    pub id: String,
    pub repo: String,
    pub container_name: String,
    pub api_port: u16,
    pub web_port: u16,
    pub status: String,
    #[serde(default)]
    pub image: String,
    #[serde(default)]
    pub dev_ports: String,
    #[serde(default)]
    pub post_clone: String,
    #[serde(default)]
    pub git_name: String,
    #[serde(default)]
    pub git_email: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct LauncherState {
    pub team: Option<TeamState>,
    pub projects: Vec<ProjectState>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OttoTeamConfig {
    pub version: u32,
    pub repo: String,
    pub key: String,
    pub cipher: String,
    pub git_name: String,
    pub git_email: String,
    pub image: String,
    pub dev_ports: String,
    pub post_clone: String,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("otto-launcher")
}

fn state_path() -> PathBuf {
    config_dir().join("state.json")
}

#[tauri::command]
pub fn load_state() -> Result<LauncherState, String> {
    let path = state_path();
    if !path.exists() {
        return Ok(LauncherState::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_state(state: LauncherState) -> Result<(), String> {
    let path = state_path();
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let data = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn parse_team_config(content: String) -> Result<OttoTeamConfig, String> {
    serde_json::from_str(&content).map_err(|e| format!("Invalid .otto file: {}", e))
}

#[tauri::command]
pub fn export_team_config(config: OttoTeamConfig) -> Result<String, String> {
    serde_json::to_string_pretty(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_otto_file(
    app: tauri::AppHandle,
    config: OttoTeamConfig,
    default_name: String,
) -> Result<bool, String> {
    let json =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Serialize failed: {}", e))?;

    let dialog = app.dialog().clone();
    let name = default_name.clone();
    let file_path = tokio::task::spawn_blocking(move || {
        dialog
            .file()
            .set_file_name(&name)
            .add_filter("Otto Config", &["otto"])
            .blocking_save_file()
    })
    .await
    .map_err(|e| format!("Dialog failed: {}", e))?;

    match file_path {
        Some(fp) => {
            let path = fp.as_path().ok_or("Invalid file path")?;
            fs::write(path, &json).map_err(|e| format!("Write failed: {}", e))?;
            Ok(true)
        }
        None => Ok(false),
    }
}
