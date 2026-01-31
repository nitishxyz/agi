# Architecture

[← Back to README](../README.md) · [Docs Index](./index.md)

AGI is a **Bun workspace monorepo** with 6 apps, 7 packages, and SST infrastructure.

---

## How It Works

AGI is a local-first AI coding assistant. The core flow:

1. **CLI binary** starts a local HTTP server (Hono) with an embedded web UI
2. **Server** manages sessions, persists messages to SQLite, and streams AI responses via SSE
3. **SDK** handles provider resolution, tool execution, agent prompts, and authentication
4. **Web UI** (or desktop app) is a client that talks to the local server API

The CLI binary is self-contained — built with `bun build --compile`, it bundles the server, database, web UI assets, and all tools into a single executable.

---

## Project Structure

```
agi/
├── apps/
│   ├── cli/              # CLI binary (Commander, bun build --compile)
│   ├── web/              # Web UI client (React + Vite + TanStack)
│   ├── desktop/          # Desktop app (Tauri v2, embeds CLI binary + web UI)
│   ├── setu/             # AI provider proxy with Solana payments (Hono)
│   ├── preview-api/      # Session sharing API (Hono + Cloudflare D1)
│   └── preview-web/      # Public session viewer (Astro)
├── packages/
│   ├── sdk/              # Core SDK: tools, agents, auth, config, providers, prompts
│   ├── server/           # HTTP API server (Hono): routes, SSE, agent runtime
│   ├── database/         # SQLite + Drizzle ORM (local persistence)
│   ├── api/              # Type-safe API client (generated from OpenAPI)
│   ├── web-sdk/          # React components, hooks, stores
│   ├── web-ui/           # Pre-built static web UI assets (embedded in binary)
│   └── install/          # npm installer package
├── infra/                # SST infrastructure (AWS + Cloudflare)
├── tests/                # bun:test suites
├── scripts/              # Build and utility scripts
├── docs/                 # Documentation
└── examples/             # Example integrations
```

---

## Apps

### `apps/cli`

Main CLI application. Compiles to a self-contained binary via `bun build --compile`.

- **Framework:** Commander for argument parsing
- **Dependencies:** `@agi-cli/sdk`, `@agi-cli/server`, `@agi-cli/database`
- **Binary size:** ~61MB
- **Distribution:** GitHub releases + install script (not published to npm as a package)

When run with no arguments, it checks for the desktop app. If not found, it starts the local server and opens the web UI in the browser. With arguments, it runs the specified command or one-shot prompt.

Key behaviors:
- `agi` → open desktop app (if installed) or start server + web UI
- `agi "prompt"` → one-shot question via local server
- `agi serve` → start API server + web UI explicitly
- `agi setup` → interactive provider configuration

### `apps/web`

Web UI that acts as a client to the AGI server. Not a standalone app — it needs the server running.

- **Stack:** React 19, Vite, TanStack Router + Query, Tailwind CSS, Zustand
- **Dependencies:** `@agi-cli/web-sdk`
- **Features:** Real-time chat via SSE, session management, syntax highlighting, terminal rendering (Ghostty), dark theme

During build, the web app is compiled to static assets and bundled into `@agi-cli/web-ui` for embedding in the CLI binary.

### `apps/desktop`

Desktop application that embeds the CLI binary and web UI via Tauri.

- **Stack:** Tauri v2, React, Vite, Tailwind CSS
- **Dependencies:** `@agi-cli/web-sdk`
- **Platforms:** macOS (dmg, app), Linux (AppImage), Windows (msi)

The CLI checks for the desktop app on startup. If found, `agi` opens it directly instead of the browser-based web UI.

### `apps/setu`

AI provider proxy service with Solana wallet authentication and USDC payments (x402 protocol).

- **Stack:** Hono, AI SDK v6, Drizzle ORM + Neon Postgres
- **Deployment:** Cloudflare Worker → `setu.agi.nitish.sh`
- **Features:** Proxies OpenAI/Anthropic requests, wallet-based auth, balance tracking, Polar.sh top-ups

### `apps/preview-api`

API for sharing sessions publicly.

- **Stack:** Hono, Drizzle ORM + Cloudflare D1
- **Deployment:** Cloudflare Worker → `api.share.agi.nitish.sh`

### `apps/preview-web`

Public-facing site for viewing shared sessions.

- **Stack:** Astro, React, TanStack Query, Tailwind CSS
- **Deployment:** AWS (Astro SSR via Lambda + CloudFront) → `share.agi.nitish.sh`

