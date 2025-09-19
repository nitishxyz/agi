# AGI CLI

> [!IMPORTANT]
> A powerful AI-powered development assistant CLI that brings intelligent agents and tools directly to your terminal. Build, plan, and execute development tasks with AI assistance from multiple providers.

## Features

- 🤖 **Multi-Provider Support**: Seamlessly switch between OpenAI, Anthropic, and Google AI
- 🎯 **Specialized Agents**: Purpose-built agents for different tasks (general, build, plan, git)
- 🔧 **Extensible Tool System**: Built-in tools for file operations, git, bash commands with project-specific extensions
- 💾 **Session Management**: Persistent conversation history stored locally in SQLite
- 📁 **Project-Aware**: Maintains context per project with local `.agi` configuration
- 🌊 **Real-time Streaming**: Live AI responses via Server-Sent Events (SSE)
- ⚙️ **Custom Commands**: Define project-specific commands with custom prompts and agents
- 🖥️ **HTTP Server Mode**: Run as a server for integration with other tools
- ⚡ **Powered by Bun**: Fast runtime with native TypeScript support

## Installation

### From NPM

```bash
npm install -g @agi-cli/core
```

### From Source

> [!NOTE]
> This project uses Bun as its runtime. Install Bun first from [bun.sh](https://bun.sh)

```bash
# Clone the repository
git clone https://github.com/ntishxyz/agi.git
cd agi

# Install dependencies with Bun
bun install

# Build the CLI binary
bun run build

# Optional: Link globally for system-wide access
bun link
```

## Quick Start

### Initial Setup

```bash
# Configure your AI provider credentials interactively
agi setup

# Or manually configure authentication
agi auth login
```

### Basic Usage

```bash
# Ask a one-shot question
agi "explain this error: TypeError: Cannot read property 'map' of undefined"

# Interactive mode - prompts for input
agi

# Use a specific agent for specialized tasks
agi "help me write tests" --agent build

# Continue your last conversation
agi "what about edge cases?" --last

# Use a specific provider and model
agi "refactor this function" --provider anthropic --model claude-3-opus
```

## Core Commands

### 🗂️ Session Management

```bash
agi sessions              # Interactive session picker (default)
agi sessions --list       # List all sessions
agi sessions --json       # Output sessions as JSON
agi sessions --limit 10   # Limit number of sessions shown
```

### 🔄 Provider & Model Configuration

```bash
agi models               # Interactive provider/model selection
agi switch               # Alias for models command
agi auth login           # Configure provider credentials
agi auth list            # List configured providers
agi auth logout          # Remove provider credentials
```

### 🤖 Agent & Tool Management

```bash
agi agents               # List and configure agents interactively
agi agents --local       # Edit local project agents
agi tools                # List available tools and agent access
agi scaffold             # Generate new agents, tools, or commands
```

### 🔍 Diagnostics

```bash
agi doctor               # Check configuration and diagnose issues
agi --version            # Show version
agi --help               # Show help with discovered commands
```

### 🌐 Server Mode

```bash
agi serve                # Start HTTP server on random port
agi serve --port 3000    # Start on specific port
```

## Project Configuration

> [!IMPORTANT]
> AGI uses a `.agi` directory in your project root for all configuration and data storage.

### Directory Structure

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

### Configuration Files

#### `.agi/config.json`

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

#### `.agi/agents.json`

```json
{
  "build": {
    "tools": ["fs_read", "fs_write", "bash", "git_*"],
    "prompt": ".agi/agents/build/agent.md"
  },
  "test": {
    "tools": ["fs_read", "bash"],
    "appendTools": ["progress_update"]
  }
}
```

## Built-in Agents

| Agent | Purpose | Default Tools |
|-------|---------|--------------|
| **general** | General-purpose assistant | Minimal tool access |
| **build** | Code generation and build tasks | File system, bash, git |
| **plan** | Strategic planning and architecture | Read-only tools |
| **git** | Git operations and review | Git tools, file reading |

## Built-in Tools

### File System Operations
- `fs_read` - Read files from the filesystem
- `fs_write` - Write files to the filesystem
- `fs_list` - List directory contents
- `fs_search` - Search for files by pattern

### Git Operations
- `git_status` - Show working tree status
- `git_diff` - Show changes between commits
- `git_commit` - Create a new commit
- `git_log` - Show commit logs

### System Operations
- `bash` - Execute shell commands safely
- `progress_update` - Provide status updates during long operations
- `finish` - Mark task completion

## Custom Commands

> [!TIP]
> Create reusable commands for common workflows in your project

### Example: Commit Command

Create `.agi/commands/commit.json`:

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

## Custom Tools

> [!NOTE]
> Tools must implement the AITool interface and export as default

### Example: Custom Tool Implementation

Create `.agi/tools/file-size/tool.ts`:

```typescript
import { z } from 'zod';
import type { AITool, ToolContext } from '../../../src/ai/types';

const tool: AITool<{ path: string }, { size: number }> = {
  name: 'file-size',
  description: 'Get file size at a path',
  parameters: z.object({ path: z.string() }),
  async execute({ path }, ctx: ToolContext) {
    const fs = await import('node:fs/promises');
    const stat = await fs.stat(path);
    return { size: stat.size };
  }
};

export default tool;
```

## Environment Variables

```bash
# Provider API Keys (stored securely, never in version control)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Optional Configuration
AGI_PROJECT_ROOT=/path/to/project    # Override project detection
PORT=3000                             # Default server port
DEBUG_AGI=1                           # Enable debug output
DB_FILE_NAME=.agi/agi.sqlite         # Database file location
```

## API Reference

> [!NOTE]
> When running in server mode (`agi serve`), a full REST API is available

### REST Endpoints

- `GET /openapi.json` - OpenAPI specification
- `GET /health` - Health check endpoint
- `GET /sessions` - List all sessions
- `POST /sessions` - Create new session
- `GET /sessions/:id` - Get session details
- `POST /sessions/:id/messages` - Send message (SSE streaming response)

### SSE Streaming Events

The server streams responses as Server-Sent Events with these event types:

- `assistant.delta` - Incremental text chunks from the assistant
- `tool.call` - Tool invocation notification
- `tool.result` - Tool execution result
- `usage` - Token usage statistics
- `error` - Error messages

## Development

### Prerequisites

- [Bun](https://bun.sh) runtime v1.0+
- Node.js 18+ (for npm package compatibility)
- SQLite3 (included with most systems)

### Project Structure

```
agi/
├── src/
│   ├── ai/              # AI agents, tools, and provider logic
│   │   ├── agents/      # Agent registry and defaults
│   │   ├── tools/       # Built-in tool implementations
│   │   └── types.ts     # TypeScript interfaces
│   ├── cli/             # CLI commands and interface
│   ├── config/          # Configuration management
│   ├── db/              # Database schemas and migrations
│   │   └── schema/      # Drizzle ORM schemas
│   ├── providers/       # AI provider integrations
│   ├── runtime/         # Runtime assets and utilities
│   └── server/          # HTTP server and API routes
├── tests/               # Test suites
├── scripts/             # Build and utility scripts
├── drizzle/             # Database migrations
├── docs/                # Additional documentation
└── AGENTS.md            # Contributor conventions
```

### Development Workflow

```bash
# Install dependencies
bun install

# Run the CLI locally
bun run cli "<prompt>"

# Run linter (Biome)
bun lint

# Run tests
bun test

# Generate database migrations
bun run db:generate

# Reset database (development)
bun run db:reset

# Update provider catalog
bun run catalog:update

# Build standalone binary
bun run build

# Cross-compile for other platforms
bun run compile:linux-x64
bun run compile:darwin-arm64
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test agents.test.ts

# Run tests matching pattern
bun test --pattern "config"
```

### Database Management

The project uses SQLite with Drizzle ORM for data persistence:

- **Sessions**: Conversation sessions with metadata
- **Messages**: Individual messages in conversations
- **Message Parts**: Structured content (text, tool calls, results)
- **Artifacts**: Large outputs stored separately

Migrations are automatically applied on startup. To reset:

```bash
bun run scripts/reset-db.ts
```

## Contributing

> [!IMPORTANT]
> Please read `AGENTS.md` for contributor conventions and guidelines

### Key Guidelines

1. **Use Bun exclusively** - No npm/yarn/pnpm commands
2. **Follow existing patterns** - Check similar code before implementing
3. **Biome for linting** - Run `bun lint` before committing
4. **Path aliases** - Use `@/` imports instead of relative paths
5. **Minimal changes** - Keep PRs focused and avoid unrelated refactors
6. **Test coverage** - Add tests for new features
7. **TypeScript strict mode** - Maintain type safety

### Commit Convention

Keep commits focused and descriptive. Reference issues when applicable:

```bash
git commit -m "feat(agents): add custom tool loader"
git commit -m "fix(cli): handle missing config gracefully"
git commit -m "docs: update API reference"
```

## Troubleshooting

### Common Issues

**Provider not authorized**
```bash
# Re-run authentication setup
agi auth login
```

**Database errors**
```bash
# Reset local database
bun run db:reset
```

**Configuration issues**
```bash
# Run diagnostics
agi doctor
```

**Debug mode**
```bash
# Enable debug output
DEBUG_AGI=1 agi "<your prompt>"
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/ntishxyz/agi/issues)
- **Documentation**: [docs/](./docs/)
- **Author**: ntishxyz
- **Homepage**: [https://github.com/ntishxyz/agi](https://github.com/ntishxyz/agi)

---

Built with ❤️ using [Bun](https://bun.sh), [Hono](https://hono.dev), and [AI SDK](https://sdk.vercel.ai)
