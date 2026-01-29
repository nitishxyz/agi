# Desktop App (Tauri 2.0) - Implementation Plan

## Overview

Desktop application built with Tauri 2.0 that wraps the compiled AGI CLI binary, embeds the React-based web UI, and provides native project management. Designed for **non-technical users** who don't want to touch a terminal, SSH keys, or git commands.

### Key Goals
- **Zero CLI knowledge required** - Double-click to run
- **No SSH/Git setup** - Clone repos via GitHub OAuth (HTTPS)
- **Full git workflow** - Clone, commit, push without terminal
- **Project picker** - Open local folders or clone from GitHub

---

## Implementation Status (Updated: Jan 2026)

### ✅ Completed

#### Phase 1: Tauri 2.0 Project Setup
- [x] Initialize Tauri 2.0 project with `bun create tauri-app`
- [x] Project structure at `apps/desktop/`
- [x] Cargo.toml with all dependencies (git2, keyring, reqwest, tokio, chrono)
- [x] tauri.conf.json configuration
- [x] capabilities/default.json with permissions

#### Phase 2: Rust Backend Commands
- [x] `commands/project.rs` - Open folder dialog, recent projects management
- [x] `commands/server.rs` - Start/stop AGI server subprocess (binary path resolution)
- [x] `commands/github.rs` - Token storage in OS keychain, GitHub API (user, repos)
- [x] `commands/git.rs` - Clone, status, commit, push, pull via git2-rs
- [x] lib.rs with all commands registered and plugins initialized

#### Phase 3: Frontend (React + Tailwind)
- [x] `src/lib/tauri-bridge.ts` - TypeScript bindings for all Rust commands
- [x] `src/hooks/useProjects.ts` - Recent projects state management
- [x] `src/hooks/useGitHub.ts` - GitHub auth and repo listing
- [x] `src/hooks/useServer.ts` - Server lifecycle management
- [x] `src/App.tsx` - Project picker + workspace UI
- [x] Tailwind CSS with same theme as `apps/web` (CSS variables, dark mode)
- [x] Setu logo and GitHub logo SVGs

#### UI Features
- [x] Project picker with "Open Folder" and "Connect GitHub" cards
- [x] Recent projects list with pin/unpin and remove
- [x] GitHub token input modal (Personal Access Token flow)
- [x] Clone from GitHub modal with repository list
- [x] Workspace view with embedded iframe for AGI server
- [x] Top bar with Setu logo, user info when connected

### 🚧 In Progress / Remaining

#### Phase 4: Integration
- [ ] Copy AGI binaries to `src-tauri/resources/binaries/`
- [ ] Test server startup with actual AGI CLI binary
- [ ] Git status bar in workspace view
- [ ] Commit dialog UI

#### Phase 5: OAuth (Optional Enhancement)
- [ ] GitHub OAuth App setup (currently using PAT flow)
- [ ] `tauri-plugin-oauth` integration
- [ ] Browser-based OAuth flow with code exchange

#### Phase 6: Distribution
- [ ] Build DMG for macOS
- [ ] Build MSI for Windows  
- [ ] Build AppImage for Linux
- [ ] Code signing and notarization
- [ ] Auto-update via `tauri-plugin-updater`

### How to Run

```bash
cd apps/desktop
bun install
bun run tauri dev
```

---

## Why Tauri 2.0?

Released October 2024, Tauri 2.0 provides:
- **95% smaller binaries** than Electron (~10MB vs ~150MB)
- **Mobile support** - iOS + Android (future bonus)
- **Plugin system** - Modular, official plugins for OAuth, dialogs, etc.
- **New permissions system** - Fine-grained capabilities (replaces allowlist)
- **Deep linking** - Custom URL schemes (`agi://`)
- **Hot Module Replacement** - Fast development iteration

## Current Architecture

### Existing Infrastructure (Already Built)
- **CLI Binary**: Compiled to static executables for darwin-arm64, darwin-x64, linux-x64, linux-arm64
- **Build Process**: `bun build --compile` embeds web UI + all dependencies into single binary
- **Web UI**: Embedded at `apps/cli/src/web-dist/` during build (Vite + TailwindCSS, React 19 + TanStack Router)
- **API Connection**: Web UI detects `window.AGI_SERVER_URL` injected by `web-server.ts`
- **Server**: CLI starts both AGI API server (Hono) and Web UI server on sequential ports
- **Web SDK**: Shared hooks and components in `packages/web-sdk/` for API integration