---

## Packages

### `@agi-cli/sdk`

Core SDK containing all fundamental logic. Tree-shakable — bundlers only include what you use.

**Submodules:**
- `agent/` — Agent type definitions
- `auth/` — OAuth flows (Anthropic, OpenAI), wallet auth (Solana), API key management
- `config/` — Configuration loading (global + project), path resolution
- `core/` — Built-in tools (15+), streaming, terminal management (bun-pty), provider clients
- `prompts/` — System prompts for agents and providers
- `providers/` — Provider catalog, client factories, model resolution, pricing
- `skills/` — Skill loader, parser, validator
- `types/` — Shared TypeScript types

**Subpath exports:** Individual tools (`@agi-cli/sdk/tools/builtin/bash`, etc.) and prompts.

### `@agi-cli/server`

HTTP API server built on Hono.

- **Routes:** ask (SSE streaming), sessions, messages, files, auth, git, terminals, config, research, setu, branch, session-approval, session-files, session-stream, OpenAPI spec
- **Runtime:** Agent registry, ask service, session/message management, prompt composition, provider resolution, tool adapter, stream management
- **Events:** Event bus for real-time session updates
- **Exports:** `createApp`, `createEmbeddedApp`, `createStandaloneApp`, `BUILTIN_AGENTS`, `BUILTIN_TOOLS`

### `@agi-cli/database`

SQLite persistence with Drizzle ORM.

- **Schema:** sessions, messages, messageParts, artifacts
- **Features:** Auto-migrations on startup, bundled migration SQL files
- **Exports:** `getDb`, `ensureDb`, `closeDb`, `resetDb`, schema types

### `@agi-cli/api`

Type-safe API client generated from the server's OpenAPI spec.

- **Generated with:** `@hey-api/openapi-ts`
- **HTTP client:** Axios
- **SSE support:** `eventsource-parser`
- Standalone — no workspace dependencies

### `@agi-cli/web-sdk`

Reusable React components, hooks, and utilities for building AGI web interfaces.

- **Components:** Chat UI, terminal rendering (Ghostty), code highlighting, QR codes
- **Hooks:** API interactions, streaming, state management
- **Stores:** Zustand-based state
- **Peer deps:** React 18/19, TanStack Query, Zustand, lucide-react, react-markdown

### `@agi-cli/web-ui`

Pre-built static web UI assets for embedding in the CLI binary.

- Compiles `apps/web` and bundles as static assets
- Served by the CLI binary when you run `agi serve`

### `@agi-cli/install`

Lightweight npm installer package.

- Postinstall script detects platform, downloads binary from GitHub releases
- Falls back to `install.agi.nitish.sh` curl install

---

## Dependency Graph

```
Level 0 (no deps)    install, api, web-ui
Level 1              sdk (auth, config, providers, prompts, tools)
Level 2              database (depends on sdk for path resolution)
Level 3              server (depends on sdk, database)
Level 4              web-sdk (depends on api, sdk)
Level 5              cli (depends on sdk, server, database)
```

```
                ┌──────────┐
                │ install  │
                └──────────┘
                     │ (downloads binary)
                     ▼
                ┌──────────┐
                │   cli    │
                └────┬─────┘
                     │
     ┌───────────────┼──────────────┐
     │               │              │
┌────▼────┐    ┌────▼────┐   ┌────▼─────┐
│ server  │    │   sdk   │   │ database │
└────┬────┘    └─────────┘   └──────────┘
     │
┌────▼────┐
│   api   │
└────┬────┘
     │
┌────▼────┐
│ web-sdk │
└─────────┘
```

---

## Infrastructure (SST)

