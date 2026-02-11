# otto desktop

Desktop application for otto — wraps the CLI binary and web UI in a native window using Tauri v2.

## Stack

- [Tauri v2](https://tauri.app) (Rust backend)
- React 19, Vite, Tailwind CSS (frontend)
- `@ottocode/web-sdk` for UI components

## Development

```bash
# From monorepo root
bun run dev:desktop

# Or build for release
bun run build:desktop
```

Requires Rust toolchain and Tauri CLI prerequisites. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## How It Works

The desktop app embeds the compiled ottocode binary and starts a local server on launch. The Tauri window loads the web UI which connects to this local server.

When the CLI detects the desktop app is installed, running `otto` with no arguments opens the desktop app instead of the browser.

## Changing the App Icon

### Main App Icon

1. Place your new icon as `icon.png` in this directory (`apps/desktop/`)
   - Recommended size: **1024x1024px** or larger
   - Format: PNG with transparency

2. Run the icon generator:

   ```bash
   bun run icon
   ```

3. This generates all platform-specific icons in `src-tauri/icons/`
4. Commit the generated icons

### Tray Icon (macOS Template Mode)

For theme-aware tray icons on macOS:

1. Create `tray-icon.png` (256x256px recommended)
   - Use **grayscale with transparency** — macOS handles tinting
   - Dark areas become the menu bar color
   - Transparent areas stay transparent

2. The tray icon is already configured with `iconAsTemplate: true` in `tauri.conf.json`

3. macOS will automatically invert the icon for light/dark menu bar themes

### Programmatic Icon Switching

To dynamically change the tray icon based on theme or state:

```typescript
import { TrayIcon } from "@tauri-apps/api/tray";

// Get tray instance and update icon
const tray = await TrayIcon.getById("main");
await tray?.setIcon("icons/tray-dark.png"); // or tray-light.png
await tray?.setIconAsTemplate(true); // Enable template mode
```

> **Note:** The source `icon.png` is gitignored. Only the generated icons in `src-tauri/icons/` should be committed.

## Build Targets

- macOS: `.dmg`, `.app`
- Linux: `.AppImage`
- Windows: `.trash`
