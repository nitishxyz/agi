# AGI CLI Architecture

This document describes the monorepo architecture of the AGI CLI project.

## Project Structure

AGI CLI is organized as a **Bun workspace monorepo** with 7 packages and 2 applications:

```
agi/
├── apps/
│   ├── cli/                    # AGI CLI application (main binary)
│   └── web/                    # Web application (standalone)
├── packages/
│   ├── api/                    # Type-safe API client
│   ├── database/               # SQLite database & Drizzle ORM
│   ├── install/                # npm installer package
│   ├── sdk/                    # Core SDK (tools, streaming, agents, auth, config, providers, prompts)
│   ├── server/                 # HTTP server (Hono-based)
│   ├── web-sdk/                # React components, hooks, and utilities
│   └── web-ui/                 # Pre-built static web UI assets
├── package.json                # Workspace root configuration
└── bun.lock
```

## Package Descriptions

### `@agi-cli/install`

**Purpose:** npm installer package that downloads and installs the AGI CLI binary.

**Key Features:**

- Lightweight installer (~560 bytes)
- Downloads platform-specific binary from install script
- Supports npm and bun global installation
- Handles all supported platforms (macOS, Linux, Windows)

**Installation:**

```bash
npm install -g @agi-cli/install
# or
bun install -g @agi-cli/install
```

**How it works:**
1. User runs `npm install -g @agi-cli/install`
2. Postinstall script (`install.js`) runs automatically
3. Detects platform and architecture
4. Downloads binary from `https://install.agi.nitish.sh`
5. Installs to system PATH

**Dependencies:** None (standalone installer)

---

### `@agi-cli/database`

**Purpose:** SQLite database with Drizzle ORM for session/message persistence.

**Key Features:**

- Automatic migrations on startup
- Schema: sessions, messages, messageParts, artifacts
- Type-safe queries with Drizzle
- Bundled migrations

**Exports:**

- `getDb`, `ensureDb`, `closeDb`, `resetDb`
- Schema exports: `sessions`, `messages`, `messageParts`, `artifacts`
- Types: `Session`, `Message`, `MessagePart`

**Dependencies:** `@agi-cli/sdk`

---

### `@agi-cli/sdk`

**Purpose:** Core SDK with tools, streaming, agent system, authentication, configuration, and providers.

**Key Features:**

- Built-in tools (bash, read, write, edit, glob, grep, etc.)
- Tool loader (supports custom tools)
- Streaming infrastructure (SSE, artifacts)
- Agent registry
- Provider resolution and catalog
- OAuth flow support and API key management
- Configuration system (global and project-local)
- System prompts for agents

**Exports:**

- Tool system: `loadTools`, `tool` definitions
- Streaming: artifact management, SSE utilities
- Agent types and registry
- Provider resolver and catalog
- Auth utilities
- Config loading and management
- Prompt composition

**Dependencies:** None (standalone - includes everything)

---

### `@agi-cli/server`

**Purpose:** HTTP server for API access (Hono-based).

**Key Features:**

- REST API for ask/chat endpoints
- SSE streaming support
- OpenAPI spec generation
- Event bus for session events
- Session and message management

**Exports:**

- `createServer` - Server factory
- Route handlers
- Runtime services (askService, sessionManager, messageService)
- Event system

**Dependencies:** `@agi-cli/sdk`, `@agi-cli/database`

---

### `@agi-cli/api`

**Purpose:** Type-safe API client for AGI CLI server.

**Key Features:**

- Generated from OpenAPI spec
- Axios-based HTTP client
- SSE streaming support
- Full TypeScript types

**Exports:**

- API client functions
- Request/response types

**Dependencies:** None (standalone client)

---

### `@agi-cli/web-sdk`

**Purpose:** Reusable React components, hooks, and utilities for building AGI CLI web interfaces.

**Key Features:**

- React hooks for API interactions
- UI components for chat interfaces
- State management utilities
- Terminal rendering with xterm.js

**Exports:**

- React components
- Custom hooks
- State stores
- Utility functions

**Dependencies:** `@agi-cli/api`

---

### `@agi-cli/web-ui`

**Purpose:** Pre-built static web UI assets for embedding in the CLI binary.

**Key Features:**

- Pre-compiled static assets
- Embeddable in CLI binary
- Express middleware for serving

**Dependencies:** None (standalone assets)

---

### `@agi-cli/cli` (Application)

**Purpose:** CLI application - the main user-facing interface.

**Note:** This package is NOT published to npm. It's only used internally to build platform-specific binaries that are published to GitHub releases.