### How Current System Works
1. User runs `agi serve [--port X] [--network]`
2. CLI spawns AGI server (Hono-based) on requested port
3. CLI spawns Web UI server on port+1, injects `window.AGI_SERVER_URL`
4. Web UI uses `window.AGI_SERVER_URL` for all API calls
5. Both servers run in subprocess, user opens browser to Web UI port

## Desktop Architecture (Tauri 2.0)

### High-Level Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                     AGI Desktop (Tauri 2.0)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Project    │  │   GitHub     │  │   Git Operations       │ │
│  │  Picker     │  │   OAuth      │  │   (git2-rs)            │ │
│  │             │  │              │  │                        │ │
│  │ • Open Folder│ │ • Login      │  │ • Clone (HTTPS+token)  │ │
│  │ • Recent    │  │ • Repo list  │  │ • Commit               │ │
│  │ • Clone     │  │ • Token mgmt │  │ • Push / Pull          │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                     Rust Backend (Tauri)                        │
│  • CLI subprocess manager (spawn agi serve)                     │
│  • OS keychain (token storage via keyring crate)                │
│  • File system access                                           │
│  • Native dialogs                                               │
├─────────────────────────────────────────────────────────────────┤
│                     Embedded Web UI                             │
│  • Same React app (apps/web)                                    │
│  • Tauri bridge detection (__TAURI__)                           │
│  • Desktop-specific UI (project picker, git panel)              │
└─────────────────────────────────────────────────────────────────┘
```

### Stack
- **Framework**: Tauri 2.0 + Rust backend
- **Frontend**: Bundle existing web UI (Vite dist)
- **CLI**: Reuse existing compiled binary
- **Git**: `git2-rs` (libgit2 bindings) - native, no git CLI needed
- **OAuth**: `tauri-plugin-oauth` - localhost redirect capture
- **Secrets**: `keyring` crate - OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

### Key Components
1. **Tauri Window** - Native desktop window (macOS, Windows, Linux)
2. **Embedded Web UI** - Built from `apps/web/dist`, served via `tauri://` protocol
3. **CLI Binary Launcher** - Rust command to spawn CLI subprocess with cwd
4. **Project Manager** - Store recent projects, manage server ports/PIDs
5. **GitHub OAuth** - Browser-based login, token stored in OS keychain
6. **Git Operations** - Clone, commit, push via `git2-rs` (no SSH needed)
7. **Tauri IPC Bridge** - Frontend ↔ Rust backend communication

---

## Phase 1: Tauri 2.0 Project Setup

### 1.1 Project Structure
```
apps/desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/           # Tauri 2.0 permissions
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       └── commands/
│           ├── mod.rs
│           ├── project.rs      # open_folder, recent_projects
│           ├── server.rs       # start_server, stop_server
│           ├── github.rs       # oauth, list_repos
│           └── git.rs          # clone, commit, push, pull, status
├── src/                        # Minimal React shell
│   ├── App.tsx                 # Project picker UI
│   └── main.tsx
├── public/                     # Icons, app images
├── package.json
└── vite.config.ts
```

### 1.2 Tauri 2.0 Configuration
```json
// tauri.conf.json (Tauri 2.0 format)
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/config.schema.json",
  "productName": "AGI",
  "version": "0.1.0",
  "identifier": "com.agi-cli.desktop",
  "build": {
    "beforeBuildCommand": "bun run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "AGI",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app", "msi", "appimage"],
    "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"],
    "resources": ["resources/binaries/*"]
  },
  "plugins": {
    "oauth": {}
  }
}
```

### 1.3 Capabilities (Tauri 2.0 Permissions)
```json
// src-tauri/capabilities/default.json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema/capability.schema.json",
  "identifier": "default",
  "description": "Default capabilities for AGI desktop",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "shell:default",
    "process:default",
    "oauth:default"
  ]
}
```

### 1.4 Dependencies

