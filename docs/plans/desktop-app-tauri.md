# Desktop App (Tauri) - Implementation Plan

## Overview
Desktop application built with Tauri that wraps the compiled AGI CLI binary, embeds the React-based web UI, and provides native project management. Launches the CLI as a subprocess on "Open Project" to run the AGI server in any directory.

## Current Architecture

### Existing Infrastructure (Already Built)
- **CLI Binary**: Already compiled to static executables for darwin-arm64, darwin-x64, linux-x64, linux-arm64
- **Build Process**: `bun build --compile` embeds web UI + all dependencies into single binary
- **Web UI**: Embedded at `apps/cli/src/web-dist/` during build (Vite + TailwindCSS, React 19 + TanStack Router)
- **API Connection**: Web UI detects `window.AGI_SERVER_URL` injected by `web-server.ts` for local development/serve
- **Server**: CLI starts both AGI API server (Hono) and Web UI server on sequential ports
- **Web SDK**: Shared hooks and components in `packages/web-sdk/` for API integration

### How Current System Works
1. User runs `agi serve [--port X] [--network]`
2. CLI spawns AGI server (Hono-based) on requested port
3. CLI spawns Web UI server on port+1, injects `window.AGI_SERVER_URL = http://localhost:PORT`
4. Web UI uses `window.AGI_SERVER_URL` for all API calls (fallback to `localhost:3001`)
5. Both servers run in subprocess, user opens browser to Web UI port

## Desktop Architecture (Tauri Wrapper)

### Stack
- **Framework**: Tauri 2.x + Rust backend
- **Frontend**: Bundle existing web UI (Vite dist)
- **CLI**: Reuse existing compiled binary (darwin-arm64, darwin-x64, linux-x64, linux-arm64)
- **Backend**: Rust process manager + IPC bridge
- **Lifecycle**: User opens project → Tauri spawns CLI binary → CLI starts servers → Tauri window loads Web UI at local URL

### Key Components
1. **Tauri Window** - Native desktop window (macOS, Windows, Linux)
2. **Embedded Web UI** - Built from `apps/web/dist`, served by Tauri via `tauri://` protocol
3. **CLI Binary Launcher** - Rust command to spawn CLI subprocess with cwd
4. **Project Manager** - Store recent projects, manage server ports/PIDs
5. **Tauri IPC Bridge** - Frontend ↔ Rust backend communication

## Phase 1: MVP Setup (Foundation)

### 1.1 Project Structure
```
apps/desktop/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Window creation
│   │   ├── commands.rs     # Tauri commands (IPC)
│   │   ├── server.rs       # CLI process management
│   │   └── projects.rs     # Project metadata + storage
│   └── Cargo.toml
├── src/                    # Minimal React wrapper (just a shell)
├── src-web-embed/          # Copy of apps/web/dist (embedded at build time)
├── public/                 # Icons, app images
├── tauri.conf.json         # Tauri config (window, permissions, bundle)
└── package.json
```

### 1.2 Approach: Reuse Binary + Web UI
- **No custom CLI embedding** - Use existing compiled binaries in `dist/` directory
- **Binary Distribution**: Include precompiled binaries for each OS in Tauri resources
- **Web UI Embedding**: Copy `apps/web/dist` → `apps/desktop/src-web-embed/` during Tauri build
- **No Node.js Runtime Needed** - Binary is self-contained via Bun compilation

### 1.3 MVP Scope
- [ ] Create Tauri project (`cargo create-tauri-app`)
- [ ] Set up Rust IPC command handlers
- [ ] Add file dialog command for "Open Project"
- [ ] Implement CLI subprocess spawning with cwd
- [ ] Create minimal React wrapper that loads Web UI at `tauri://localhost:PORT`
- [ ] Store & retrieve recent projects (JSON file)
- [ ] Handle server lifecycle (start/stop/cleanup on app exit)

### 1.4 Tauri IPC Commands
```rust
// commands/mod.rs
#[tauri::command]
async fn open_project_dialog() -> Result<String, String>
  // File picker → directory path

#[tauri::command]
async fn start_server(project_path: String, port: Option<u16>) -> Result<ServerInfo, String>
  // Spawn CLI binary in project_path cwd → returns { port, url, pid }

#[tauri::command]
async fn stop_server(pid: u32) -> Result<(), String>
  // Kill subprocess

#[tauri::command]
async fn get_recent_projects() -> Result<Vec<Project>, String>
  // Read from ~/.agi/desktop-projects.json

#[tauri::command]
async fn save_recent_project(path: String) -> Result<(), String>
  // Add to recent list
```

## Phase 2: Web UI Integration

### 2.1 Desktop Detection & Conditional UI
```typescript
// packages/web-sdk/src/lib/is-desktop.ts
export const isDesktopApp = () => {
  try {
    return '__TAURI__' in window;
  } catch {
    return false;
  }
};
```

