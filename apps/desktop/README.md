# AGI Desktop

Desktop application for AGI — wraps the CLI binary and web UI in a native window using Tauri v2.

## Stack

- [Tauri v2](https://tauri.app) (Rust backend)
- React 19, Vite, Tailwind CSS (frontend)
- `@agi-cli/web-sdk` for UI components

## Development

```bash
# From monorepo root
bun run dev:desktop

# Or build for release
bun run build:desktop
```

Requires Rust toolchain and Tauri CLI prerequisites. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## How It Works

The desktop app embeds the compiled AGI CLI binary and starts a local server on launch. The Tauri window loads the web UI which connects to this local server.

When the CLI detects the desktop app is installed, running `agi` with no arguments opens the desktop app instead of the browser.

## Build Targets

- macOS: `.dmg`, `.app`
- Linux: `.AppImage`
- Windows: `.trash`
