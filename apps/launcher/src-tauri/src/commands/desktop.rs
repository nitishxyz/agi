use std::path::PathBuf;
use std::process::Command;

fn get_desktop_app_path() -> Option<PathBuf> {
    let os = std::env::consts::OS;

    if os == "macos" {
        let candidates = vec![
            PathBuf::from("/Applications/otto.app"),
            dirs::home_dir()
                .map(|h| h.join("Applications").join("otto.app"))
                .unwrap_or_default(),
        ];
        for p in candidates {
            if p.exists() {
                return Some(p);
            }
        }
    }

    if os == "linux" {
        let candidates = vec![
            PathBuf::from("/usr/bin/otto-desktop"),
            PathBuf::from("/usr/local/bin/otto-desktop"),
            dirs::home_dir()
                .map(|h| h.join(".local").join("bin").join("otto-desktop"))
                .unwrap_or_default(),
            PathBuf::from("/opt/otto-desktop/otto-desktop"),
        ];
        for p in candidates {
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

#[tauri::command]
pub fn is_desktop_installed() -> bool {
    get_desktop_app_path().is_some()
}

#[tauri::command]
pub fn open_in_desktop(api_url: String, name: String) -> Result<(), String> {
    let app_path = get_desktop_app_path().ok_or("Desktop app not found")?;
    let os = std::env::consts::OS;

    if os == "macos" {
        Command::new("open")
            .args([
                "-n",
                app_path.to_str().unwrap_or_default(),
                "--args",
                "--remote",
                &api_url,
                "--name",
                &name,
            ])
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        Command::new(app_path)
            .args(["--remote", &api_url, "--name", &name])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
