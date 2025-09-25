# Configuration

[← Back to README](../README.md) • [Docs Index](./index.md)

AGI uses a `.agi` directory in your project root for configuration and data.

## Directory Structure

```
.agi/
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

### `.agi/config.json`

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-3-opus",
    "agent": "general"
  },
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true },
    "google": { "enabled": false }
  }
}
```

### `.agi/agents.json`

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
