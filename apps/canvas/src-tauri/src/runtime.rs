use serde::Serialize;
use std::collections::HashMap;
use std::fs::{read_to_string, OpenOptions};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State, Wry};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRuntimeInfo {
    pub workspace_id: String,
    pub environment_id: String,
    pub project_path: String,
    pub pid: u32,
    pub port: u16,
    pub url: String,
    pub log_path: String,
}

struct WorkspaceRuntimeEntry {
    child: Child,
    info: WorkspaceRuntimeInfo,
}

#[derive(Clone, Default)]
pub struct WorkspaceRuntimeManager {
    inner: Arc<Mutex<HashMap<String, WorkspaceRuntimeEntry>>>,
}

impl Drop for WorkspaceRuntimeManager {
    fn drop(&mut self) {
        if let Ok(mut runtimes) = self.inner.lock() {
            for (_, entry) in runtimes.iter_mut() {
                let _ = entry.child.kill();
                let _ = entry.child.wait();
            }
            runtimes.clear();
        }
    }
}

fn get_binary_path(app: &AppHandle<Wry>) -> PathBuf {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let (os_name, arch_name) = match (os, arch) {
        ("macos", "aarch64") => ("darwin", "arm64"),
        ("macos", "x86_64") => ("darwin", "x64"),
        ("linux", "x86_64") => ("linux", "x64"),
        ("linux", "aarch64") => ("linux", "arm64"),
        ("windows", "x86_64") => ("windows", "x64"),
        _ => return PathBuf::from("otto"),
    };

    let binary_name = if os == "windows" {
        format!("otto-{}-{}.exe", os_name, arch_name)
    } else {
        format!("otto-{}-{}", os_name, arch_name)
    };

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("resources/binaries").join(&binary_name));
        candidates.push(resource_dir.join("binaries").join(&binary_name));
        candidates.push(resource_dir.join(&binary_name));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("../Resources/resources/binaries").join(&binary_name));
            candidates.push(parent.join("../Resources/binaries").join(&binary_name));
            candidates.push(parent.join("../Resources").join(&binary_name));
        }
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        candidates.push(
            PathBuf::from(&manifest_dir)
                .join("resources/binaries")
                .join(&binary_name),
        );
    }

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from("otto")
}

fn find_available_port(tracked_ports: &[u16]) -> u16 {
    let base = 19100u16;

    for offset in 0..1000u16 {
        let port = base + offset;
        if port > 60000 {
            break;
        }
        if tracked_ports.contains(&port) {
            continue;
        }
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }

    19100
}

fn current_tracked_ports(manager: &WorkspaceRuntimeManager) -> Vec<u16> {
    if let Ok(runtimes) = manager.inner.lock() {
        runtimes.values().map(|entry| entry.info.port).collect()
    } else {
        Vec::new()
    }
}

fn cleanup_dead_runtime_locked(
    runtimes: &mut HashMap<String, WorkspaceRuntimeEntry>,
    workspace_id: &str,
) -> Result<Option<WorkspaceRuntimeInfo>, String> {
    let should_remove = if let Some(entry) = runtimes.get_mut(workspace_id) {
        match entry.child.try_wait() {
            Ok(Some(_)) => true,
            Ok(None) => return Ok(Some(entry.info.clone())),
            Err(error) => return Err(format!("Failed to inspect runtime process: {}", error)),
        }
    } else {
        false
    };

    if should_remove {
        runtimes.remove(workspace_id);
    }

    Ok(None)
}

