# 🤖 AGI CLI

> **AI-Powered Development Assistant for Your Terminal** 🚀
> Your intelligent coding companion - bringing multi-provider AI assistance, powerful agents, and seamless integrations directly to your command line. Build faster, debug smarter, code with confidence.

[![Version](https://img.shields.io/badge/version-0.1.92-blue)](https://github.com/nitishxyz/agi)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Powered by AI SDK](https://img.shields.io/badge/powered%20by-AI%20SDK%20v5-purple)](https://sdk.vercel.ai)
[![Bun](https://img.shields.io/badge/runtime-Bun-orange)](https://bun.sh)

---

## 🎯 What is AGI CLI?

AGI CLI is a **next-generation AI development assistant** that combines the power of multiple AI providers with specialized agents and a rich toolset:

- 🤖 **Multi-Provider AI** - OpenAI, Anthropic, Google AI, OpenRouter, OpenCode all in one tool
- 🎯 **Specialized Agents** - General coding, build tasks, planning, git operations
- 🛠️ **15+ Built-in Tools** - File operations, git, bash, search, structured editing
- 🌐 **Modern Web UI** - Full-featured React dashboard with mobile support
- 📦 **Embeddable SDK** - Integrate AGI into your own applications
- 💾 **Session Management** - SQLite-based persistence for conversation history
- ⚡ **Real-time Streaming** - SSE live responses with progress updates
- 🔧 **Project-Aware** - Per-project configuration and custom tools

**Think of it as:** Your AI pair programmer + dev tools + conversation history—all accessible via CLI or web interface.

---

## ✨ Why AGI CLI?

### The All-in-One AI Development Suite

| Feature             | AGI CLI           | GitHub Copilot | Cursor AI      |
| ------------------- | ----------------- | -------------- | -------------- |
| **Multi-Provider**  | ✅ 5+ providers   | ❌ GitHub only | ✅ Limited     |
| **CLI Native**      | ✅ Terminal-first | ❌ Editor only | ❌ Editor only |
| **Web Dashboard**   | ✅ Full UI        | ❌ None        | ❌ None        |
| **Embeddable**      | ✅ Full SDK       | ❌ None        | ❌ None        |
| **Custom Tools**    | ✅ Per-project    | ❌ Limited     | ⚠️ Limited     |
| **Session History** | ✅ SQLite         | ⚠️ Cloud only  | ⚠️ Cloud only  |
| **Self-Hosted**     | ✅ Complete       | ❌ No          | ❌ No          |
| **Open Source**     | ✅ MIT            | ❌ No          | ❌ No          |

---

## 🚀 Quick Start

### Installation

```bash
# One-liner install (recommended)
curl -fsSL https://install.agi.nitish.sh | sh

# Or with npm
npm install -g @agi-cli/install

# Or with Bun
bun install -g @agi-cli/install
```

### Configure Your AI Provider

```bash
# Interactive setup wizard
agi setup

# Or manually configure
agi auth login
```

### Start Coding with AI

```bash
# Ask a quick question
agi "explain this error: TypeError: Cannot read property 'map' of undefined"

# Interactive mode
agi

# Use specialized agents
agi "help me write tests" --agent build

# Continue your last conversation
agi "what about edge cases?" --last

# Start the web interface
agi serve
```

This launches the web UI at `http://127.0.0.1:3456` with:

- 💬 **Interactive Chat Interface**
- 📊 **Session Management & History**
- 🔧 **Visual Configuration Editor**
- 📁 **File & Artifact Viewing**
- 📱 **Mobile-Optimized UI**

---

## 🤖 AI-Powered Development

### Choose Your Provider

AGI CLI supports **5 major AI providers** with 30+ models:

```bash
# Anthropic Claude (recommended for coding)
agi "refactor this function" --provider anthropic --model claude-4.5-sonnet

# OpenAI GPT-5
agi "explain TypeScript generics" --provider openai --model gpt-5-codex

# Google Gemini (excellent for long context)
agi "analyze this entire codebase" --provider google --model gemini-2.5-pro

# OpenRouter (access to all models with one key)
agi "help me debug" --provider openrouter --model anthropic/claude-3.5-sonnet

# OpenCode
agi "what's wrong with my code?" --provider opencode
```

**Supported Providers:**

- **Anthropic** - Claude 3.5 Sonnet, Claude 3.7 Sonnet, Claude Opus
- **OpenAI** - GPT-4 Turbo, GPT-4o, GPT-4o-mini, o1, o1-mini
- **Google AI** - Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 2.0 Flash Thinking
- **OpenRouter** - Access to 100+ models from multiple providers
- **OpenCode** - Free tier access to Anthropic models

### Specialized Agents

AGI CLI includes **4 specialized agents** optimized for different tasks:

#### 🔨 Build Agent

**Best for:** Code generation, feature implementation, bug fixes

```bash
agi "create a React component for user authentication" --agent build
agi "fix the memory leak in server.ts" --agent build
```

**Tools:** read, write, ls, tree, bash, git, grep, ripgrep, apply_patch, edit

#### 📋 Plan Agent

**Best for:** Architecture planning, code analysis, strategic decisions

```bash
agi "design a scalable API architecture" --agent plan
agi "analyze the security implications of this change" --agent plan
```

**Tools:** read, ls, tree, ripgrep, update_plan, websearch (read-only focus)

#### 🔀 Git Agent

**Best for:** Git operations, commit messages, code reviews

```bash
agi "review my changes and suggest improvements" --agent git
agi "generate a detailed commit message" --agent git
```

**Tools:** git_status, git_diff, git_commit, git_log, read, ls

#### 💬 General Agent

**Best for:** Mixed tasks, conversational coding, learning

```bash
agi "explain how async/await works in JavaScript" --agent general
agi "help me debug this React hook" --agent general
```

**Tools:** Balanced set of read/write, bash, search, and planning tools

---

## 🛠️ Complete Development Toolkit

### 15+ Built-in Tools

#### File Operations

```bash
# Read files with syntax highlighting
# Write files with safe overwrites
# List directory contents
# Display directory trees
```

Tools: `read`, `write`, `ls`, `tree`

#### Git Operations

```bash
# Check working tree status
# Show diffs between commits
# Create commits with AI-generated messages
# View commit history
```

Tools: `git_status`, `git_diff`, `git_commit`, `git_log`

#### Advanced Operations

```bash
# Search with regex patterns
# Structured file editing (replace, insert, delete)
# Apply unified diff patches
# Execute shell commands safely
# Web search for documentation
```

Tools: `ripgrep`, `grep`, `edit`, `apply_patch`, `bash`, `websearch`

#### Agent Communication

```bash
# Progress updates during long operations
# Task completion notifications
# Execution plan visualization
```

Tools: `progress_update`, `finish`, `update_plan`

### Custom Tools

Add project-specific tools in `.agi/tools/`:

```typescript
// .agi/tools/deploy.ts
import { tool } from "@agi-cli/sdk";
import { z } from "zod";

export default tool({
  name: "deploy",
  description: "Deploy the application to production",
  parameters: z.object({
    environment: z.enum(["staging", "production"]),
    version: z.string().optional(),
  }),
  execute: async ({ environment, version }) => {
    // Your deployment logic
    return { success: true, url: "https://app.example.com" };
  },
});
```

The tool is automatically discovered and available to all agents!

---

## 🌐 Web Interface

The modern web dashboard combines all dev tools in one place:

### Features

- 💬 **Interactive Chat** - Full conversation interface with streaming
- 📊 **Session Management** - Browse, search, and resume conversations
- 🎨 **Syntax Highlighting** - Code blocks with language detection
- 📁 **Artifact Viewer** - View generated files and diffs
- 🔧 **Live Configuration** - Edit settings without leaving the browser
- 📱 **Mobile-Optimized** - Responsive design for coding on-the-go
- 🌙 **Dark Theme** - Easy on the eyes

### Access the Web UI

```bash
# Start server (localhost only)
agi serve

# Start with network access (accessible on local network)
agi serve --network

# Specify custom port
agi serve --port 3000 --network
```

Open `http://127.0.0.1:3456` (or your custom port) in your browser.

**Network Mode** allows access from:

- Other devices on your local network
- Tailscale/VPN connections
- Docker containers
- Virtual machines

📖 **See:** [Mobile Support Guide](docs/mobile-support.md) | [Web App README](apps/web/README.md)

---

## 📝 Configuration

Create `.agi/config.json` to customize everything:

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "agent": "build",
    "temperature": 0.7
  },
  "providers": {
    "anthropic": {
      "enabled": true,
      "apiKey": "${ANTHROPIC_API_KEY}"
    },
    "openai": {
      "enabled": true,
      "apiKey": "${OPENAI_API_KEY}"
    }
  },
  "tools": {
    "enabled": ["read", "write", "bash", "git_*", "ripgrep"],
    "disabled": []
  }
}
```

### Configuration Options

| Section     | Purpose                                     | Docs                                         |
| ----------- | ------------------------------------------- | -------------------------------------------- |
| `defaults`  | Default provider, model, agent, temperature | [Configuration Guide](docs/configuration.md) |
| `providers` | Provider-specific settings and API keys     | [Configuration Guide](docs/configuration.md) |
| `tools`     | Enable/disable specific tools               | [Agents & Tools](docs/agents-tools.md)       |
| `server`    | Web server port and network settings        | [Embedding Guide](docs/embedding-guide.md)   |

**Config Hierarchy:** Defaults → Global (`~/.config/agi/`) → Project (`.agi/`) → CLI flags

---

## 📦 Embedding AGI

Embed the complete AGI server and Web UI in your own applications:

```typescript
import { createEmbeddedApp } from "@agi-cli/server";
import { serveWebUI } from "@agi-cli/web-ui";

const app = createEmbeddedApp({
  provider: "anthropic",
  model: "claude-3-5-sonnet-20241022",
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: "build",
  corsOrigins: ["https://myapp.example.com"],
});

Bun.serve({
  port: 9100,
  fetch: async (req) => {
    // Serve Web UI at /ui
    const uiResponse = await serveWebUI({ prefix: "/ui" })(req);
    if (uiResponse) return uiResponse;

    // Handle API routes
    return app.fetch(req);
  },
});
```

### What You Get

- 🔧 **Hybrid Configuration** - Inject config or fallback to env/files
- 🌐 **Network Access** - Localhost, local network, and proxy support
- 🎨 **Embedded Web UI** - Full interface served from your app
- ⚡ **Zero Installation** - No separate AGI setup needed
- 🛡️ **Type Safety** - Full TypeScript support

### Use the SDK Directly

```typescript
import { generateText, resolveModel, discoverProjectTools } from "@agi-cli/sdk";

const model = await resolveModel("anthropic", "claude-sonnet-4");
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: "List all TypeScript files and count total lines",
  tools: Object.fromEntries(tools.map((t) => [t.name, t.tool])),
  maxSteps: 10,
});