### 2.2 Tauri Bridge Module
```typescript
// packages/web-sdk/src/lib/tauri-bridge.ts
import { invoke } from '@tauri-apps/api/core';

export const tauriBridge = {
  openProject: () => invoke('open_project_dialog'),
  startServer: (path: string) => invoke('start_server', { project_path: path }),
  stopServer: (pid: number) => invoke('stop_server', { pid }),
  getRecentProjects: () => invoke('get_recent_projects'),
  saveRecentProject: (path: string) => invoke('save_recent_project', { path }),
};
```

### 2.3 Web UI Updates
Add to **apps/web** (not breaking existing web version):
- [ ] Detect if running in Tauri → show "Open Project" button in header
- [ ] On click: invoke `openProject()` → `startServer(path)` → redirect to server URL
- [ ] Add desktop-only sidebar section for Recent Projects
- [ ] Store current project path in localStorage
- [ ] Desktop menu integration (File → Open Project, Preferences)

### 2.4 Server URL Injection
- Tauri serves web UI via `tauri://` protocol OR custom handler
- On project open: Tauri passes server URL via command-line arg or env var
- Web UI updates `window.AGI_SERVER_URL` dynamically

## Phase 3: Binary Distribution & Platform Support

### 3.1 Binary Distribution Strategy
```
dist/
├── agi-darwin-arm64     ← macOS ARM (Apple Silicon)
├── agi-darwin-x64       ← macOS Intel
├── agi-linux-x64        ← Linux x86_64
└── agi-linux-arm64      ← Linux ARM (Raspberry Pi, etc.)

// Tauri embeds appropriate binary for the platform at build time
resources/
└── binaries/
    ├── agi-darwin-arm64
    ├── agi-darwin-x64
    ├── agi-linux-x64
    └── agi-linux-arm64
```

### 3.2 Tauri Configuration
```toml
# tauri.conf.json
{
  "build": {
    "beforeBuildCommand": "bun run build:web && bun run build:all-bins",
    "devPath": "http://localhost:5173",  // Vite dev server
    "frontendDist": "../web/dist"
  },
  "bundle": {
    "resources": ["./resources/binaries/*"],
    "macOS": { "signingIdentity": "..." },
    "windows": { "certificateThumbprint": "..." }
  }
}
```

### 3.3 Runtime Binary Selection
```rust
// src-tauri/src/server.rs
fn get_binary_path() -> PathBuf {
  let target = std::env::consts::OS;
  let arch = std::env::consts::ARCH;
  let binary_name = format!("agi-{}-{}", target, arch);
  
  // Try app resources first (compiled app), then fallback to parent dist/
  let app_handle = /* from state */;
  app_handle.path().resource_dir()
    .join("binaries")
    .join(binary_name)
}
```

## Phase 4: Project Management & History

### 4.1 Project State File
```json
// ~/.agi/desktop-projects.json
{
  "recent": [
    {
      "path": "/Users/me/my-project",
      "name": "my-project",
      "lastOpened": "2025-01-16T10:30:00Z",
      "pinned": true
    }
  ]
}
```

### 4.2 Server Registry (Runtime)
Track active servers during session:
```rust
struct ServerInfo {
  project_path: PathBuf,
  port: u16,
  pid: u32,
  started_at: SystemTime,
}

static SERVERS: Mutex<Vec<ServerInfo>> = Mutex::new(Vec::new());
```

### 4.3 Features
- [ ] Click project in Recent list → auto-restart server if needed
- [ ] Pin/unpin projects for quick access
- [ ] Show running server status (port, PID)
- [ ] One-click "Open in Terminal" for project directory
- [ ] Project settings/metadata view

## Phase 5: Server Lifecycle & Connection Management

### 5.1 Full Server Bootstrap Flow
```
1. User clicks "Open Project" button in Web UI
2. Tauri file picker dialog opens (invoke tauri-bridge)
3. User selects directory → Tauri command: `start_server(path)`
4. Rust backend spawns CLI binary in that cwd: 
   spawn("agi-darwin-arm64", ["serve", "--port", "0"])
5. CLI outputs server port (parse stdout)
6. Tauri returns { port: 3001, url: "http://localhost:3001" }
7. Web UI receives response → `window.AGI_SERVER_URL = "http://localhost:3001"`
8. Web UI redirects to `/` or project root → starts working
9. On exit, Tauri kills subprocess
```

