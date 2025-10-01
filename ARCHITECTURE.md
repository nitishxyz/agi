# AGI CLI Architecture

This document describes the monorepo architecture of the AGI CLI project.

## Project Structure

AGI CLI is organized as a **Bun workspace monorepo** with 8 packages and 1 application:

```
agi/
├── apps/
│   └── cli/                    # AGI CLI application (main binary)
├── packages/
│   ├── auth/                   # Authentication & credential management
│   ├── config/                 # Configuration system
│   ├── database/               # SQLite database & Drizzle ORM
│   ├── prompts/                # System prompts for agents
│   ├── providers/              # AI provider catalog & utilities
│   ├── sdk/                    # Core SDK (tools, streaming, agents)
│   ├── server/                 # HTTP server (Hono-based)
│   └── prompts/                # Prompt templates
├── package.json                # Workspace root configuration
└── bun.lock
```

## Package Descriptions

### `@agi-cli/auth`

**Purpose:** Manages authentication and credentials for AI providers.

**Key Features:**

- OAuth flow support
- API key management
- Secure credential storage (`~/Library/Application Support/agi/auth.json`)
- Provider-specific authentication

**Exports:**

- `getAllAuth`, `getAuth`, `setAuth`, `removeAuth`
- `authorize`, `exchange`, `refreshToken`, `openAuthUrl`, `createApiKey`
- Types: `AuthInfo`, `OAuth`, `ProviderId`

**Dependencies:** `@agi-cli/config`, `@agi-cli/providers`

---

### `@agi-cli/config`

**Purpose:** Configuration management for global and project-local settings.

**Key Features:**

- XDG Base Directory support (`~/.config/agi/`)
- Project-local config (`.agi/config.json`)
- Config merging (defaults → global → local)
- Path resolution utilities

**Exports:**

- `loadConfig`, `read`, `writeDefaults`, `writeAuth`, `removeAuth`
- `isAuthorized`, `ensureEnv`
- Path utilities from `./paths` submodule
- Types: `AGIConfig`, `ProviderConfig`, `Scope`

**Dependencies:** `@agi-cli/providers`, `@agi-cli/auth`

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

**Dependencies:** None (standalone)

---

### `@agi-cli/providers`

**Purpose:** AI provider catalog with models, pricing, and capabilities.

**Key Features:**

- Provider catalog (OpenAI, Anthropic, Google, OpenRouter, OpenCode)
- Model information (capabilities, pricing, context windows)
- Environment variable management for API keys
- Provider validation

**Exports:**

- `catalog` - Provider/model metadata
- `providerIds`, `isProviderId`, `defaultModelFor`, `hasModel`
- `validateProviderModel` - Validates provider/model combinations
- `estimateModelCostUsd` - Cost estimation
- `isProviderAuthorized`, `ensureProviderEnv`
- `readEnvKey`, `setEnvKey`, `providerEnvVar`
- Types: `ProviderId`, `ModelInfo`

**Dependencies:** None (standalone catalog)

---

### `@agi-cli/prompts`

**Purpose:** System prompts for agents and providers.

**Key Features:**

- Base system prompt composition
- Agent-specific prompts (general, build, plan)
- Provider-specific prompt adaptations
- Template system

**Exports:**

- Prompt loading utilities
- Agent prompts
- Provider prompt templates

**Dependencies:** None

---

### `@agi-cli/sdk`

**Purpose:** Core SDK with tools, streaming, and agent system.

**Key Features:**

- Built-in tools (bash, read, write, edit, glob, grep, etc.)
- Tool loader (supports custom tools)
- Streaming infrastructure (SSE, artifacts)
- Agent registry
- Provider resolution

**Exports:**

- Tool system: `loadTools`, `tool` definitions
- Streaming: artifact management, SSE utilities
- Agent types and registry
- Provider resolver

**Dependencies:** `@agi-cli/auth`, `@agi-cli/config`, `@agi-cli/providers`, `@agi-cli/database`

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