#### Rust (Cargo.toml)
```toml
[package]
name = "agi-desktop"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-process = "2"
tauri-plugin-oauth = "2"

# Git operations
git2 = "0.19"

# Secure token storage
keyring = "3"

# Async runtime
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# HTTP client (for GitHub API)
reqwest = { version = "0.12", features = ["json"] }

# Utils
anyhow = "1"
dirs = "5"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

#### JavaScript (package.json)
```json
{
  "name": "agi-desktop",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "@fabianlars/tauri-plugin-oauth": "^2",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "vite": "^6"
  }
}
```

---

## Phase 2: Project Picker & Server Management

### 2.1 Tauri IPC Commands (Project & Server)
```rust
// src-tauri/src/commands/project.rs
use tauri::State;
use tauri_plugin_dialog::DialogExt;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Project {
    pub path: String,
    pub name: String,
    pub last_opened: String,
    pub pinned: bool,
}

#[tauri::command]
pub async fn open_project_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app
        .dialog()
        .file()
        .pick_folder()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(folder.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn get_recent_projects() -> Result<Vec<Project>, String> {
    let config_path = dirs::home_dir()
        .ok_or("No home directory")?
        .join(".agi")
        .join("desktop-projects.json");
    
    if !config_path.exists() {
        return Ok(vec![]);
    }
    
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| e.to_string())?;
    
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_recent_project(project: Project) -> Result<(), String> {
    let config_dir = dirs::home_dir()
        .ok_or("No home directory")?
        .join(".agi");
    
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let config_path = config_dir.join("desktop-projects.json");
    let mut projects = get_recent_projects().await.unwrap_or_default();
    
    // Remove if exists, add to front
    projects.retain(|p| p.path != project.path);
    projects.insert(0, project);
    projects.truncate(10); // Keep last 10
    
    let content = serde_json::to_string_pretty(&projects)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&config_path, content).map_err(|e| e.to_string())
}
```

### 2.2 Server Management
```rust
// src-tauri/src/commands/server.rs
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

#[derive(serde::Serialize, Clone)]
pub struct ServerInfo {
    pub pid: u32,
    pub port: u16,
    pub web_port: u16,
    pub url: String,
    pub project_path: String,
}

pub struct ServerState {
    pub servers: Mutex<Vec<(Child, ServerInfo)>>,
}

