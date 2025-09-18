# AGI CLI

A powerful AI-powered development assistant CLI that brings AI agents and tools directly to your terminal. Build, plan, and execute development tasks with intelligent assistance from multiple AI providers.

## Features

- **Multi-Provider Support**: Seamlessly switch between OpenAI, Anthropic, and Google AI providers
- **Intelligent Agents**: Specialized agents for different tasks (general, build, plan, commit, etc.)
- **Extensible Tool System**: Built-in tools for file operations, git, bash commands, and more
- **Session Management**: Persistent conversation history stored locally in SQLite
- **Project-Aware**: Maintains context per project with local `.agi` configuration
- **Streaming Responses**: Real-time AI responses via Server-Sent Events (SSE)
- **Custom Commands**: Define project-specific commands with custom prompts and agents
- **HTTP Server Mode**: Run as a server for integration with other tools

## Installation

### From NPM

```bash
npm install -g @agi-cli/core
```

### From Source

```bash
# Clone the repository
git clone https://github.com/ntishxyz/agi.git
cd agi

# Install dependencies with Bun
bun install

# Build the CLI
bun run build

# Optional: Link globally
bun link
```

## Quick Start

### Initial Setup

```bash
# Configure your AI provider credentials
agi setup

# Or manually configure auth
agi auth login
```

### Basic Usage

```bash
# Ask a one-shot question
agi "explain this error: TypeError: Cannot read property 'map' of undefined"

# Interactive mode
agi

# Use a specific agent
agi "help me write tests" --agent build

# Continue last conversation
agi "what about edge cases?" --last

# Use a specific provider and model
agi "refactor this function" --provider anthropic --model claude-3-opus
```

## Core Commands

### Session Management
```bash
agi sessions              # Interactive session picker
agi sessions --list       # List all sessions
agi sessions --json       # Output sessions as JSON
agi sessions --limit 10   # Limit number of sessions shown
```

### Provider & Model Configuration
```bash
agi models               # Interactive provider/model selection
agi switch               # Alias for models command
agi auth login           # Configure provider credentials
agi auth list            # List configured providers
agi auth logout          # Remove provider credentials
```

### Agent & Tool Management
```bash
agi agents               # List and configure agents
agi agents --local       # Edit local project agents
agi tools                # List available tools and agent access
agi scaffold             # Generate new agents, tools, or commands
```

### Diagnostics
```bash
agi doctor               # Check configuration and diagnose issues
agi --version            # Show version
agi --help               # Show help
```

### Server Mode
```bash
agi serve                # Start HTTP server (random port)
agi serve --port 3000    # Start on specific port
```

## Project Configuration

AGI uses a `.agi` directory in your project root for configuration and data storage:

```
.agi/
├── agi.sqlite           # Local conversation history
├── config.json          # Project configuration
├── agents.json          # Agent customizations
├── agents/              # Custom agent prompts
│   └── <agent-name>/
│       └── agent.md
├── commands/            # Custom command definitions
│   ├── <command>.json
│   └── <command>.md
└── tools/               # Custom tool implementations
    └── <tool-name>/
        ├── tool.ts      # Tool implementation
        └── prompt.txt   # Tool context
```

### Example config.json
```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-3-opus",
    "agent": "general"
  },
  "providers": {
    "anthropic": {
      "enabled": true
    }
  }
}
```

### Example agents.json
```json
{
  "build": {
    "tools": ["fs_read", "fs_write", "bash", "git_*"],
    "prompt": "You are a build automation expert..."
  },
  "test": {
    "tools": ["fs_read", "bash"],
    "appendTools": ["progress_update"]
  }
}
```

## Custom Commands

Create reusable commands for common tasks:

### Example: .agi/commands/commit.json
```json
{
  "name": "commit",
  "description": "Generate a commit message from staged changes",
  "agent": "commit",
  "interactive": true,
  "promptTemplate": "Generate a commit message for these changes:\n{input}",
  "confirm": {
    "required": true,
    "message": "Proceed with this commit message?"
  }
}
```

Usage:
```bash
agi commit
```

## Built-in Agents

- **general**: General-purpose assistant with broad tool access
- **build**: Specialized for build tasks, compilation, and project setup
- **plan**: Strategic planning and architecture decisions
- **commit**: Git commit message generation
- **quick**: Fast responses without tool access

## Built-in Tools

- **File System**: `fs_read`, `fs_write`, `fs_list`, `fs_search`
- **Git Operations**: `git_status`, `git_diff`, `git_commit`, `git_log`
- **Shell Commands**: `bash` - Execute shell commands safely
- **Progress Updates**: `progress_update` - Status updates during long operations
- **Finalization**: `finalize` - Mark task completion

## Environment Variables

```bash
# Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Optional Configuration
AGI_PROJECT_ROOT=/path/to/project    # Override project detection
PORT=3000                             # Default server port
DEBUG_AGI=1                           # Enable debug output
```

## Development

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- Node.js 18+ (for compatibility)
- SQLite3

### Project Structure

```
agi/
├── src/
│   ├── ai/              # AI agents, tools, and providers
│   ├── cli/             # CLI commands and interface
│   ├── config/          # Configuration management
│   ├── db/              # Database schemas and migrations
│   ├── providers/       # AI provider integrations
│   └── server/          # HTTP server and API routes
├── tests/               # Test suites
├── scripts/             # Build and utility scripts
└── docs/                # Additional documentation
```

### Running Tests

```bash
bun test                 # Run all tests
bun test <pattern>       # Run specific tests
```

### Building

```bash
bun run build            # Build standalone binary
bun run compile:linux-x64    # Cross-compile for Linux
bun run compile:darwin-arm64 # Cross-compile for macOS ARM
```

## API Reference

When running in server mode (`agi serve`), the following endpoints are available:

### REST API

- `GET /openapi.json` - OpenAPI specification
- `GET /health` - Health check
- `GET /sessions` - List sessions
- `POST /sessions` - Create session
- `GET /sessions/:id` - Get session details
- `POST /sessions/:id/messages` - Send message (SSE response)

### SSE Streaming Format

Messages stream as Server-Sent Events with the following event types:
- `assistant.delta` - Incremental text chunks
- `tool.call` - Tool invocation
- `tool.result` - Tool execution result
- `usage` - Token usage statistics
- `error` - Error messages

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Use Bun for all operations (no npm/yarn/pnpm)
2. Follow the existing code style (Biome for linting)
3. Keep changes focused and minimal
4. Update tests for new features
5. Follow conventions in `AGENTS.md`

### Development Workflow

```bash
# Install dependencies
bun install

# Run linter
bun lint

# Run tests
bun test

# Test CLI locally
bun run cli "<prompt>"

# Generate DB migrations
bun run db:generate
```

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/ntishxyz/agi/issues)
- **Documentation**: [docs/](./docs/)
- **Author**: ntishxyz