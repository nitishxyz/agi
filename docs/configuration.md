# Configuration

[← Back to README](../README.md) • [Docs Index](./index.md)

otto resolves configuration from injected settings, environment variables, global config, and project config.

## Resolution order

When otto needs a value, it checks in this order:

```text
1. Injected config (for embedded/server integrations)
2. Environment variables
3. Project config (.otto/...)
4. Global config (~/.config/otto/...)
5. Built-in defaults
```

Auth secrets are a special case: they are stored in a secure OS-specific path, not in the global config directory.

## Directory layout

### Global config directory

```text
~/.config/otto/
├── config.json
├── agents.json
├── agents/
├── commands/
├── tools/
└── skills/
```

### Secure auth + OAuth storage

| Platform | Auth path | OAuth directory |
|---|---|---|
| macOS | `~/Library/Application Support/otto/auth.json` | `~/Library/Application Support/otto/oauth/` |
| Linux | `$XDG_STATE_HOME/otto/auth.json` or `~/.local/state/otto/auth.json` | `$XDG_STATE_HOME/otto/oauth/` or `~/.local/state/otto/oauth/` |
| Windows | `%APPDATA%/otto/auth.json` | `%APPDATA%/otto/oauth/` |

### Project directory

```text
.otto/
├── otto.sqlite
├── config.json
├── agents.json
├── agents/
│   ├── <name>.md
│   └── <name>.txt
├── commands/
│   ├── <command>.json
│   ├── <command>.md
│   └── <command>.txt
├── tools/
│   └── <tool-name>/
│       ├── tool.js
│       └── tool.mjs
└── skills/
```

Notes:

- the CLI scaffolder writes agent prompts as `.otto/agents/<name>.md`
- command prompts can live next to the JSON manifest as `<command>.md` or `<command>.txt`
- the runtime still accepts some legacy nested agent prompt paths, but the flat layout above is the current default

## Global files

### `~/.config/otto/config.json`

User-wide defaults.

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4",
    "agent": "build"
  }
}
```

### `~/.config/otto/agents.json`

Global agent overrides.

```json
{
  "build": {
    "appendTools": ["git_diff"],
    "prompt": "agents/build.md"
  }
}
```

`prompt` can be inline text, a relative path from the config directory, or an absolute path.

## Project files

### `.otto/config.json`

Project-level defaults and provider preferences.

```json
{
  "defaults": {
    "provider": "openai",
    "model": "gpt-4o",
    "agent": "build"
  },
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true },
    "google": { "enabled": false }
  }
}
```

### `.otto/agents.json`

Per-project agent overrides.

```json
{
  "build": {
    "appendTools": ["git_diff", "glob"]
  },
  "reviewer": {
    "tools": ["read", "ls", "tree", "ripgrep", "update_todos"],
    "prompt": ".otto/agents/reviewer.md",
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  }
}
```

Supported fields:

| Field | Meaning |
|---|---|
| `tools` | Replace the default tool list |
| `appendTools` | Add to the default tool list |
| `prompt` | Inline prompt text or prompt file path |
| `provider` | Per-agent provider override |
| `model` | Per-agent model override |

### Auth file shape

Secure auth storage uses provider entries like:

```json
{
  "openai": {
    "type": "api",
    "key": "sk-..."
  },
  "anthropic": {
    "type": "api",
    "key": "sk-ant-..."
  }
}
```

Most users should prefer `otto setup` or `otto auth login` instead of editing auth files manually.

## Environment variables

Common provider variables:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...
OPENCODE_API_KEY=...
SETU_PRIVATE_KEY=...
MOONSHOT_API_KEY=...
MINIMAX_API_KEY=...
ZAI_API_KEY=...
ZAI_CODING_API_KEY=...
```

See [environment.md](./environment.md) for the verified list.

## Embedded mode

Embedded integrations can inject config directly:

```ts
import { createEmbeddedApp } from '@ottocode/server';

const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  agent: 'build',
});
```

## MCP configuration

Configure MCP servers in either project or global config:

```json
{
  "mcp": {
    "servers": [
      {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
      },
      {
        "name": "linear",
        "transport": "http",
        "url": "https://mcp.linear.app/mcp"
      }
    ]
  }
}
```

OAuth tokens for remote MCP servers are stored in the secure OAuth directory shown above.