#[tauri::command]
pub async fn start_server(
    project_path: String,
    state: State<'_, ServerState>,
    app: tauri::AppHandle,
) -> Result<ServerInfo, String> {
    // Get binary path for current platform
    let binary = get_binary_path(&app)?;
    
    // Spawn: agi serve --port 0 (OS picks available port)
    let mut child = Command::new(&binary)
        .current_dir(&project_path)
        .args(["serve", "--port", "0"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;
    
    // Parse port from stdout (CLI logs: "🚀 agi server listening on http://localhost:PORT")
    let port = parse_server_port(&mut child)?;
    
    let info = ServerInfo {
        pid: child.id(),
        port,
        web_port: port + 1,
        url: format!("http://localhost:{}", port + 1),
        project_path: project_path.clone(),
    };
    
    state.servers.lock().unwrap().push((child, info.clone()));
    
    Ok(info)
}

#[tauri::command]
pub async fn stop_server(pid: u32, state: State<'_, ServerState>) -> Result<(), String> {
    let mut servers = state.servers.lock().unwrap();
    
    if let Some(pos) = servers.iter().position(|(_, info)| info.pid == pid) {
        let (mut child, _) = servers.remove(pos);
        child.kill().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn stop_all_servers(state: State<'_, ServerState>) -> Result<(), String> {
    let mut servers = state.servers.lock().unwrap();
    
    for (mut child, _) in servers.drain(..) {
        let _ = child.kill();
    }
    
    Ok(())
}

fn get_binary_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    
    // Map to our naming convention
    let (os_name, arch_name) = match (os, arch) {
        ("macos", "aarch64") => ("darwin", "arm64"),
        ("macos", "x86_64") => ("darwin", "x64"),
        ("linux", "x86_64") => ("linux", "x64"),
        ("linux", "aarch64") => ("linux", "arm64"),
        ("windows", "x86_64") => ("windows", "x64"),
        _ => return Err(format!("Unsupported platform: {}-{}", os, arch)),
    };
    
    let binary_name = format!("agi-{}-{}", os_name, arch_name);
    
    // Try resources first (bundled app)
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("binaries")
        .join(&binary_name);
    
    if resource_path.exists() {
        return Ok(resource_path);
    }
    
    Err(format!("Binary not found: {}", binary_name))
}

fn parse_server_port(child: &mut Child) -> Result<u16, String> {
    use std::io::{BufRead, BufReader};
    
    let stdout = child.stdout.take()
        .ok_or("No stdout")?;
    
    let reader = BufReader::new(stdout);
    
    for line in reader.lines().take(20) {
        let line = line.map_err(|e| e.to_string())?;
        
        // Look for: "🚀 agi server listening on http://localhost:PORT"
        if line.contains("listening on") {
            if let Some(port_str) = line.split(':').last() {
                if let Ok(port) = port_str.trim().parse::<u16>() {
                    return Ok(port);
                }
            }
        }
    }
    
    Err("Could not parse server port from output".to_string())
}
```

---

## Phase 3: GitHub OAuth Integration

### 3.1 OAuth Flow
```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  AGI App    │ ───► │  Browser    │ ───► │  GitHub     │
│  (desktop)  │      │  (OAuth)    │      │  (auth)     │
└─────────────┘      └─────────────┘      └─────────────┘
       │                                         │
       │◄────────── access_token ────────────────┘
       │           (stored in OS keychain)
       ▼
   ┌─────────────────────────────────────────────┐
   │ Token stored in:                            │
   │ • macOS: Keychain                           │
   │ • Windows: Credential Manager               │
   │ • Linux: Secret Service (GNOME Keyring)     │
   └─────────────────────────────────────────────┘
```

### 3.2 GitHub OAuth Commands
```rust
// src-tauri/src/commands/github.rs
use keyring::Entry;
use tauri_plugin_oauth::start;

const GITHUB_CLIENT_ID: &str = "YOUR_GITHUB_OAUTH_APP_CLIENT_ID";
const KEYRING_SERVICE: &str = "agi-desktop";
const KEYRING_USER: &str = "github-token";

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub private: bool,
    pub description: Option<String>,
}

#[derive(serde::Serialize)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

#[tauri::command]
pub async fn github_login(window: tauri::Window) -> Result<(), String> {
    // Start localhost OAuth server (tauri-plugin-oauth)
    let port = start(move |url| {
        // Parse the callback URL for the code
        if let Some(code) = extract_code_from_url(&url) {
            // Exchange code for token (in a real app, do this server-side or use PKCE)
            let _ = window.emit("github_oauth_code", code);
        }
    })
    .map_err(|e| e.to_string())?;
    
    // Open browser to GitHub OAuth
    let auth_url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri=http://localhost:{}&scope=repo,user",
        GITHUB_CLIENT_ID,
        port
    );
    
    open::that(&auth_url).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn github_exchange_code(code: String) -> Result<String, String> {
    // Exchange code for access token
    // NOTE: In production, use PKCE flow or exchange via your backend
    let client = reqwest::Client::new();
    
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("code", &code),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    #[derive(serde::Deserialize)]
    struct TokenResponse {
        access_token: String,
    }
    
    let token_response: TokenResponse = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    // Store in OS keychain
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| e.to_string())?;
    
    entry
        .set_password(&token_response.access_token)
        .map_err(|e| e.to_string())?;
    
    Ok(token_response.access_token)
}

#[tauri::command]
pub async fn github_get_token() -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| e.to_string())?;
    
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn github_logout() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| e.to_string())?;
    
    entry.delete_credential().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_get_user(token: String) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "agi-desktop")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    response.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_list_repos(token: String) -> Result<Vec<GitHubRepo>, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://api.github.com/user/repos?sort=updated&per_page=50")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "agi-desktop")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    response.json().await.map_err(|e| e.to_string())
}

fn extract_code_from_url(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()?
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, value)| value.to_string())
}
```

---

## Phase 4: Git Operations (No SSH Required)

### 4.1 Git Commands via git2-rs
```rust
// src-tauri/src/commands/git.rs
use git2::{Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository};

#[derive(serde::Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub changed_files: Vec<ChangedFile>,
    pub has_changes: bool,
}

