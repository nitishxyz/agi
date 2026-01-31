# AGI Documentation

[← Back to README](../README.md)

## Getting Started

- **[Installation & Quick Start](getting-started.md)** — Install AGI and get running
- **[Usage Guide](usage.md)** — Core commands and workflows
- **[Configuration](configuration.md)** — Settings and project configuration

## Features

- **[Agents & Tools](agents-tools.md)** — Built-in agents and tools reference
- **[Customization](customization.md)** — Custom commands, tools, and agents
- **[Environment](environment.md)** — Environment variables and flags
- **[API Reference](api.md)** — REST endpoints and SSE events

## Architecture & Development

- **[Architecture](architecture.md)** — Monorepo structure, packages, infra (SST)
- **[Development Guide](development-guide.md)** — Dev workflows for server, CLI, web SDK, and web app
- **[Publishing](publishing.md)** — Release workflow and version management
- **[Contributing](../AGENTS.md)** — Contribution guidelines

## Advanced

- **[Embedding Guide](embedding-guide.md)** — Embed AGI in your own applications

## Reference

- **[Troubleshooting](troubleshooting.md)** — Common issues and solutions
- **[Keyboard Shortcuts](keyboard-shortcuts.md)** — Web UI shortcuts
- **[License](license.md)** — MIT License

---

## Quick Reference

### Install

```bash
curl -fsSL https://install.agi.nitish.sh | sh

# Or via npm/bun
bun install -g @agi-cli/install

# From source
git clone https://github.com/nitishxyz/agi.git
cd agi && bun install && bun run compile
```

### Key Commands

```bash
agi                          # start server + web UI
agi "your question"          # one-shot question
agi --agent build "task"     # use specific agent
agi --last "follow up"       # continue last session
agi serve                    # start HTTP server + web UI
agi setup                    # configure providers
agi agents                   # list agents
agi models                   # list models
agi sessions                 # list sessions
agi doctor                   # diagnostics
```

### Project Layout

```
agi/
├── apps/
│   ├── cli/          # CLI binary (Commander, bun build --compile)
│   ├── web/          # Web UI (React + Vite + TanStack)
│   ├── desktop/      # Desktop app (Tauri v2)
│   ├── setu/         # AI provider proxy (Cloudflare Worker)
│   ├── preview-api/  # Session sharing API (Cloudflare Worker + D1)
│   └── preview-web/  # Public session viewer (Astro, AWS)
├── packages/
│   ├── sdk/          # Core SDK (tools, agents, auth, providers)
│   ├── server/       # HTTP server (Hono)
│   ├── database/     # SQLite + Drizzle ORM
│   ├── api/          # Type-safe API client
│   ├── web-sdk/      # React components and hooks
│   ├── web-ui/       # Pre-built web UI assets
│   └── install/      # npm installer
├── infra/            # SST (AWS + Cloudflare)
├── tests/            # bun:test suites
├── scripts/          # Build and utility scripts
└── docs/             # Documentation (you are here)
```

### SDK Usage

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

const model = await resolveModel('anthropic', 'claude-sonnet-4');
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: 'List all TypeScript files',
  tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
  maxSteps: 10
});
```

---

## By Audience

### For Users

1. [Getting Started](getting-started.md)
2. [Usage Guide](usage.md)
3. [Configuration](configuration.md)
4. [Agents & Tools](agents-tools.md)
5. [Troubleshooting](troubleshooting.md)

### For Developers (building with AGI SDK)

1. [SDK README](../packages/sdk/README.md)
2. [Embedding Guide](embedding-guide.md)
3. [API Reference](api.md)
4. [Architecture](architecture.md)

### For Contributors

1. [Contributing Guidelines](../AGENTS.md)
2. [Development Guide](development-guide.md)
3. [Architecture](architecture.md)
4. [Publishing](publishing.md)

---

[GitHub](https://github.com/nitishxyz/agi) · [Issues](https://github.com/nitishxyz/agi/issues) · [npm](https://www.npmjs.com/package/@agi-cli/install)
