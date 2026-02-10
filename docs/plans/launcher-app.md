# otto team launcher — Design Spec

## Overview

A lightweight desktop app that manages Docker-based otto instances for non-dev team members. One app, all platforms, zero terminal.

## Problem

Non-developers need to vibecode via otto's Web UI but can't deal with:
- Terminal commands
- SSH key management
- Docker CLI
- Port conflicts when running multiple projects

## Solution

A Tauri-based desktop app (~5MB) that wraps Docker lifecycle management in a GUI. It handles deploy key encryption, container management, and dynamic port allocation.

## Architecture

```
┌─────────────────────────────────────────┐
│            otto team launcher           │
│              (Tauri app)                │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Admin View  │  │  Team View       │  │
│  │             │  │                  │  │
│  │ • Add repo  │  │ • Import config  │  │
│  │ • Gen keys  │  │ • Start/Stop     │  │
│  │ • Set pass  │  │ • Update/Nuke    │  │
│  │ • Export    │  │ • Open Web UI    │  │
│  └─────────────┘  └──────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │       Docker Engine (API)        │   │
│  │  • Container lifecycle           │   │
│  │  • Port allocation               │   │
│  │  • Log streaming                 │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │                    │
    ┌────┴────┐         ┌────┴────┐
    │ otto    │         │ otto    │
    │ :19000  │         │ :19002  │
    │ repo-A  │         │ repo-B  │
    └─────────┘         └─────────┘
```

## Port Allocation

Reuse the desktop app's port allocation pattern from `server.rs`:

- **Base port**: `19000`
- **Each instance uses 2 ports**: API (even) + Web UI (odd)
  - Instance 1: `19000` (API) + `19001` (Web UI)
  - Instance 2: `19002` (API) + `19003` (Web UI)
  - Instance 3: `19004` (API) + `19005` (Web UI)
- **Dev server ports**: Each container gets a 100-port range
  - Instance 1: `3000-3099`
  - Instance 2: `3100-3199`
  - Instance 3: `3200-3299`
- Port availability is checked before assignment (TCP bind check)
- Tracked in a local SQLite DB or JSON file so ports survive app restarts

### Container naming

`otto-<repo-slug>-<port>` — e.g. `otto-frontend-19000`

## Flows

### Admin: Create Team Config

```
1. Open launcher → "New Team Project"
2. Enter repo URL (git@github.com:org/repo.git)
3. App generates ed25519 deploy key
4. Shows public key → "Copy and add to GitHub repo → Deploy Keys"
5. Admin confirms key is added → "Set team password"
6. App encrypts private key with password (AES-256-CBC + PBKDF2)
7. Generates a `.otto` config file:
   {
     "repo": "git@github.com:org/repo.git",
     "key": "<encrypted-base64>",
     "gitName": "Team Name",
     "gitEmail": "team@example.com",
     "image": "oven/bun:1-debian"
   }
8. Admin shares `.otto` file via Slack/Drive + password via DM
```

### Team Member: Import & Start

```
1. Open launcher
2. Drag & drop `.otto` file (or File → Import)
3. Enter team password (one-time, stored in OS keychain)
4. Click "Start" → progress bar shows setup steps
5. Browser opens → Web UI → set up AI provider → vibecode
```

### Team Member: Daily Use

```
1. Open launcher
2. See project card with status (running/stopped)
3. Click "Start" or "Open Web UI"
```

## Views

### Home (Project List)

```
╔══════════════════════════════════════════════════╗
║  ⚡ otto team launcher                    ─ □ ✕  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Your Projects                    [+ Import]     ║
║                                                  ║
║  ┌────────────────────────────────────────────┐  ║
║  │  ● frontend               running :19001  │  ║
║  │  github.com/org/frontend                   │  ║
║  │  [Open Web UI]  [Stop]  [•••]              │  ║
║  └────────────────────────────────────────────┘  ║
║                                                  ║
║  ┌────────────────────────────────────────────┐  ║
║  │  ○ backend                 stopped         │  ║
║  │  github.com/org/backend                    │  ║
║  │  [Start]  [•••]                            │  ║
║  └────────────────────────────────────────────┘  ║
║                                                  ║
║  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ║
║    Drop .otto file here to add project      ║
║  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

### Setup Progress

```
╔══════════════════════════════════════════════════╗
║  Setting up frontend...                          ║
║                                                  ║
║  ✓ Installing system packages                    ║
║  ✓ Setting up SSH                                ║
║  ✓ Configuring git                               ║
║  ● Cloning repo...                               ║
║  ○ Installing dependencies                       ║
║  ○ Starting otto                                 ║
║                                                  ║
║  ━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░  65%            ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

