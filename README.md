# otto

AI-powered coding assistant for local-first development workflows.

CLI, TUI, desktop app, embeddable server, web UI, ACP adapter, and reusable SDK packages — all in one Bun monorepo.

[![Version](https://img.shields.io/badge/version-0.1.231-blue)](https://github.com/nitishxyz/otto)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-v6-purple)](https://sdk.vercel.ai)
[![Bun](https://img.shields.io/badge/runtime-Bun-orange)](https://bun.sh)
[![SST](https://img.shields.io/badge/infra-SST-blue)](https://sst.dev)

---

## What is otto?

otto is a local-first coding assistant that runs on your machine, connects to multiple AI providers, and gives models controlled access to your repo through built-in tools like file IO, search, patching, git, terminals, web fetch, skills, and task tracking.

It ships in several forms:

- **CLI** — `otto` for interactive or one-shot usage
- **TUI** — terminal-first interface used by the default CLI flow
- **Web UI** — browser client for the local otto server
- **Desktop app** — Tauri wrapper around the local workflow
- **Embeddable server** — Hono-based API you can host inside your own app
- **SDK packages** — auth, config, providers, tools, prompts, API client, web UI assets
- **ACP adapter** — integrate otto with ACP-capable editors and tools

The compiled CLI bundles the server, database, web UI assets, and runtime into a single executable.

---

## Install

```bash
curl -fsSL https://install.ottocode.io | sh
```

Or install the npm helper package with Bun:

```bash
bun install -g @ottocode/install
```

That downloads the correct prebuilt binary for your platform.

---

## Quick usage

```bash
otto                           # start interactive TUI (default)
otto --web                     # start local API + web UI and open browser
otto "explain this stack trace"
otto "write tests" --agent build
otto "review the architecture" --agent plan
otto "research this codebase" --agent research
otto --last "continue"
otto serve                     # run API + web UI explicitly
otto serve --port 3000         # API on :3000, web UI on :3001
otto serve --network           # bind API/web UI for LAN access
```

Useful companion commands:

```bash
otto setup
otto auth login
otto auth list
otto doctor
otto sessions
otto models
otto agents
otto tools
otto mcp list
otto scaffold
```

---

## Providers

otto supports multiple providers through AI SDK v6 and first-party adapters.

Common environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
export OPENROUTER_API_KEY="..."
export OPENCODE_API_KEY="..."
export SETU_PRIVATE_KEY="..."      # Solana wallet private key (base58)
export MOONSHOT_API_KEY="..."
export MINIMAX_API_KEY="..."
export ZAI_API_KEY="..."
export ZAI_CODING_API_KEY="..."
```

See [docs/environment.md](docs/environment.md) for the verified env var list.

---

## Built-in agents

Current exported presets from `@ottocode/server`:

| Agent | Purpose | Default tool profile |
|---|---|---|
| `build` | code changes, fixes, implementation | full patch/search/shell flow |
| `plan` | analysis and planning | mostly read/search/task tools |
| `general` | mixed-purpose assistant | broad default workspace tools |
| `research` | cross-session and web research | read/search/web + research DB tools |

All runtime agents also include `progress_update`, `finish`, and `skill`.

Project/global overrides live in:

- `.otto/agents.json`
- `~/.config/otto/agents.json`

Prompt files scaffold to flat paths like `.otto/agents/<name>.md`.

---

## Built-in tools

Core runtime tool surface includes:

> This is the full built-in tool universe. Individual agents only get the
> subset they need via their preset or config overrides.

| Category | Tools |
|---|---|
| File system | `read`, `write`, `ls`, `tree`, `pwd`, `cd`, `glob` |
| Search | `ripgrep`, `websearch` |
| Editing | `apply_patch` |
| Shell/runtime | `bash`, `terminal` |
| Git | `git_status`, `git_diff`, `git_commit` |
| Agent control | `update_todos`, `progress_update`, `finish`, `skill` |
| Research | `query_sessions`, `query_messages`, `get_session_context`, `search_history`, `get_parent_session`, `present_action` |

### MCP

otto supports MCP servers over stdio, HTTP, and SSE.

Started MCP servers expose tools like `server__tool` at runtime. Those tools are
separate from the built-in agent presets and come from the connected MCP server.

```bash
otto mcp add helius --command npx --args -y helius-mcp@latest
otto mcp add linear --transport http --url https://mcp.linear.app/mcp
otto mcp list
otto mcp auth linear
```

See [docs/mcp.md](docs/mcp.md).

### Custom tools

Custom tools are plugin folders discovered from either:

- `.otto/tools/<tool-name>/tool.js`
- `.otto/tools/<tool-name>/tool.mjs`
- `~/.config/otto/tools/<tool-name>/tool.js`
- `~/.config/otto/tools/<tool-name>/tool.mjs`

Example:

```js
// .otto/tools/file-size/tool.js
export default {
  name: 'file_size',
  description: 'Return the byte size for a file path',
  parameters: {
    path: {
      type: 'string',
      description: 'Path to inspect',
    },
  },
  async execute({ input, fs }) {
    const content = await fs.readFile(input.path, 'utf8');
    return { bytes: Buffer.byteLength(content, 'utf8') };
  },
};
```

See [docs/customization.md](docs/customization.md).

### Skills

The `skill` tool loads markdown instruction bundles on demand.

Skill sources:

- built-in bundled skills
- `.otto/skills/`
- `~/.config/otto/skills/`

Use `otto skills` to inspect available skills.

---

## Configuration

Global config lives under `~/.config/otto/`.

Project config lives under `.otto/`.

Secrets do **not** live in `~/.config/otto/auth.json` anymore. Auth is stored in secure OS-specific locations:

| Platform | Secure auth path |
|---|---|
| macOS | `~/Library/Application Support/otto/auth.json` |
| Linux | `$XDG_STATE_HOME/otto/auth.json` or `~/.local/state/otto/auth.json` |
| Windows | `%APPDATA%/otto/auth.json` |

See [docs/configuration.md](docs/configuration.md) for the full layout.

---

## Repository shape

### Apps

Current workspaces under `apps/`:

- `apps/cli`
- `apps/desktop`
- `apps/intro-video`
- `apps/landing`
- `apps/launcher`
- `apps/mobile`
- `apps/preview-api`
- `apps/preview-web`
- `apps/tui`
- `apps/web`

### Packages

Current workspaces under `packages/`:

- `@ottocode/acp`
- `@ottocode/ai-sdk`
- `@ottocode/api`
- `@ottocode/database`
- `@ottocode/install`
- `@ottocode/openclaw-setu`
- `@ottocode/sdk`
- `@ottocode/server`
- `@ottocode/web-sdk`
- `@ottocode/web-ui`

### Infra

SST currently wires these modules from `infra/`:

- `infra/script`
- `infra/landing`
- `infra/preview-api`
- `infra/preview-web`
- `infra/og`

See [docs/architecture.md](docs/architecture.md).

---

## API

The server exposes:

- `/` — root text response
- `/openapi.json` — generated OpenAPI document
- `/v1/*` — operational API routes

Example route groups include `ask`, `auth`, `config`, `doctor`, `files`, `git`, `mcp`, `provider-usage`, `research`, `sessions`, `setu`, `shares`, `skills`, `terminals`, and `tunnel`.

See [docs/api.md](docs/api.md). `packages/api/openapi.json` is the source of truth for clients.

---

## Embedding

Use the server directly:

```ts
import { createEmbeddedApp } from '@ottocode/server';
import { serveWebUI } from '@ottocode/web-ui';

const api = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: 'build',
});

const web = serveWebUI({ prefix: '/ui' });

Bun.serve({
  port: 3456,
  idleTimeout: 240,
  async fetch(req) {
    return (await web(req)) ?? api.fetch(req);
  },
});
```

See [docs/embedding-guide.md](docs/embedding-guide.md).

---

## Development

```bash
git clone https://github.com/nitishxyz/otto.git
cd otto
bun install
bun lint
bun test
bun run typecheck
bun run compile
```

Useful dev commands:

```bash
bun run dev:cli
bun run --filter @ottocode/tui dev
bun run dev:web
bun run dev:desktop
bun sst dev
```

See [docs/development.md](docs/development.md) and [docs/development-guide.md](docs/development-guide.md).

---

## Docs

- [Getting Started](docs/getting-started.md)
- [Usage Guide](docs/usage.md)
- [Configuration](docs/configuration.md)
- [Agents & Tools](docs/agents-tools.md)
- [MCP](docs/mcp.md)
- [API](docs/api.md)
- [Architecture](docs/architecture.md)
- [Embedding Guide](docs/embedding-guide.md)
- [Development](docs/development.md)
- [Docs Index](docs/index.md)

---

## Contributing

See [AGENTS.md](AGENTS.md).

Key repo conventions:

- Bun for installs, scripts, builds, and tests
- Biome for lint/format checks
- `bun:test` for tests
- TypeScript strict mode
- minimal focused changes

---

## License

[MIT](LICENSE)