#[derive(serde::Serialize)]
pub struct ChangedFile {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "renamed"
}

/// Clone a repository using HTTPS + OAuth token (no SSH needed)
#[tauri::command]
pub async fn git_clone(
    url: String,
    path: String,
    token: String,
) -> Result<(), String> {
    // Convert GitHub URL to authenticated HTTPS
    // https://github.com/user/repo.git → https://x-access-token:TOKEN@github.com/user/repo.git
    let auth_url = url.replace(
        "https://github.com",
        &format!("https://x-access-token:{}@github.com", token),
    );
    
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token)
    });
    
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);
    
    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fetch_options);
    
    builder
        .clone(&auth_url, std::path::Path::new(&path))
        .map_err(|e| format!("Clone failed: {}", e))?;
    
    Ok(())
}

/// Get repository status
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    let repo = Repository::open(&path)
        .map_err(|e| format!("Not a git repository: {}", e))?;
    
    // Get current branch
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head
        .shorthand()
        .unwrap_or("HEAD")
        .to_string();
    
    // Get changed files
    let mut changed_files = Vec::new();
    let statuses = repo
        .statuses(None)
        .map_err(|e| e.to_string())?;
    
    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();
        
        let status_str = if status.is_index_new() || status.is_wt_new() {
            "added"
        } else if status.is_index_deleted() || status.is_wt_deleted() {
            "deleted"
        } else if status.is_index_renamed() || status.is_wt_renamed() {
            "renamed"
        } else {
            "modified"
        };
        
        changed_files.push(ChangedFile {
            path,
            status: status_str.to_string(),
        });
    }
    
    // Get ahead/behind (simplified)
    let (ahead, behind) = (0, 0); // TODO: implement tracking
    
    Ok(GitStatus {
        branch,
        ahead,
        behind,
        has_changes: !changed_files.is_empty(),
        changed_files,
    })
}

/// Stage all changes and commit
#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&path)
        .map_err(|e| e.to_string())?;
    
    // Stage all changes
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    
    // Create commit
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
    
    let head = repo.head().map_err(|e| e.to_string())?;
    let parent = repo
        .find_commit(head.target().ok_or("No HEAD target")?)
        .map_err(|e| e.to_string())?;
    
    let sig = repo.signature().map_err(|e| e.to_string())?;
    
    let commit_id = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])
        .map_err(|e| e.to_string())?;
    
    Ok(commit_id.to_string())
}

/// Push to remote using OAuth token
#[tauri::command]
pub async fn git_push(path: String, token: String) -> Result<(), String> {
    let repo = Repository::open(&path)
        .map_err(|e| e.to_string())?;
    
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| e.to_string())?;
    
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token)
    });
    
    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);
    
    // Get current branch
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head.shorthand().unwrap_or("main");
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    
    remote
        .push(&[&refspec], Some(&mut push_options))
        .map_err(|e| format!("Push failed: {}", e))?;
    
    Ok(())
}

/// Pull from remote
#[tauri::command]
pub async fn git_pull(path: String, token: String) -> Result<(), String> {
    let repo = Repository::open(&path)
        .map_err(|e| e.to_string())?;
    
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| e.to_string())?;
    
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token)
    });
    
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);
    
    // Fetch
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head.shorthand().unwrap_or("main");
    
    remote
        .fetch(&[branch], Some(&mut fetch_options), None)
        .map_err(|e| format!("Fetch failed: {}", e))?;
    
    // Fast-forward merge (simplified)
    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| e.to_string())?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| e.to_string())?;
    
    let (analysis, _) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;
    
    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{}", branch);
        let mut reference = repo
            .find_reference(&refname)
            .map_err(|e| e.to_string())?;
        reference
            .set_target(fetch_commit.id(), "Fast-forward")
            .map_err(|e| e.to_string())?;
        repo.set_head(&refname).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(
            git2::build::CheckoutBuilder::default().force(),
        ))
        .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

---

## Phase 5: Web UI Integration