**Dependencies:** `@agi-cli/sdk`, `@agi-cli/auth`, `@agi-cli/config`, `@agi-cli/providers`, `@agi-cli/database`

---

### `@agi-cli/cli` (Application)

**Purpose:** CLI application - the main user-facing interface.

**Key Features:**

- Interactive commands (`auth`, `models`, `sessions`, `scaffold`)
- One-shot ask mode
- HTTP server mode
- Doctor diagnostics
- Agent/tool management

**Scripts:**

- `bun run dev` - Run in development mode
- `bun run build` - Build standalone binary (61MB)

**Dependencies:** All packages

---

## Dependency Graph

```
                    ┌─────────┐
                    │   cli   │ (app)
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐     ┌───▼────┐     ┌───▼─────┐
    │ server  │     │  sdk   │     │ prompts │
    └────┬────┘     └───┬────┘     └─────────┘
         │              │
         └──────┬───────┘
                │
         ┌──────┼───────┬─────────┐
         │      │       │         │
    ┌────▼──┐ ┌▼─────┐ ┌▼────────┐ ┌──────────┐
    │ auth  │ │config│ │providers│ │ database │
    └───────┘ └──────┘ └─────────┘ └──────────┘
```

**Dependency Rules:**

- **Level 0** (no deps): `database`, `providers`, `prompts`
- **Level 1**: `auth` → config, providers
- **Level 1**: `config` → providers, auth
- **Level 2**: `sdk` → auth, config, providers, database
- **Level 3**: `server` → sdk + all level 1-2 packages
- **Level 4**: `cli` → all packages

---

## Key Conventions

### Import Paths

- **Workspace packages:** `@agi-cli/package-name`
- **Submodules:** `@agi-cli/config/paths`, `@agi-cli/config/manager`
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
./test-monorepo.sh
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

## Architecture Benefits

### Clear Separation of Concerns

- Each package has a single, well-defined responsibility
- Dependencies are explicit and documented
- No circular dependencies

### Independent Testing

- Packages can be tested in isolation
- Clear boundaries make mocking easier

### Reusability

- Packages can be used independently
- Server package can run standalone
- SDK can be imported into other projects

### Maintainability

- Easier to understand codebase
- Changes are localized to specific packages
- Clear dependency graph prevents tangled code

### Build Optimization

- Only rebuild changed packages
- Bun workspace provides fast installs
- Single 61MB binary bundles everything

---

## Binary Build

The CLI binary is built with `bun build --compile`:

**Features:**

- **Self-contained:** All dependencies bundled
- **Fast startup:** ~50ms cold start
- **Size:** 61MB (includes Bun runtime + 684 modules)
- **Platform-specific:** Built per-platform (macOS, Linux, Windows)

**Build Process:**

```bash
cd apps/cli
bun build --compile ./index.ts --outfile dist/agi
```

**Output:** `apps/cli/dist/agi` (executable)

---

## Configuration Hierarchy

AGI CLI uses a three-level configuration system:

1. **Defaults** (hardcoded in code)
2. **Global config** (`~/.config/agi/config.json`)
3. **Project config** (`.agi/config.json`)

**Merge strategy:** Defaults → Global → Project (later overrides earlier)

**Example:**

```javascript
// Defaults
{
  defaults: { agent: "general", provider: "openai", model: "gpt-4o-mini" },
  providers: { openai: { enabled: true }, ... }
}

// Merged with global (~/.config/agi/config.json)
{
  defaults: { provider: "anthropic", model: "claude-sonnet-4" }
}

// Final config (project overrides)
{
  defaults: { agent: "general", provider: "anthropic", model: "claude-sonnet-4" },
  providers: { ... }
}
```

---

## Summary

AGI CLI is a well-structured monorepo with clear boundaries, explicit dependencies, and a logical package hierarchy. The architecture supports both CLI and server modes, is fully testable, and produces a single self-contained binary for distribution.