#[tauri::command]
pub fn workspace_start_runtime(
    app_handle: AppHandle<Wry>,
    manager: State<'_, WorkspaceRuntimeManager>,
    workspace_id: String,
    environment_id: String,
    project_path: String,
) -> Result<WorkspaceRuntimeInfo, String> {
    {
        let mut runtimes = manager
            .inner
            .lock()
            .map_err(|_| "Failed to lock runtime manager".to_string())?;
        if let Some(info) = cleanup_dead_runtime_locked(&mut runtimes, &workspace_id)? {
            return Ok(info);
        }
    }

    let tracked_ports = current_tracked_ports(manager.inner());
    let port = find_available_port(&tracked_ports);
    let port_arg = port.to_string();
    let binary = get_binary_path(&app_handle);

    let log_path = format!("/tmp/otto-canvas-runtime-{}-{}.log", workspace_id, port);
    let log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
        .ok();
    let stdout = log_file
        .as_ref()
        .and_then(|file| file.try_clone().ok())
        .map(Stdio::from)
        .unwrap_or(Stdio::null());
    let stderr = log_file.map(Stdio::from).unwrap_or(Stdio::null());

    let otto_bin_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("otto")
        .join("bin");
    let current_path = std::env::var("PATH").unwrap_or_default();
    let augmented_path = format!(
        "{}:/opt/homebrew/bin:/usr/local/bin:{}",
        otto_bin_dir.display(),
        current_path
    );

    eprintln!(
        "[canvas] starting otto runtime workspace={} env={} cwd={} port={} binary={} log={}",
        workspace_id,
        environment_id,
        project_path,
        port,
        binary.display(),
        log_path
    );

    let child = Command::new(&binary)
        .current_dir(&project_path)
        .args(["serve", "--port", &port_arg, "--no-open"])
        .env("PATH", &augmented_path)
        .env("TERM", "xterm-256color")
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|error| format!("Failed to start otto runtime: {}", error))?;

    let info = WorkspaceRuntimeInfo {
        workspace_id: workspace_id.clone(),
        environment_id,
        project_path,
        pid: child.id(),
        port,
        url: format!("http://127.0.0.1:{}", port),
        log_path,
    };

    eprintln!(
        "[canvas] otto runtime spawned workspace={} pid={} url={}",
        info.workspace_id,
        info.pid,
        info.url
    );

    manager
        .inner
        .lock()
        .map_err(|_| "Failed to lock runtime manager".to_string())?
        .insert(
            workspace_id,
            WorkspaceRuntimeEntry {
                child,
                info: info.clone(),
            },
        );

    Ok(info)
}

#[tauri::command]
pub fn workspace_get_runtime(
    manager: State<'_, WorkspaceRuntimeManager>,
    workspace_id: String,
) -> Result<Option<WorkspaceRuntimeInfo>, String> {
    let mut runtimes = manager
        .inner
        .lock()
        .map_err(|_| "Failed to lock runtime manager".to_string())?;
    cleanup_dead_runtime_locked(&mut runtimes, &workspace_id)
}

#[tauri::command]
pub fn workspace_stop_runtime(
    manager: State<'_, WorkspaceRuntimeManager>,
    workspace_id: String,
) -> Result<(), String> {
    let mut runtimes = manager
        .inner
        .lock()
        .map_err(|_| "Failed to lock runtime manager".to_string())?;

    if let Some(mut entry) = runtimes.remove(&workspace_id) {
        let _ = entry.child.kill();
        let _ = entry.child.wait();
    }

    Ok(())
}

#[tauri::command]
pub fn workspace_read_runtime_log(log_path: String) -> Result<String, String> {
    let content = read_to_string(&log_path)
        .map_err(|error| format!("Failed to read runtime log {}: {}", log_path, error))?;

    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(80);
    Ok(lines[start..].join("\n"))
}

#[tauri::command]
pub fn workspace_list_runtimes(
    manager: State<'_, WorkspaceRuntimeManager>,
) -> Result<Vec<WorkspaceRuntimeInfo>, String> {
    let mut runtimes = manager
        .inner
        .lock()
        .map_err(|_| "Failed to lock runtime manager".to_string())?;

    let keys: Vec<String> = runtimes.keys().cloned().collect();
    let mut active = Vec::new();
    for workspace_id in keys {
        if let Some(info) = cleanup_dead_runtime_locked(&mut runtimes, &workspace_id)? {
            active.push(info);
        }
    }

    Ok(active)
}
