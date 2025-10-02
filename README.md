# AGI CLI

A powerful AI-powered development assistant CLI that brings intelligent agents and tools directly to your terminal. Build, plan, and execute development tasks with AI assistance from multiple providers.

## Quick Links

- Getting Started — docs/getting-started.md
- Usage — docs/usage.md
- Configuration — docs/configuration.md
- Agents & Tools — docs/agents-tools.md
- Customization — docs/customization.md
- Environment — docs/environment.md
- API — docs/api.md
- Development — docs/development.md
- Contributing — docs/contributing.md
- Troubleshooting — docs/troubleshooting.md
- Docs Index — docs/index.md
- **🏗️ Architecture** — [ARCHITECTURE.md](./ARCHITECTURE.md)
- **📦 Publishing** — [PUBLISHING.md](./PUBLISHING.md)

## Features

- Multi-Provider Support: OpenAI, Anthropic, and Google AI
- Specialized Agents: general, build, plan, git
- Extensible Tools: file ops, git, bash, and more
- Rich Markdown Output: pretty terminal rendering option
- Session Management: local SQLite persistence
- Project-Aware: per-project `.agi` configuration
- Real-time Streaming: SSE live responses
- Custom Commands: per-project commands, prompts, agents
- Server Mode: HTTP server for integration
- Fast Runtime: powered by Bun with TypeScript
- **Embeddable SDK**: use AGI agents in your own projects

## Install

### Recommended: npm/bun (global install)

```bash
npm install -g @agi-cli/install
# or
bun install -g @agi-cli/install
```

This will automatically download and install the platform-specific AGI binary.

### Alternative: Direct binary install

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

### Other installation options

From source and more options: see docs/getting-started.md

## Quick Start

```bash
agi setup               # configure provider credentials
agi "hello"              # ask a question
agi agents              # explore built-in agents
```

More examples: see docs/usage.md

## Documentation

All docs live under `docs/`. Start here: docs/index.md

- API reference: docs/api.md
- Configuration reference: docs/configuration.md
- Development workflow: docs/development.md
- Architecture: ARCHITECTURE.md

## Monorepo Architecture ✅

AGI CLI has been successfully refactored into a **modular monorepo** structure:

### For Users
- 📦 **Multiple installation options**: npm, curl, or from source
- 🚀 **Faster releases**: automated CI/CD with version synchronization
- 🔧 **Better reliability**: clean package boundaries and explicit dependencies

### For Developers
- 📦 **Standalone SDK**: `npm install @agi-cli/sdk` - use AGI agents in any Node.js/Bun/Deno project
- 🔧 **Embed AI agents**: create custom tools and agents for your own applications
- 🛠️ **High-level API**: all the power without implementation complexity
- 🏗️ **Clean architecture**: clear package boundaries and dependencies
- 🧪 **Easier testing**: isolated packages with defined interfaces
- 📈 **Extensible**: add new packages or extend existing ones

### Monorepo Structure

```
agi/
├── apps/
│   ├── cli/                    # Main CLI application
│   └── install/                # npm installer package
├── packages/
│   ├── auth/                   # Authentication & credentials
│   ├── config/                 # Configuration system
│   ├── database/               # SQLite + Drizzle ORM
│   ├── prompts/                # System prompts
│   ├── providers/              # AI provider catalog
│   ├── sdk/                    # Core SDK (tools, streaming, agents)
│   └── server/                 # HTTP server (Hono-based)
└── scripts/                    # Build and release scripts
```

**Read more**: [ARCHITECTURE.md](./ARCHITECTURE.md) | [PUBLISHING.md](./PUBLISHING.md)

## SDK Usage

Build AI agents in your own projects:

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

const model = await resolveModel('anthropic', 'claude-sonnet-4');
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: 'List all TypeScript files and count total lines',
  tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
  maxSteps: 10
});

console.log(result.text);
```

**See full SDK documentation**: [packages/sdk/README.md](./packages/sdk/README.md)

## Recent Updates

### v0.1.29 (Latest)
- ✨ **New npm installer package** (`@agi-cli/install`) - easier global installation
- 🔧 Improved CI/CD with automated version synchronization
- 📦 Streamlined publishing workflow

### v0.1.27-0.1.28
- 🏗️ **Monorepo migration complete** - clean package structure
- 📦 **SDK package released** - embed AGI in your projects
- 🔄 Migrated from path aliases to package.json exports
- ⚡ Consolidated dependencies for better maintainability

## Contributing

Please read AGENTS.md for contributor conventions. See docs/contributing.md for a quick summary.

## License

MIT License — see LICENSE for details

## Support

- Issues: https://github.com/nitishxyz/agi/issues
- Docs: docs/
- Author: nitishxyz
- Homepage: https://github.com/nitishxyz/agi

---

Built with ❤️ using Bun, Hono, and AI SDK


## Web App Development

To run the web interface:

1. Start the AGI server (in one terminal):
   ```bash
   NODE_ENV=development agi serve
   ```

2. Start the web app (in another terminal):
   ```bash
   cd apps/web
   bun dev
   ```

3. Open http://localhost:5173 in your browser

The web app connects to the AGI server at http://localhost:9100 by default.
