# AGI CLI

A powerful AI-powered development assistant CLI that brings intelligent agents and tools directly to your terminal. Build, plan, and execute development tasks with AI assistance from multiple providers.

## 🚀 Quick Start

```bash
# Install via npm/bun
npm install -g @agi-cli/install
# or
bun install -g @agi-cli/install

# Configure and run
agi setup               # Configure provider credentials
agi "hello"             # Ask a question
agi agents              # Explore built-in agents
```

**Alternative installations:** [Direct binary](docs/getting-started.md#installation) | [From source](docs/development.md)

## ✨ Features

- **🤖 Multi-Provider Support** - OpenAI, Anthropic, Google AI, OpenRouter, OpenCode
- **🎯 Specialized Agents** - general, build, plan, git
- **🛠️ Extensible Tools** - 15+ built-in tools (file ops, git, bash, etc.)
- **📝 Rich Markdown Output** - Pretty terminal rendering
- **💾 Session Management** - Local SQLite persistence
- **🔧 Project-Aware** - Per-project `.agi` configuration
- **⚡ Real-time Streaming** - SSE live responses
- **🌐 Web Interface** - Modern React-based UI
- **📦 Embeddable SDK** - Use AGI in your own projects
- **🚀 Fast Runtime** - Powered by Bun with TypeScript

## 📚 Documentation

### Getting Started
- **[Installation & Quick Start](docs/getting-started.md)** - Get up and running
- **[Usage Guide](docs/usage.md)** - Core commands and workflows
- **[Configuration](docs/configuration.md)** - Settings and project config

### Features & Customization
- **[Agents & Tools](docs/agents-tools.md)** - Built-in capabilities
- **[Customization](docs/customization.md)** - Custom commands and tools
- **[Environment](docs/environment.md)** - Variables and flags
- **[API Reference](docs/api.md)** - REST endpoints and SSE events

### Development
- **[Development Guide](docs/development.md)** - Structure, workflow, testing
- **[Architecture](docs/architecture.md)** - Monorepo structure and design
- **[Publishing](docs/publishing.md)** - Release workflow
- **[Contributing](AGENTS.md)** - Contribution guidelines for AI agents and humans

### Additional Resources
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and fixes
- **[All Documentation](docs/index.md)** - Complete docs index

## 🌐 Web Interface

AGI includes a modern web interface:

```bash
# Start server
agi serve

# In another terminal, start web app
cd apps/web
bun dev

# Open http://localhost:5173
```

**Features:**
- 💬 Interactive chat interface
- 📊 Session management and history
- 🔧 Visual configuration editor
- 📁 File and artifact viewing
- 🎨 Modern, responsive UI

**See:** [apps/web/README.md](./apps/web/README.md) | [apps/web/QUICKSTART.md](./apps/web/QUICKSTART.md)

## 📦 SDK Usage

Embed AGI agents in your own projects:

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

**Full SDK documentation:** [packages/sdk/README.md](./packages/sdk/README.md)

## 🏗️ Project Structure

AGI is organized as a modular monorepo:

```
agi/
├── apps/
│   ├── cli/          # Main CLI application
│   └── web/          # Web interface (React + Vite)
├── packages/
│   ├── auth/         # Authentication & credentials
│   ├── config/       # Configuration system
│   ├── database/     # SQLite + Drizzle ORM
│   ├── install/      # npm installer package
│   ├── prompts/      # System prompts
│   ├── providers/    # AI provider catalog
│   ├── sdk/          # Core SDK
│   ├── server/       # HTTP server (Hono)
│   └── web-ui/       # Web UI components
├── docs/             # Documentation
└── examples/         # Example projects
```

**Learn more:** [Architecture Overview](docs/architecture.md)

## 💡 Examples

Check out [examples/](./examples/) for real-world usage:

- **[Basic CLI Bot](examples/basic-cli-bot/)** - Simple question-answering
- **[Git Commit Helper](examples/git-commit-helper/)** - Smart commit messages
- More examples coming soon!

## 🗺️ Roadmap

We're working towards a stable 1.0 release:

- ✅ Monorepo architecture with clean package boundaries
- ✅ SDK package for embedding AGI
- ✅ Multi-provider support (5+ providers)
- ✅ Web interface
- 🔄 Comprehensive test coverage (in progress)
- 🔄 Production deployments and user feedback
- 📋 API stability guarantees
- 📋 Long-term support commitment

**Target:** v1.0.0 in Q1 2026

## 🤝 Contributing

We welcome contributions! Please read [AGENTS.md](./AGENTS.md) for guidelines.

**Areas where help is needed:**
- 📝 Documentation improvements
- 🧪 Test coverage expansion
- 🔧 New built-in tools
- 🌐 Web UI enhancements
- 🐛 Bug fixes

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details

## 🔗 Links

- **Repository**: https://github.com/nitishxyz/agi
- **Issues**: https://github.com/nitishxyz/agi/issues
- **npm Package**: https://www.npmjs.com/package/@agi-cli/install
- **SDK Package**: https://www.npmjs.com/package/@agi-cli/sdk

---

**Built with ❤️ using Bun, Hono, and AI SDK**
