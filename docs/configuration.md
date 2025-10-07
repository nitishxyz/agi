# Configuration

[← Back to README](../README.md) • [Docs Index](./index.md)

AGI uses a flexible configuration system with three priority levels:

1. **Injected config** (for embedded mode) - Highest priority
2. **Environment variables** - Middle priority  
3. **Config files** (`.agi/` directory) - Fallback

This allows AGI to work in CLI mode, embedded applications, CI/CD, and hybrid environments.

## Configuration Priority

When AGI needs a configuration value, it checks in this order:

```
1. Injected config (createEmbeddedApp({ ... }))
   ↓ if not found
2. Environment variables (OPENAI_API_KEY, AGI_PROVIDER, etc.)
   ↓ if not found  
3. Config files (~/.config/agi/auth.json, .agi/config.json)
   ↓ if not found
4. Built-in defaults
```

## Directory Structure

```
~/.config/agi/           # Global configuration
├── auth.json            # API keys (secure, 0600 permissions)
└── config.json          # Global defaults

.agi/                    # Project-specific configuration
├── agi.sqlite           # Local conversation history database
├── config.json          # Project configuration
├── agents.json          # Agent customizations
├── agents/              # Custom agent prompts
│   └── <agent-name>/
│       └── agent.md     # Agent system prompt
├── commands/            # Custom command definitions
│   ├── <command>.json   # Command configuration
│   └── <command>.md     # Command prompt template
├── tools/               # Custom tool implementations
│   └── <tool-name>/
│       ├── tool.ts      # Tool implementation
│       └── prompt.txt   # Tool context (optional)
└── artifacts/           # Large outputs and file artifacts
    └── <uuid>/          # Artifact storage
```

## Configuration Files

### Global Auth: `~/.config/agi/auth.json`

API keys stored securely (file permissions: 0600):

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

### Global Config: `~/.config/agi/config.json`

User-wide defaults:

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "agent": "general"
  }
}
```

### Project Config: `.agi/config.json`

Project-specific overrides:

```json
{
  "defaults": {
    "provider": "openai",
    "model": "gpt-4",
    "agent": "build"
  },
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true },
    "google": { "enabled": false }
  }
}
```

### Agent Customization: `.agi/agents.json`

```json
{
  "build": {
    "tools": ["read", "write", "bash", "git_*"],
    "prompt": ".agi/agents/build/agent.md"
  },
  "test": {
    "tools": ["read", "bash"],
    "appendTools": ["progress_update"]
  }
}
```

## Environment Variables

AGI reads these environment variables (falls back to files if not set):

```bash
# Provider API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...
OPENCODE_API_KEY=...

# Optional: Default provider/model/agent
AGI_PROVIDER=openai
AGI_MODEL=gpt-4
AGI_AGENT=build
```

## Embedded Mode

When embedding AGI in your application, inject config directly:

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-...', // Or read from your vault
  agent: 'build',
});
```

See [Embedding Guide](./embedding-guide.md) for full details.

## Configuration Scenarios

| Mode | Injected | Env Vars | Files | Use Case |
|------|----------|----------|-------|----------|
| **CLI** | ❌ | ❌ | ✅ | Desktop development |
| **CI/CD** | ❌ | ✅ | ❌ | GitHub Actions, Docker |
| **Embedded** | ✅ | ❌ | ❌ | VSCode extension, SaaS |
| **Hybrid** | ✅ Partial | ✅ API keys | ✅ Defaults | Mix of all |
