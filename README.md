# AGI

AI-powered coding assistant. CLI, desktop app, embeddable server — one tool, multiple interfaces.

[![Version](https://img.shields.io/badge/version-0.1.161-blue)](https://github.com/nitishxyz/agi)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-v6-purple)](https://sdk.vercel.ai)
[![Bun](https://img.shields.io/badge/runtime-Bun-orange)](https://bun.sh)
[![SST](https://img.shields.io/badge/infra-SST-blue)](https://sst.dev)

---

## What is AGI?

AGI is an AI coding assistant that runs locally. It connects to AI providers (Anthropic, OpenAI, Google, etc.), gives the model access to your filesystem via built-in tools (read, write, bash, git, ripgrep, etc.), and streams responses back to you.

It ships as:

- **CLI** — run `agi` in your terminal for interactive or one-shot usage
- **Server + Web UI** — run `agi serve` to get a local HTTP API and browser interface
- **Desktop App** — Tauri app that embeds the CLI binary and web UI
- **Embeddable SDK** — use `@agi-cli/server` and `@agi-cli/sdk` in your own apps

The CLI binary is self-contained — it bundles the server, database, web UI, and tools into a single executable built with `bun build --compile`.

---

## Install

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

Or via npm/bun:

```bash
bun install -g @agi-cli/install
```

This downloads the prebuilt binary for your platform (macOS arm64/x64, Linux arm64/x64) and puts it in `~/.local/bin`.

---

## Usage

```bash
agi                           # start server + web UI (opens browser)
agi "explain this error"      # one-shot question
agi "write tests" --agent build
agi "follow up" --last        # continue last session
agi serve                     # start server without desktop check
agi serve --port 3000         # custom port
agi serve --network           # bind to 0.0.0.0 for LAN access
```

When you run `agi` with no arguments, it checks for the desktop app first. If installed, it opens it. Otherwise it starts the local server and opens the web UI in your browser.

### Other Commands

```bash
agi setup                     # interactive provider setup
agi auth login                # configure provider credentials
agi auth list                 # list configured providers
agi sessions                  # browse session history
agi models                    # list available models
agi agents                    # list/configure agents
agi tools                     # list available tools
agi doctor                    # check configuration
agi share <session-id>        # share a session publicly
agi upgrade                   # upgrade to latest version
agi scaffold                  # generate agents, tools, or commands
```

---

## Providers

AGI supports multiple AI providers via [AI SDK v6](https://sdk.vercel.ai):

| Provider | Models | Auth |
|---|---|---|
| **Anthropic** | Claude 4.5 Sonnet, Claude Sonnet 4, Claude Opus | API key |
| **OpenAI** | GPT-4o, GPT-4o-mini, o1, Codex Mini | API key |
| **Google** | Gemini 2.5 Pro, Gemini 2.0 Flash | API key |
| **OpenRouter** | 100+ models | API key |
| **OpenCode** | Free-tier Anthropic access | OAuth |
| **Setu** | OpenAI/Anthropic proxy with Solana USDC payments | Solana wallet |
| **Moonshot** | Moonshot AI models | API key |

```bash
agi "refactor this" --provider anthropic --model claude-sonnet-4
agi "explain generics" --provider openai --model gpt-4o
```

### Environment Variables

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."
export SETU_PRIVATE_KEY="..."           # Solana wallet (base58)
```

---

## Agents

Four built-in agents, each with a curated toolset:

| Agent | Purpose | Key Tools |
|---|---|---|
| **build** | Code generation, bug fixes, features | read, write, bash, git, terminal, apply_patch, ripgrep, websearch |
| **plan** | Architecture planning, analysis | read, ls, tree, ripgrep, update_todos, websearch |
| **general** | Mixed tasks, conversational | read, write, bash, ripgrep, glob, websearch, update_todos |
| **research** | Deep research across sessions | read, ripgrep, websearch, query_sessions, search_history |

All agents also get: `progress_update`, `finish`, `skill`.

```bash
agi "create auth component" --agent build
agi "design API architecture" --agent plan
agi "research how this works" --agent research
```

Agents are configurable per-project (`.agi/agents.json`) or globally (`~/.config/agi/agents.json`).

---

## Tools

15+ built-in tools:

| Category | Tools |
|---|---|
| File System | `read`, `write`, `ls`, `tree`, `glob` |
| Search | `grep`, `ripgrep`, `websearch` |
| Editing | `edit`, `apply_patch` |
| Shell | `bash`, `terminal` |
| Git | `git_status`, `git_diff`, `git_commit` |
| Agent | `progress_update`, `finish`, `update_todos`, `skill` |

### Custom Tools

Add project-specific tools in `.agi/tools/`:

```typescript
// .agi/tools/deploy.ts
import { tool } from "@agi-cli/sdk";
import { z } from "zod";

export default tool({
  name: "deploy",
  description: "Deploy to production",
  parameters: z.object({
    environment: z.enum(["staging", "production"]),
  }),
  execute: async ({ environment }) => {
    return { success: true, url: "https://app.example.com" };
  },
});
```

---

## Configuration

### File Locations

```
~/.config/agi/
├── auth.json            # API keys (0600 permissions)
└── config.json          # Global defaults

.agi/                    # Project-specific
├── config.json          # Project config
├── agents.json          # Agent overrides
├── agents/              # Custom agent prompts
├── commands/            # Custom CLI commands
├── tools/               # Custom tools
└── agi.sqlite           # Local session database
```

### Project Config

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4",
    "agent": "build"
  }
}
```

**Priority:** CLI flags > Environment variables > Project `.agi/` > Global `~/.config/agi/` > Defaults

---

## Architecture

Bun workspace monorepo. Infrastructure managed with [SST](https://sst.dev).

### Apps

| App | Description | Stack |
|---|---|---|
| `apps/cli` | Main CLI binary | Commander, compiles to single binary via `bun build --compile` |
| `apps/web` | Web UI (client for the server) | React 19, Vite, TanStack Router/Query, Tailwind, Zustand |
| `apps/desktop` | Desktop app (embeds CLI binary + web UI) | Tauri v2, React |
| `apps/setu` | AI provider proxy with Solana payments | Hono, Cloudflare Worker |
| `apps/preview-api` | Session sharing API | Hono, Cloudflare Worker + D1 |
| `apps/preview-web` | Public session viewer | Astro, AWS |

### Packages

| Package | Description |
|---|---|
| `@agi-cli/sdk` | Core SDK: tools, agents, auth, config, providers, prompts. Tree-shakable. |
| `@agi-cli/server` | HTTP API server (Hono): routes, SSE streaming, agent runtime |
| `@agi-cli/database` | SQLite + Drizzle ORM for local persistence |
| `@agi-cli/api` | Type-safe API client (generated from OpenAPI spec) |
| `@agi-cli/web-sdk` | React components, hooks, stores for building web UIs |
| `@agi-cli/web-ui` | Pre-built static web UI assets (embedded in CLI binary) |
| `@agi-cli/install` | npm installer package (downloads binary on postinstall) |

### Dependency Graph

```
Level 0 (no deps)    install, api, web-ui
Level 1              sdk (auth, config, providers, prompts, tools)
Level 2              database (depends on sdk for paths)
Level 3              server (depends on sdk, database)
Level 4              web-sdk (depends on api, sdk)
Level 5              cli (depends on sdk, server, database)
```

### Infrastructure (SST)

All infra is defined as code with [SST](https://sst.dev), deploying to AWS and Cloudflare:

| Resource | Platform | Domain |
|---|---|---|
| Setu proxy | Cloudflare Worker | `setu.agi.nitish.sh` |
| Preview API | Cloudflare Worker + D1 | `api.share.agi.nitish.sh` |
| Preview Web | AWS (Astro SSR) | `share.agi.nitish.sh` |
| Install Script | Cloudflare Worker | `install.agi.nitish.sh` |
| OG Image | AWS Lambda | (function URL) |

```bash
bun sst dev                    # local dev with live infra
bun sst deploy --stage prod    # deploy to production
```

---

## Embedding

Use AGI as a library in your own applications:

```typescript
import { createEmbeddedApp } from "@agi-cli/server";

const app = createEmbeddedApp({
  provider: "anthropic",
  model: "claude-sonnet-4",
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: "build",
});

Bun.serve({
  port: 9100,
  fetch: app.fetch,
  idleTimeout: 240,
});
```

Or use the SDK directly:

```typescript
import { generateText, resolveModel, discoverProjectTools } from "@agi-cli/sdk";

const model = await resolveModel("anthropic", "claude-sonnet-4");
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: "List all TypeScript files and count lines",
  tools: Object.fromEntries(tools.map((t) => [t.name, t.tool])),
  maxSteps: 10,
});
```

See [Embedding Guide](docs/embedding-guide.md) for full details including custom agents, multi-provider auth, web UI serving, and CORS configuration.

---

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Setup

```bash
git clone https://github.com/nitishxyz/agi.git
cd agi
bun install
```

### Commands

```bash
bun run cli ask "hello"        # run CLI from source
bun test                       # run tests (bun:test)
bun lint                       # lint (Biome)
bun run typecheck              # type check all packages
bun run compile                # build standalone binary
```

### Dev Servers

```bash
bun run dev:cli                # CLI dev mode
bun run dev:web                # Web UI (Vite dev server)
bun run dev:desktop            # Desktop app (Tauri)
bun sst dev                    # SST dev (setu, preview-api, preview-web)
```

### Cross-Compilation

```bash
bun run build:bin:darwin-arm64
bun run build:bin:darwin-x64
bun run build:bin:linux-x64
bun run build:bin:linux-arm64
```

### Database

```bash
bun run db:generate            # generate Drizzle migrations
bun run db:reset               # reset local database
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| AI | [AI SDK v6](https://sdk.vercel.ai) |
| Server | [Hono](https://hono.dev) |
| Database | SQLite + [Drizzle ORM](https://orm.drizzle.team) |
| Web UI | React 19, [Vite](https://vite.dev), [TanStack](https://tanstack.com), Tailwind CSS, Zustand |
| Desktop | [Tauri v2](https://tauri.app) |
| Infrastructure | [SST](https://sst.dev) (AWS + Cloudflare) |
| Linting | [Biome](https://biomejs.dev) |
| Testing | `bun:test` |

---

## Docs

| Document | Description |
|---|---|
| [Getting Started](docs/getting-started.md) | Installation and first steps |
| [Usage Guide](docs/usage.md) | Commands and workflows |
| [Configuration](docs/configuration.md) | Settings reference |
| [Agents & Tools](docs/agents-tools.md) | Built-in agents and tools |
| [Architecture](docs/architecture.md) | Monorepo structure, packages, infra |
| [Development Guide](docs/development-guide.md) | Dev workflows for all components |
| [Embedding Guide](docs/embedding-guide.md) | Embed AGI in your apps |
| [API Reference](docs/api.md) | REST endpoints and SSE |
| [Troubleshooting](docs/troubleshooting.md) | Common issues |
| [All Docs](docs/index.md) | Full documentation index |

---

## Contributing

See [AGENTS.md](AGENTS.md) for conventions.

- Bun for everything (no npm/yarn/pnpm)
- Biome for linting (`bun lint`)
- `bun:test` for tests
- TypeScript strict mode
- Conventional commits (`feat:`, `fix:`, `docs:`, etc.)

---

## License

[MIT](LICENSE)

---

[GitHub](https://github.com/nitishxyz/agi) · [Issues](https://github.com/nitishxyz/agi/issues) · [npm](https://www.npmjs.com/package/@agi-cli/install)
