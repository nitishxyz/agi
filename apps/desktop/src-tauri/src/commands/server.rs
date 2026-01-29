use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};

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

    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_path = resource_dir.join("binaries").join(&binary_name);
        if resource_path.exists() {
            return Ok(resource_path);
        }
    }

    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(parent) = exe_dir.parent() {
            let dev_path = parent
                .join("../../../resources/binaries")
                .join(&binary_name);
            if dev_path.exists() {
                return Ok(dev_path);
            }
        }
    }

    Err(format!("Binary not found: {}", binary_name))
}

fn parse_server_port(child: &mut Child) -> Result<u16, String> {
    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);

    for line in reader.lines().take(30) {
        let line = line.map_err(|e| e.to_string())?;

        if line.contains("listening on") || line.contains("localhost:") {
            if let Some(port_str) = line.split(':').last() {
                let port_str = port_str.trim().trim_end_matches('/');
                if let Ok(port) = port_str.parse::<u16>() {
                    return Ok(port);
                }
            }
        }
    }

    Err("Could not parse server port from output".to_string())
}

#[tauri::command]
pub async fn start_server(
    project_path: String,
    port: Option<u16>,
    state: State<'_, ServerState>,
    app: tauri::AppHandle,
) -> Result<ServerInfo, String> {
    let binary = get_binary_path(&app)?;

    let port_arg = port.unwrap_or(0).to_string();

    let mut child = Command::new(&binary)
        .current_dir(&project_path)
        .args(["serve", "--port", &port_arg])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    let actual_port = parse_server_port(&mut child).unwrap_or(3000);

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