### 5.1 Tauri Bridge Module
```typescript
// packages/web-sdk/src/lib/tauri-bridge.ts
import { invoke } from '@tauri-apps/api/core';

export interface Project {
  path: string;
  name: string;
  lastOpened: string;
  pinned: boolean;
}

export interface ServerInfo {
  pid: number;
  port: number;
  webPort: number;
  url: string;
  projectPath: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  cloneUrl: string;
  private: boolean;
  description: string | null;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  changedFiles: Array<{ path: string; status: string }>;
  hasChanges: boolean;
}

export const isDesktopApp = (): boolean => {
  try {
    return '__TAURI__' in window;
  } catch {
    return false;
  }
};

export const tauriBridge = {
  // Project management
  openProjectDialog: () => invoke<string | null>('open_project_dialog'),
  getRecentProjects: () => invoke<Project[]>('get_recent_projects'),
  saveRecentProject: (project: Project) => 
    invoke('save_recent_project', { project }),

  // Server management
  startServer: (projectPath: string) => 
    invoke<ServerInfo>('start_server', { projectPath }),
  stopServer: (pid: number) => 
    invoke('stop_server', { pid }),
  stopAllServers: () => 
    invoke('stop_all_servers'),

  // GitHub OAuth
  githubLogin: () => invoke('github_login'),
  githubExchangeCode: (code: string) => 
    invoke<string>('github_exchange_code', { code }),
  githubGetToken: () => invoke<string | null>('github_get_token'),
  githubLogout: () => invoke('github_logout'),
  githubGetUser: (token: string) => 
    invoke<GitHubUser>('github_get_user', { token }),
  githubListRepos: (token: string) => 
    invoke<GitHubRepo[]>('github_list_repos', { token }),

  // Git operations
  gitClone: (url: string, path: string, token: string) => 
    invoke('git_clone', { url, path, token }),
  gitStatus: (path: string) => 
    invoke<GitStatus>('git_status', { path }),
  gitCommit: (path: string, message: string) => 
    invoke<string>('git_commit', { path, message }),
  gitPush: (path: string, token: string) => 
    invoke('git_push', { path, token }),
  gitPull: (path: string, token: string) => 
    invoke('git_pull', { path, token }),
};
```

### 5.2 Desktop Detection
```typescript
// packages/web-sdk/src/lib/is-desktop.ts
export const isDesktopApp = (): boolean => {
  try {
    return '__TAURI__' in window;
  } catch {
    return false;
  }
};

export const isTauri = isDesktopApp;
```

### 5.3 Desktop-Only UI Components

#### Welcome/Project Picker Screen
```
┌─────────────────────────────────────────────────────────────┐
│  AGI Desktop                              [_][□][×]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Welcome! Choose a project:                                │
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │ 📁 Open     │  │ 🐙 Clone    │  │ ⭐ Recent   │        │
│   │   Folder    │  │  from GitHub│  │  Projects   │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│   Recent:                                                   │
│   ├─ ~/dev/my-app          (last opened 2h ago)            │
│   ├─ ~/dev/another-project (last opened yesterday)         │
│   └─ ~/dev/old-project     (last opened 3 days ago)        │
│                                                             │
│   ─────────────────────────────────────────────────         │
│   👤 nitishxyz  [Disconnect GitHub]                         │
│   or: Not logged in to GitHub  [Connect GitHub]             │
└─────────────────────────────────────────────────────────────┘
```

#### Clone from GitHub Modal
```
┌─────────────────────────────────────────────────────────────┐
│  Clone from GitHub                                [×]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 Search repositories...                                  │
│                                                             │
│  Your Repositories:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📦 nitishxyz/agi                                    │   │
│  │    AI-powered development assistant                  │   │
│  │                                          [Clone]     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 🔒 nitishxyz/private-project                        │   │
│  │    Private project                                   │   │
│  │                                          [Clone]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Clone to: ~/Projects/[repo-name]  [Browse...]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Git Status Bar (Bottom of Main UI)
```
┌─────────────────────────────────────────────────────────────┐
│ [Existing AGI Web UI - Chat, Agents, etc.]                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🌿 main  │  3 files changed  │  [↑ Push]  [↓ Pull]  [📝]  │
└─────────────────────────────────────────────────────────────┘