### Project Actions Menu (•••)

- Restart otto serve
- Update otto CLI
- View logs
- Open shell
- Git pull (sync latest)
- Nuke & recreate

### Admin View (Settings → Team Admin)

- Create new team project
- Regenerate deploy key
- Change team password (re-encrypt)
- Export updated `.otto` file

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Shell | Tauri v2 | ~5MB, native, cross-platform, already used in desktop app |
| Frontend | React + Tailwind | Same as existing desktop app |
| Docker | Docker Engine API | HTTP API at `/var/run/docker.sock` (unix) or named pipe (windows) — no shelling out to docker CLI |
| Crypto | Web Crypto API + Rust ring | Key gen in Rust, encrypt/decrypt in either |
| Keychain | tauri-plugin-stronghold or OS keychain | Store decrypted password securely |
| State | JSON file in app data dir | Simple, no DB needed for this |

## Docker Engine API (no CLI dependency)

Instead of shelling out to `docker run`, use the Docker Engine API directly:

```
POST /containers/create
POST /containers/{id}/start
POST /containers/{id}/stop
DELETE /containers/{id}
GET /containers/{id}/logs
POST /containers/{id}/exec
```

Connect via:
- **macOS/Linux**: Unix socket `/var/run/docker.sock`
- **Windows**: Named pipe `//./pipe/docker_engine`

This removes the Docker CLI as a dependency — only Docker Desktop needs to be installed.

## `.otto` Config Format

```json
{
  "version": 1,
  "repo": "git@github.com:org/repo.git",
  "key": "U2FsdGVk...base64...",
  "cipher": "aes-256-cbc-pbkdf2",
  "gitName": "Team Name",
  "gitEmail": "team@example.com",
  "image": "oven/bun:1-debian",
  "devPorts": "3000-3099",
  "postClone": "bun install"
}
```

## Milestones

### v0.1 — MVP (replace start-otto.sh)
- Import `.otto` file
- Password prompt + decrypt
- Create/start/stop containers via Docker socket
- Stream setup logs in UI
- Open Web UI button
- Dynamic port allocation for multiple instances

### v0.2 — Admin Tools
- Generate deploy key in-app
- Encrypt + export `.otto`
- Copy pubkey to clipboard

### v0.3 — Quality of Life
- OS keychain for password storage
- Auto-start on login (optional)
- Update otto CLI from UI
- Container health monitoring
- Notification when setup complete

### v0.4 — Advanced
- Docker Desktop install detection + prompt
- Git pull/sync from UI
- Log viewer
- Shell access (embedded terminal)
- Multiple team configs

## File Structure

```
apps/launcher/
├── src/
│   ├── components/
│   │   ├── ProjectList.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── SetupProgress.tsx
│   │   ├── ImportDialog.tsx
│   │   ├── PasswordPrompt.tsx
│   │   └── AdminPanel.tsx
│   ├── hooks/
│   │   ├── useDocker.ts
│   │   ├── useProjects.ts
│   │   └── usePorts.ts
│   ├── lib/
│   │   ├── docker-api.ts
│   │   ├── crypto.ts
│   │   ├── config.ts
│   │   └── ports.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── docker.rs
│   │   │   ├── crypto.rs
│   │   │   ├── config.rs
│   │   │   └── mod.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## Open Questions

1. **Docker socket permissions on Linux** — may need user to be in `docker` group or use rootless Docker
2. **Windows named pipe access** — needs testing with Docker Desktop for Windows
3. **OCI images** — should we pre-build and host a custom Docker image (`ghcr.io/nitishxyz/otto-team:latest`) with otto + git + ssh pre-installed, to speed up first-time setup?
4. **Container persistence strategy** — named volumes vs bind mounts for workspace
5. **Multi-user Git** — should we support per-member `gitName`/`gitEmail` overrides in the launcher?
