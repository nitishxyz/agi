use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::net::TcpListener;
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
        format!("otto-{}-{}.exe", os_name, arch_name)
   } else {
        format!("otto-{}-{}", os_name, arch_name)
   };

    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("resources/binaries").join(&binary_name));
        candidates.push(resource_dir.join("binaries").join(&binary_name));
        candidates.push(resource_dir.join(&binary_name));
    }

    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(parent) = exe_dir.parent() {
            candidates.push(parent.join("../Resources/resources/binaries").join(&binary_name));
            candidates.push(parent.join("../Resources/binaries").join(&binary_name));
            candidates.push(parent.join("../Resources").join(&binary_name));
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

fn find_available_port(tracked_ports: &[u16]) -> u16 {
    let base = 19000u16;
    
    for offset in 0..500u16 {
        let port = base + (offset * 2);
        if port > 60000 { break; }
        
        if tracked_ports.contains(&port) {
            eprintln!("[otto] Port {} is tracked, skipping", port);
            continue;
        }
        
        let api_available = TcpListener::bind(("127.0.0.1", port)).is_ok();
        let web_available = TcpListener::bind(("127.0.0.1", port + 1)).is_ok();
        
        if api_available && web_available {
            eprintln!("[otto] Found available port: {}", port);
            return port;
        } else {
            eprintln!("[otto] Port {} not available (api={}, web={})", port, api_available, web_available);
        }
    }
    19100
}

fn find_single_available_port(tracked_ports: &[u16]) -> u16 {
    let base = 19500u16;
    
    for offset in 0..500u16 {
        let port = base + offset;
        if port > 60000 { break; }
        
        if tracked_ports.contains(&port) {
            continue;
        }
        
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            eprintln!("[otto] Found available web port: {}", port);
            return port;
        }
    }
    19500
}

#[tauri::command]
pub async fn start_server(
    project_path: String,
    port: Option<u16>,
    state: State<'_, ServerState>,
    app: tauri::AppHandle,
) -> Result<ServerInfo, String> {
    let binary = get_binary_path(&app)?;
    
    // Get tracked ports from existing servers
    let tracked_ports: Vec<u16> = {
        let servers = state.servers.lock().unwrap();
        eprintln!("[otto] Currently tracking {} servers", servers.len());
        servers.values().map(|(_, info)| {
            eprintln!("[otto]   - pid={} port={} project={}", info.pid, info.port, info.project_path);
            info.port
        }).collect()
    };

    let actual_port = port.unwrap_or_else(|| find_available_port(&tracked_ports));
    let port_arg = actual_port.to_string();
    
   eprintln!("[otto] Starting server for project: {} on port: {}", project_path, actual_port);

   let log_path = format!("/tmp/otto-server-{}.log", actual_port);
   let log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
        .ok();
    
   let stdout = log_file.as_ref().map(|f| Stdio::from(f.try_clone().unwrap())).unwrap_or(Stdio::null());
  let stderr = log_file.map(|f| Stdio::from(f)).unwrap_or(Stdio::null());

    let otto_bin_dir = dirs::config_dir()
       .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
       .join("otto")
       .join("bin");
   let current_path = std::env::var("PATH").unwrap_or_default();
   let augmented_path = format!(
       "{}:/opt/homebrew/bin:/usr/local/bin:{}",
        otto_bin_dir.display(),
       current_path
   );

   let child = Command::new(&binary)
       .current_dir(&project_path)
       .args(["serve", "--port", &port_arg, "--no-open"])
       .env("PATH", &augmented_path)
        .env("TERM", "xterm-256color")
       .stdout(stdout)
       .stderr(stderr)
       .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    let info = ServerInfo {
        pid: child.id(),
        port: actual_port,
        web_port: actual_port + 1,
        url: format!("http://localhost:{}", actual_port + 1),
        project_path: project_path.clone(),
    };
    
    eprintln!("[otto] Server started with pid: {}, url: {}", info.pid, info.url);

    state
        .servers
        .lock()
        .unwrap()
        .insert(child.id(), (child, info.clone()));

    Ok(info)
}

#[tauri::command]
pub async fn start_web_server(
    api_url: String,
    name: String,
    port: Option<u16>,
    state: State<'_, ServerState>,
    app: tauri::AppHandle,
) -> Result<ServerInfo, String> {
    let binary = get_binary_path(&app)?;

    let tracked_ports: Vec<u16> = {
        let servers = state.servers.lock().unwrap();
        servers.values().map(|(_, info)| info.port).collect()
    };

    let actual_port = port.unwrap_or_else(|| find_single_available_port(&tracked_ports));
    let port_arg = actual_port.to_string();

    eprintln!("[otto] Starting web server for remote API: {} on port: {}", api_url, actual_port);

    let log_path = format!("/tmp/otto-web-{}.log", actual_port);
    let log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
        .ok();

    let stdout = log_file.as_ref().map(|f| Stdio::from(f.try_clone().unwrap())).unwrap_or(Stdio::null());
    let stderr = log_file.map(|f| Stdio::from(f)).unwrap_or(Stdio::null());

    let otto_bin_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("otto")
        .join("bin");
    let current_path = std::env::var("PATH").unwrap_or_default();
    let augmented_path = format!(
        "{}:/opt/homebrew/bin:/usr/local/bin:{}",
        otto_bin_dir.display(),
        current_path
    );

    let child = Command::new(&binary)
        .args(["web", "--api", &api_url, "--port", &port_arg, "--no-open"])
        .env("PATH", &augmented_path)
        .env("TERM", "xterm-256color")
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| format!("Failed to start web server: {}", e))?;

    let info = ServerInfo {
        pid: child.id(),
        port: actual_port,
        web_port: actual_port,
        url: format!("http://localhost:{}", actual_port),
        project_path: name,
    };

    eprintln!("[otto] Web server started with pid: {}, url: {}", info.pid, info.url);

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

    if let Some((mut child, info)) = servers.remove(&pid) {
        eprintln!("[otto] Stopping server pid={} port={} for project={}", pid, info.port, info.project_path);
        let _ = child.kill();
        let _ = child.wait();
    } else {
        eprintln!("[otto] No server found with pid={}", pid);
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_all_servers(state: State<'_, ServerState>) -> Result<(), String> {
    let mut servers = state.servers.lock().unwrap();
    eprintln!("[otto] Stopping all {} servers", servers.len());

    for (pid, (mut child, info)) in servers.drain() {
        eprintln!("[otto] Stopping server pid={} for project={}", pid, info.project_path);
        let _ = child.kill();
        let _ = child.wait();
    }

    Ok(())
}

#[tauri::command]
pub async fn list_servers(state: State<'_, ServerState>) -> Result<Vec<ServerInfo>, String> {
    let servers = state.servers.lock().unwrap();
    Ok(servers.values().map(|(_, info)| info.clone()).collect())
}