### 5.2 Port & Process Management
```rust
// src-tauri/src/server.rs
pub fn start_server(project_path: &str, requested_port: Option<u16>) -> Result<ServerInfo> {
  // 1. Find available port (use 0 = OS picks random)
  let port = requested_port.unwrap_or(0);
  
  // 2. Get binary path for current platform
  let binary = get_binary_path()?;
  
  // 3. Spawn: agi serve --port PORT in project_path cwd
  let mut child = Command::new(binary)
    .current_dir(project_path)
    .args(&["serve", "--port", &port.to_string()])
    .stdout(Stdio::piped())
    .spawn()?;
  
  // 4. Parse actual port from stdout (CLI logs: "🚀 agi server listening on http://localhost:3001")
  let actual_port = parse_server_port(child.stdout.as_mut())?;
  
  // 5. Store in registry
  let info = ServerInfo { /* ... */ };
  SERVERS.lock().unwrap().push(info.clone());
  
  Ok(info)
}

pub fn stop_server(pid: u32) {
  // Kill process tree
  #[cfg(unix)]
  std::process::Command::new("kill").arg(pid.to_string()).output().ok();
  
  // Remove from registry
  SERVERS.lock().unwrap().retain(|s| s.pid != pid);
}
```

### 5.3 Graceful Shutdown
- On app exit: Kill all registered servers
- On project switch: Kill previous server, start new one
- Trap SIGTERM/SIGINT to ensure cleanup

## Dependencies & Build Setup

### Rust
```toml
tauri = "2.x"
tauri-build = "2.x"
tauri-plugin-shell = "2.x"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dirs = "5.x"
anyhow = "1.x"
```

### JavaScript/TypeScript
```json
{
  "@tauri-apps/cli": "^2.x",
  "@tauri-apps/api": "^2.x",
  "@tauri-apps/plugin-shell": "^2.x",
  "typescript": "latest"
}
```

## Known Considerations & Gotchas

1. **Binary Path Resolution**: Must work in both dev (`cargo tauri dev`) and production (bundled app)
2. **Server Port Parsing**: Parse CLI stdout to get actual port (use streaming capture)
3. **CWD Context**: Ensure CLI runs in correct directory for `.agi/config.json` discovery
4. **Process Cleanup**: Must kill server subprocess when app closes OR user switches projects
5. **Port Conflicts**: If port 3001 taken, CLI will pick random via `--port 0`
6. **File Permissions**: Request `fs:all` in tauri.conf.json for file dialogs
7. **Code Signing**: macOS requires signing; Windows needs code signing cert for MSI
8. **Cross-Platform Paths**: Use `std::path::PathBuf` not hardcoded `/` paths
9. **IPC Deadlocks**: Avoid blocking Tauri thread while waiting for long-running CLI processes
10. **Web UI URL Injection**: May need to update `window.AGI_SERVER_URL` after page load

## Distribution & Packaging Strategy

### Build Output
```
src-tauri/target/release/
├── bundle/
│   ├── dmg/agi-0.1.0.dmg        (macOS)
│   ├── msi/agi-0.1.0.msi        (Windows)
│   └── appimage/agi-0.1.0.AppImage (Linux)
```

### Platform-Specific
- **macOS**: Code sign + notarize DMG (requires Apple Developer account)
- **Windows**: Sign MSI with code signing certificate
- **Linux**: AppImage is self-contained; consider Snap for snap store

### Auto-Updates (Future)
- Integrate `tauri-plugin-updater` for app version checking
- Host releases on GitHub Releases or custom update server

## Success Criteria for MVP

- ✓ Tauri window opens with embedded web UI (localhost:1430 or tauri protocol)
- ✓ "Open Project" button triggers file picker
- ✓ Selected directory → CLI server spawns in that cwd → returns port
- ✓ Web UI detects server URL, updates `window.AGI_SERVER_URL`, reloads
- ✓ Can chat, run agents, browse sessions (same as web version)
- ✓ App closes → server subprocess killed, no orphaned processes
- ✓ Runs on macOS (Intel + ARM) and Linux
- ✓ Can package as DMG (macOS) and AppImage (Linux)

## Implementation Roadmap

### Week 1: Foundation
1. Initialize Tauri project (`npm create tauri-app`)
2. Set up Rust IPC commands (open_project, start_server, stop_server)
3. Implement binary path resolution and subprocess spawning
4. Test server startup from Tauri on macOS

### Week 2: Web UI Integration
5. Create tauri-bridge.ts in web-sdk
6. Add "Open Project" button to web UI (conditional on `isDesktopApp()`)
7. Integrate project opening flow (invoke → start → redirect)
8. Test web UI ↔ Rust IPC communication

### Week 3: Refinement & Distribution
9. Add Recent Projects UI and persistence
10. Test project switching and server cleanup
11. Build DMG and test macOS distribution
12. Test AppImage for Linux

### Future Phases
- Multi-project tabs (future enhancement)
- Native menus and keyboard shortcuts
- Settings panel for server options
- Drag-drop project folder support
- Workspace management