console.log(result.text);
```

**Full guides:** [Embedding Guide](docs/embedding-guide.md) | [Integration Guide](docs/integration-guide.md) | [SDK README](packages/sdk/README.md)

---

## 🔌 Integration Options

AGI can be integrated into your projects in multiple ways:

| Approach            | Packages                               | Best For                                            |
| ------------------- | -------------------------------------- | --------------------------------------------------- |
| **Full Stack**      | `@agi-cli/server` + `@agi-cli/web-ui`  | VSCode extensions, Electron apps, quick deployments |
| **Custom Frontend** | `@agi-cli/server` + `@agi-cli/web-sdk` | Branded apps with custom React UI                   |
| **API Client**      | `@agi-cli/api`                         | Connect to existing AGI server                      |
| **Programmatic**    | `@agi-cli/sdk`                         | CLI tools, automation, custom agents                |

📖 **Complete integration guide with examples:** [Integration Guide](docs/integration-guide.md)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AGI CLI                               │
│  Entry point - orchestrates all components                  │
└───────────┬─────────────────────────────────────────────────┘
            │
            ├──> 🚀 HTTP Server (packages/server)
            │    • REST API for chat/sessions
            │    • SSE streaming support
            │    • OpenAPI spec generation
            │    • Event bus for real-time updates
            │
            ├──> 🎨 Web Dashboard (apps/web)
            │    • React + TypeScript + Vite
            │    • TanStack Router + Query
            │    • Real-time chat interface
            │    • Session management UI
            │
            └──> 🤖 SDK (@agi-cli/sdk)
                 • Multi-provider AI (5+ providers)
                 • Built-in tools (15+ tools)
                 • Agent system (4 agents)
                 • Custom tool discovery
```

