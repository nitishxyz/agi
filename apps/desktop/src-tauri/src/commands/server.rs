use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};
use std::net::TcpListener;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub pid: u32,
    pub port: u16,
    pub web_port: u16,
    pub url: String,
    pub project_path: String,
}

pub struct ServerState {
    pub servers: Mutex<HashMap<u32, (Child, ServerInfo)>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            servers: Mutex::new(HashMap::new()),
        }
    }
}

fn get_binary_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let (os_name, arch_name) = match (os, arch) {
        ("macos", "aarch64") => ("darwin", "arm64"),
        ("macos", "x86_64") => ("darwin", "x64"),
        ("linux", "x86_64") => ("linux", "x64"),
        ("linux", "aarch64") => ("linux", "arm64"),
        ("windows", "x86_64") => ("windows", "x64"),
        _ => return Err(format!("Unsupported platform: {}-{}", os, arch)),
    };

    let binary_name = if os == "windows" {
        format!("agi-{}-{}.exe", os_name, arch_name)
    } else {
        format!("agi-{}-{}", os_name, arch_name)
    };

    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    // Production: Tauri resource_dir (Contents/Resources in .app bundle)
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Tauri bundles resources to Contents/Resources/resources/
        candidates.push(resource_dir.join("resources/binaries").join(&binary_name));
        candidates.push(resource_dir.join("binaries").join(&binary_name));
        candidates.push(resource_dir.join(&binary_name));
    }

    // Production macOS: relative to executable in .app bundle
    // Structure: AGI.app/Contents/MacOS/AGI -> AGI.app/Contents/Resources/binaries/
    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(parent) = exe_dir.parent() {
            // macOS .app bundle: MacOS -> Resources
            candidates.push(parent.join("../Resources/resources/binaries").join(&binary_name));
            candidates.push(parent.join("../Resources/binaries").join(&binary_name));
            candidates.push(parent.join("../Resources").join(&binary_name));
            // Dev mode path
            candidates.push(
                parent
                    .join("../../../resources/binaries")
                    .join(&binary_name),
            );
        }
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        candidates.push(
            std::path::PathBuf::from(&manifest_dir)
                .join("resources/binaries")
                .join(&binary_name),
        );
    }

    let src_tauri_paths = [
        "apps/desktop/src-tauri/resources/binaries",
        "src-tauri/resources/binaries",
        "../src-tauri/resources/binaries",
    ];
    if let Ok(cwd) = std::env::current_dir() {
        for p in &src_tauri_paths {
            candidates.push(cwd.join(p).join(&binary_name));
        }
    }

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    let tried_paths: Vec<String> = candidates
        .iter()
        .map(|p| p.display().to_string())
        .collect();
    Err(format!(
        "Binary not found: {}. Tried paths:\n{}",
        binary_name,
        tried_paths.join("\n")
    ))
}

fn find_available_port() -> u16 {
    let base = 19000u16;
    for offset in 0..500u16 {
        let port = base + (offset * 2);
        if port > 60000 { break; }
        
        if TcpListener::bind(("127.0.0.1", port)).is_ok()
            && TcpListener::bind(("127.0.0.1", port + 1)).is_ok()
        {
            return port;
        }
    }
    19100
}

#[tauri::command]
pub async fn start_server(
    project_path: String,
    port: Option<u16>,
    state: State<'_, ServerState>,
    app: tauri::AppHandle,
) -> Result<ServerInfo, String> {
    let binary = get_binary_path(&app)?;

    let actual_port = port.unwrap_or_else(find_available_port);
    let port_arg = actual_port.to_string();

    let child = Command::new(&binary)
        .current_dir(&project_path)
        .args(["serve", "--port", &port_arg, "--no-open"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    let info = ServerInfo {
        pid: child.id(),
        port: actual_port,
        web_port: actual_port + 1,
        url: format!("http://localhost:{}", actual_port + 1),
        project_path: project_path.clone(),
    };

    state
        .servers
        .lock()
        .unwrap()
        .insert(child.id(), (child, info.clone()));

    Ok(info)
}

#[tauri::command]
pub async fn stop_server(pid: u32, state: State<'_, ServerState>) -> Result<(), String> {
    let mut servers = state.servers.lock().unwrap();

    if let Some((mut child, _)) = servers.remove(&pid) {
        child.kill().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_all_servers(state: State<'_, ServerState>) -> Result<(), String> {
    let mut servers = state.servers.lock().unwrap();

    for (_, (mut child, _)) in servers.drain() {
        let _ = child.kill();
    }

    Ok(())
}

#[tauri::command]
pub async fn list_servers(state: State<'_, ServerState>) -> Result<Vec<ServerInfo>, String> {
    let servers = state.servers.lock().unwrap();
    Ok(servers.values().map(|(_, info)| info.clone()).collect())
}