Clicking 📝 opens commit dialog:
┌─────────────────────────────────────────────────────────────┐
│  Commit Changes                                    [×]      │
├─────────────────────────────────────────────────────────────┤
│  Changed files:                                             │
│  ☑ M  src/components/Button.tsx                            │
│  ☑ M  src/utils/helpers.ts                                 │
│  ☑ A  src/components/Modal.tsx                             │
│                                                             │
│  Commit message:                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Add modal component with animations                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────────────────┐            │
│  │    Commit    │  │    Commit & Push         │            │
│  └──────────────┘  └──────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 6: Binary Distribution & Platform Support

### 6.1 Binary Distribution Strategy
```
dist/
├── agi-darwin-arm64     ← macOS ARM (Apple Silicon)
├── agi-darwin-x64       ← macOS Intel
├── agi-linux-x64        ← Linux x86_64
├── agi-linux-arm64      ← Linux ARM
└── agi-windows-x64.exe  ← Windows (future)

// Tauri embeds appropriate binary for the platform at build time
apps/desktop/src-tauri/resources/
└── binaries/
    ├── agi-darwin-arm64
    ├── agi-darwin-x64
    ├── agi-linux-x64
    └── agi-linux-arm64
```

### 6.2 Build Output
```
apps/desktop/src-tauri/target/release/bundle/
├── dmg/AGI_0.1.0_aarch64.dmg        (macOS ARM)
├── dmg/AGI_0.1.0_x64.dmg            (macOS Intel)
├── msi/AGI_0.1.0_x64.msi            (Windows)
├── appimage/AGI_0.1.0_amd64.AppImage (Linux)
└── deb/AGI_0.1.0_amd64.deb          (Debian/Ubuntu)
```

### 6.3 Platform-Specific Notes
- **macOS**: Code sign + notarize DMG (requires Apple Developer account)
- **Windows**: Sign MSI with code signing certificate
- **Linux**: AppImage is self-contained; consider Snap/Flatpak for stores

---

## Implementation Roadmap

### Week 1: Foundation (Phase 1-2)
1. Initialize Tauri 2.0 project with `bun create tauri-app`
2. Set up Rust commands (project, server)
3. Implement binary path resolution and subprocess spawning
4. Create project picker UI
5. Test server startup from Tauri on macOS

### Week 2: GitHub Integration (Phase 3)
6. Set up GitHub OAuth App
7. Implement `tauri-plugin-oauth` flow
8. Add keyring token storage
9. Create GitHub login UI
10. Implement repo listing

### Week 3: Git Operations (Phase 4)
11. Implement git clone via git2-rs
12. Add git status command
13. Implement commit functionality
14. Add push/pull operations
15. Create git status bar UI

### Week 4: Polish & Distribution (Phase 5-6)
16. Complete tauri-bridge.ts in web-sdk
17. Add desktop-only components to web UI
18. Test full flow end-to-end
19. Build DMG, MSI, AppImage
20. Test on all platforms

---

## Security Considerations

1. **OAuth tokens** - Stored in OS keychain, never in plaintext files
2. **No client secret exposure** - Use PKCE flow or server-side exchange
3. **HTTPS only** - All git operations use HTTPS, not SSH
4. **Token scopes** - Request minimal scopes (`repo`, `user`)
5. **Token revocation** - Users can revoke via GitHub settings anytime

---

## Success Criteria

- [x] Double-click to open AGI Desktop (no CLI needed)
- [x] "Open Folder" works with native file picker
- [x] "Connect GitHub" → PAT input → back to app (OAuth optional)
- [x] Clone any repo from GitHub (public or private)
- [ ] View git status (branch, changed files)
- [ ] Commit changes with message
- [x] Push to GitHub (no SSH keys needed) - backend ready
- [x] Server starts automatically when project opens
- [ ] App closes → server subprocess killed
- [ ] Builds as DMG (macOS), MSI (Windows), AppImage (Linux)

---

## Future Enhancements

- [ ] Multi-project tabs
- [ ] Native menus and keyboard shortcuts
- [ ] Branch switching UI
- [ ] Pull request creation
- [ ] Conflict resolution UI
- [ ] Auto-updates via `tauri-plugin-updater`
- [ ] Mobile companion app (iOS/Android) using Tauri 2.0 mobile
- [ ] Workspace/multi-repo management
- [ ] Drag-drop folder support