### Project Structure

```
agi/
├── apps/
│   ├── cli/              # Main CLI application
│   └── web/              # Web interface (React + Vite)
├── packages/
│   ├── auth/             # Authentication & credentials
│   ├── config/           # Configuration system
│   ├── database/         # SQLite + Drizzle ORM
│   ├── install/          # npm installer package
│   ├── prompts/          # System prompts
│   ├── providers/        # AI provider catalog
│   ├── sdk/              # Core SDK
│   ├── server/           # HTTP server (Hono)
│   ├── web-sdk/          # Web SDK for custom frontends
│   └── web-ui/           # Web UI components
├── docs/                 # Documentation
└── examples/             # Example integrations
```

**Learn more:** [Architecture Overview](docs/architecture.md)

---

## 🎓 Use Cases

### For Individual Developers 💻

- **Faster Coding**: AI pair programming right in your terminal
- **Multi-Provider**: Choose the best model for each task
- **Local History**: All conversations stored locally in SQLite
- **Project-Aware**: Custom tools and configuration per project

### For Teams 👥

- **Consistent Setup**: Same config across all developers
- **Embedded in Tools**: Integrate AGI into your team's workflow
- **Self-Hosted**: Keep sensitive code on your infrastructure
- **Custom Agents**: Build team-specific AI assistants