All infrastructure is defined as code using [SST](https://sst.dev) with AWS and Cloudflare providers.

**Entry point:** `sst.config.ts` → imports from `infra/` modules.

### Resources

| Resource | SST Component | Platform | Domain |
|---|---|---|---|
| Setu | `sst.cloudflare.Worker` | Cloudflare Workers | `setu.agi.nitish.sh` |
| Preview API | `sst.cloudflare.Worker` | Cloudflare Workers + D1 | `api.share.agi.nitish.sh` |
| Preview Web | `sst.aws.Astro` | AWS (Lambda + CloudFront) | `share.agi.nitish.sh` |
| Install Script | `sst.cloudflare.Worker` | Cloudflare Workers | `install.agi.nitish.sh` |
| OG Image | `sst.aws.Function` | AWS Lambda (Node.js 20) | (function URL) |
| Drizzle Studio | `sst.x.DevCommand` | Local (dev only) | — |

### Secrets

Managed via `sst secret set <name> <value>`:

- `DatabaseUrl` — Neon Postgres connection string (for Setu)
- `OpenAiApiKey`, `AnthropicApiKey`, `GoogleAiApiKey`, `MoonshotAiApiKey`
- `PlatformWallet` — Solana wallet for x402 payments
- `PolarAccessToken`, `PolarWebhookSecret`, `PolarProductId` — Polar.sh integration

### Infra Modules

```
infra/
├── secrets.ts        # SST secret declarations
├── domains.ts        # Domain resolution (stage-aware: prod vs dev)
├── setu.ts           # Setu Cloudflare Worker
├── preview-api.ts    # Preview API Worker + D1
├── preview-web.ts    # Preview Web (Astro on AWS)
├── og.ts             # OG image Lambda function
├── script.ts         # Install script Worker
├── orm.ts            # Drizzle Studio dev command
├── utils.ts          # Shared utilities
└── handlers/
    └── install-worker.ts
```

### Stage-Aware Domains

- **prod:** `setu.agi.nitish.sh`, `share.agi.nitish.sh`
- **dev:** `dev.setu.agi.nitish.sh`, `dev.share.agi.nitish.sh`

```bash
bun sst dev                    # local development with live infra
bun sst deploy --stage prod    # deploy to production
bun sst secret set <name> <value>
```

---

## Agents

Four built-in agents with embedded prompts:

| Agent | Default Tools |
|---|---|
| `build` | read, write, ls, tree, bash, update_todos, glob, ripgrep, git_status, terminal, apply_patch, websearch |
| `plan` | read, ls, tree, ripgrep, update_todos, websearch |
| `general` | read, write, ls, tree, bash, ripgrep, glob, websearch, update_todos |
| `research` | read, ls, tree, ripgrep, websearch, update_todos, query_sessions, query_messages, get_session_context, search_history, get_parent_session, present_action |

All agents also get: `progress_update`, `finish`, `skill`.

Agent config can be overridden via `.agi/agents.json` (project) or `~/.config/agi/agents.json` (global).

---

## Built-in Tools

| Tool | Description |
|---|---|
| `read` | Read files |
| `write` | Write files |
| `ls` | List directory contents |
| `tree` | Directory tree view |
| `glob` | Find files by pattern |
| `grep` | Search file contents |
| `ripgrep` | Fast regex search (uses embedded or system rg binary) |
| `bash` | Execute shell commands |
| `terminal` | Persistent terminal sessions (via bun-pty) |
| `edit` | Structured file editing (replace, insert, delete) |
| `apply_patch` | Apply unified diff patches with fuzzy matching |
| `git_status` | Git working tree status |
| `git_diff` | Git diff |
| `git_commit` | Create git commits |
| `websearch` | Web search and URL fetching |
| `progress_update` | Progress updates to user |
| `finish` | Signal task completion |
| `update_todos` | Task list management |
| `skill` | Load skills for specialized instructions |

---

## Providers

7+ providers via AI SDK v6:

| Provider | Client | Auth |
|---|---|---|
| Anthropic | `@ai-sdk/anthropic` | API key / OAuth |
| OpenAI | `@ai-sdk/openai` | API key |
| Google | `@ai-sdk/google` | API key |
| OpenRouter | `@openrouter/ai-sdk-provider` | API key |
| OpenCode | `@ai-sdk/openai-compatible` | Anthropic OAuth |
| Setu | Custom client | Solana wallet |
| Moonshot | Custom client | API key |
| Zai / Zai-Coding | Custom client | API key |

Provider catalog is auto-generated: `bun run catalog:update`

---

## Key Conventions

### Imports

- **Workspace packages:** `@agi-cli/package-name`
- **Local:** `./file.ts` or `../file.ts`
- **Never:** `@/` path aliases

### Config Files

- **Global config:** `~/.config/agi/config.json`
- **Global auth:** `~/Library/Application Support/agi/auth.json` (macOS)
- **Project config:** `.agi/config.json`
- **Project agents:** `.agi/agents.json`
- **Project database:** `.agi/agi.sqlite`

### TypeScript

- All packages extend `tsconfig.base.json`
- `"type": "module"` everywhere
- Strict mode enabled

### Bun Workspace

```json
{
  "workspaces": ["packages/*", "apps/*", "examples/*"]
}
```

Packages linked via `workspace:*` protocol.