**Key Features:**

- Interactive commands (`auth`, `models`, `sessions`, `scaffold`)
- One-shot ask mode
- HTTP server mode
- Doctor diagnostics
- Agent/tool management

**Scripts:**

- `bun run dev` - Run in development mode
- `bun run build` - Build standalone binary (61MB)

**Dependencies:** `@agi-cli/sdk`, `@agi-cli/server`, `@agi-cli/database`

---

## Dependency Graph

```
                 ┌─────────┐
                 │ install │ (npm installer)
                 └─────────┘
                      │
                      │ (downloads binary)
                      ▼
                 ┌─────────┐
                 │   cli   │ (main app)
                 └────┬────┘
                      │
      ┌───────────────┼───────────────┐
      │               │               │
 ┌────▼────┐     ┌───▼────┐     ┌───▼─────┐
 │ server  │     │  sdk   │     │database │
 └────┬────┘     └────────┘     └─────────┘
      │
      └──────────────────────────────────┐
                                         │
                                    ┌────▼────┐
                                    │   api   │
                                    └────┬────┘
                                         │
                                    ┌────▼────┐
                                    │ web-sdk │
                                    └─────────┘
```

**Dependency Rules:**

- **Level 0** (no deps): `install`, `api`, `web-ui`
- **Level 1**: `sdk` (standalone - includes auth, config, providers, prompts)
- **Level 2**: `database` (depends on sdk for paths)
- **Level 3**: `server` (depends on sdk, database)
- **Level 4**: `web-sdk` (depends on api)
- **Level 5**: `cli` (depends on sdk, server, database)

---

## Key Conventions

### Import Paths

- **Workspace packages:** `@agi-cli/package-name`
- **Local imports:** `./file.ts` or `../file.ts`
- **Never use:** `@/` path aliases (removed during migration)

### Configuration Files

- **Global config:** `~/.config/agi/config.json`
- **Global auth:** `~/Library/Application Support/agi/auth.json` (macOS)
- **Project config:** `.agi/config.json`
- **Project database:** `.agi/agi.sqlite`

### TypeScript

- All packages extend `tsconfig.base.json`
- **No `rootDir`** in package tsconfigs (enables workspace imports)
- `"type": "module"` in all package.json files

### Bun Workspace

- Defined in root `package.json`:
  ```json
  {
    "workspaces": ["packages/*", "apps/*"]
  }
  ```
- Packages linked via `workspace:*` protocol

---

## Development Workflow

### Running in Development

```bash
cd apps/cli
bun run dev --help
```

### Building Binary

```bash
cd apps/cli
bun run build
# Output: apps/cli/dist/agi (61MB self-contained binary)
```

### Testing

```bash
bun test
```

### Linting

```bash
bun lint
```

---

## Adding a New Package

1. **Create package directory:**

   ```bash
   mkdir packages/my-package
   cd packages/my-package
   ```

2. **Initialize package.json:**

   ```json
   {
     "name": "@agi-cli/my-package",
     "version": "0.1.0",
     "type": "module",
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "exports": {
       ".": {
         "import": "./src/index.ts",
         "types": "./src/index.ts"
       }
     }
   }
   ```

3. **Create tsconfig.json:**

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist"
     },
     "include": ["src/**/*"]
   }
   ```

4. **Create src/index.ts:**

   ```typescript
   export function myFunction() {
     return "Hello from my-package";
   }
   ```

5. **Install workspace:**
   ```bash
   cd ../..
   bun install
   ```

---

## Installation Methods

AGI CLI supports multiple installation methods:

### 1. npm/bun Installer (Recommended)

```bash
npm install -g @agi-cli/install
```

- Easiest for most users
- Automatic platform detection
- Handles PATH setup
- Works with standard npm/bun workflows

### 2. Direct Binary Download

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

- Direct install without npm
- Good for CI/CD environments
- Supports version pinning

### 3. From Source

```bash
git clone https://github.com/nitishxyz/agi.git
cd agi
bun install
cd apps/cli
bun run build
```

- For contributors and developers
- Latest development version
- Full control over build process

---

## Summary

AGI CLI is a well-structured monorepo with clear boundaries, explicit dependencies, and a logical package hierarchy. The architecture supports:

- **Multiple installation methods** (npm, curl, source)
- **CLI and server modes** for different use cases
- **Embeddable SDK** for integration into other projects
- **Full testability** with isolated packages
- **Single self-contained binary** for distribution
- **Automated CI/CD** with version synchronization