### For Learning 📚

- **Interactive**: Ask questions and get instant answers
- **Code Generation**: Learn by example with AI-generated code
- **Documentation**: Built-in web search for up-to-date info
- **Multi-Model**: Compare different AI approaches

### For CI/CD 🔄

- **Scriptable**: Full CLI automation support
- **Embeddable**: Run AGI as part of your pipeline
- **Multi-Provider**: Fallback between providers
- **Session Persistence**: Track decisions across builds

---

## 📚 Documentation

| Document                                       | Description                  |
| ---------------------------------------------- | ---------------------------- |
| [Getting Started](docs/getting-started.md)     | Installation & quick start   |
| [Usage Guide](docs/usage.md)                   | Command examples & workflows |
| [Configuration](docs/configuration.md)         | Complete config reference    |
| [Agents & Tools](docs/agents-tools.md)         | Built-in capabilities        |
| [Customization](docs/customization.md)         | Custom commands & tools      |
| [Embedding Guide](docs/embedding-guide.md)     | Embed AGI in your apps       |
| [Integration Guide](docs/integration-guide.md) | Integration patterns         |
| [SDK Reference](packages/sdk/README.md)        | SDK documentation            |
| [API Reference](docs/api.md)                   | REST endpoints & SSE events  |
| [Architecture](docs/architecture.md)           | System design & structure    |
| [Development](docs/development.md)             | Contributing guide           |
| [Troubleshooting](docs/troubleshooting.md)     | Common issues & fixes        |
| [All Docs](docs/index.md)                      | Complete docs index          |

---

## 🔧 Advanced Usage

### Environment Variables

```bash
# API Keys
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."

# Configuration
export AGI_PROVIDER="anthropic"
export AGI_MODEL="claude-3-5-sonnet-20241022"
export AGI_AGENT="build"

# Rendering
export AGI_RENDER_MARKDOWN=1  # Enable markdown rendering
export DEBUG_RPC_LOG=1        # Debug logging
```

### Session Management

```bash
# List all sessions
agi sessions

# Continue a specific session
agi sessions use <session-id>

# Delete old sessions
agi sessions delete <session-id>

# Export session history
agi sessions export <session-id> --format json
```

### Model Management

```bash
# List available models
agi models

# List models for specific provider
agi models --provider anthropic

# Get model details
agi models --info claude-3-5-sonnet-20241022
```

### Agent Management

```bash
# List available agents
agi agents

# Get agent details
agi agents --info build

# Use agent with specific tools
agi "help me debug" --agent build --tools read,bash,git_status
```

---

## 🔍 Troubleshooting

### Command Not Found

```bash
# Check installation
which agi

# Add to PATH (if needed)
export PATH="$HOME/.local/bin:$PATH"

# Reinstall
curl -fsSL https://install.agi.nitish.sh | sh
```

### Provider Authentication Failed

```bash
# Check API key
echo $ANTHROPIC_API_KEY

# Reconfigure
agi auth login

# Use setup wizard
agi setup
```

### Web UI Not Loading

```bash
# Check if server is running
curl http://127.0.0.1:3456/health

# Use different port
agi serve --port 3000

# Enable network access
agi serve --network
```

### Streaming Issues

```bash
# Increase timeout
export AGI_TIMEOUT=300

# Use non-streaming mode
agi "your question" --no-stream

# Check for proxy issues
unset HTTP_PROXY HTTPS_PROXY
```

📖 **See [Troubleshooting Guide](docs/troubleshooting.md) for more help**

---

## 🏗️ Building from Source

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- Git

### Build Commands

```bash
# Clone & install
git clone https://github.com/nitishxyz/agi.git
cd agi
bun install

# Run from source
bun run cli "hello"

# Build binary for your platform
bun run compile

# Build for all platforms
bun run build:bin:darwin-arm64
bun run build:bin:darwin-x64
bun run build:bin:linux-x64
bun run build:bin:linux-arm64
```

### Development Workflow

```bash
# Run tests
bun test

# Lint code
bun lint

# Type check
bun run typecheck

# Run CLI in dev mode
bun run dev:cli

# Run web UI in dev mode
bun run dev:web
```

---

## 💡 Examples

Check out [examples/](./examples/) for real-world usage:

- **[Basic CLI Bot](examples/basic-cli-bot/)** - Simple question-answering
- **[Git Commit Helper](examples/git-commit-helper/)** - Smart commit messages
- **[Embedded Hybrid](examples/embedded-hybrid-fallback.ts)** - Full embedding example
- **[API Integration](examples/api-web-ui-integration/)** - Custom frontend integration

---

## 🗺️ Roadmap

We're working towards a stable 1.0 release:

- ✅ Monorepo architecture with clean package boundaries
- ✅ Multi-provider support (5+ providers, 30+ models)
- ✅ Web interface with mobile support
- ✅ Embeddable SDK
- ✅ Session persistence (SQLite)
- ✅ Custom tool discovery
- 🔄 Comprehensive test coverage (in progress)
- 🔄 Production deployments and user feedback
- 📋 API stability guarantees
- 📋 Long-term support commitment
- 📋 Plugin system for third-party extensions
- 📋 Cloud sync for sessions (optional)

**Target:** v1.0.0 in Q2 2025

---

## 🤝 Contributing

We welcome contributions! Whether you're:

- 📝 Improving documentation
- 🧪 Adding test coverage
- 🔧 Building new tools
- 🌐 Enhancing the web UI
- 🐛 Fixing bugs
- ✨ Adding features

**See [AGENTS.md](AGENTS.md) for development guidelines.**

### Areas Where Help is Needed

- **Documentation** - Tutorials, examples, translations
- **Testing** - Unit tests, integration tests, E2E tests
- **Tools** - New built-in tools (database, docker, kubernetes)
- **Web UI** - Component improvements, accessibility
- **Providers** - Support for new AI providers
- **Agents** - New specialized agent types

---

## 🙏 Acknowledgments

AGI CLI is built on the shoulders of giants:

- **[Vercel AI SDK](https://sdk.vercel.ai)** - Unified AI provider interface
- **[Bun](https://bun.sh)** - Lightning-fast JavaScript runtime
- **[Hono](https://hono.dev)** - Ultrafast web framework
- **[Drizzle ORM](https://orm.drizzle.team)** - TypeScript ORM
- **[TanStack](https://tanstack.com)** - Powerful React utilities
- **Anthropic, OpenAI, Google** - Amazing AI models
- **The Open Source Community** - For inspiration and feedback

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details

---

## 🔗 Links

- **GitHub**: [github.com/nitishxyz/agi](https://github.com/nitishxyz/agi)
- **Issues**: [Report bugs or request features](https://github.com/nitishxyz/agi/issues)
- **npm Package**: [@agi-cli/install](https://www.npmjs.com/package/@agi-cli/install)
- **SDK Package**: [@agi-cli/sdk](https://www.npmjs.com/package/@agi-cli/sdk)
- **Documentation**: [docs/](docs/)

---

## 🌟 Star History

If AGI CLI helps you build faster, please consider starring the repo! ⭐

---

<p align="center">
  <strong>Made with ❤️ for developers worldwide</strong><br>
  <em>From a simple CLI to a complete AI development suite</em>
</p>

<p align="center">
  <a href="#-quick-start">Get Started</a> •
  <a href="docs/getting-started.md">Installation</a> •
  <a href="docs/">Full Docs</a> •
  <a href="https://github.com/nitishxyz/agi/issues">Support</a>
</p>
