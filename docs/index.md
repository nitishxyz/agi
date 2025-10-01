# AGI CLI Docs

[← Back to README](../README.md)

Welcome to the AGI CLI documentation. Use the sections below to get started, configure your project, and dive deeper into agents, tools, and the API.

## Guides

- Getting Started: installation, quick start, rendering — see [getting-started.md](./getting-started.md)
- Usage: core commands, server mode — see [usage.md](./usage.md)
- Configuration: `.agi` folder and files — see [configuration.md](./configuration.md)
- Agents & Tools: built-ins and capabilities — see [agents-tools.md](./agents-tools.md)
- Customization: custom commands and tools — see [customization.md](./customization.md)
- Environment: variables and flags — see [environment.md](./environment.md)
- API: REST endpoints and SSE events — see [api.md](./api.md)
- Development: structure, workflow, testing, DB — see [development.md](./development.md)
- Contributing: guidelines and commits — see [contributing.md](./contributing.md)
- Troubleshooting: common fixes — see [troubleshooting.md](./troubleshooting.md)
- License — see [license.md](./license.md)

## Architecture & Publishing

- **Architecture**: Monorepo structure and packages — see [../ARCHITECTURE.md](../ARCHITECTURE.md)
- **Publishing**: Release workflow and version management — see [../PUBLISHING.md](../PUBLISHING.md)
- **SDK**: Using AGI in your own projects — see [../packages/sdk/README.md](../packages/sdk/README.md)

## Deep Dives

- AI SDK v5 integration — see [ai-sdk-v5.md](./ai-sdk-v5.md)
- Streaming architecture — see [streaming-overhaul.md](./streaming-overhaul.md)
- Tools and artifacts — see [tools-and-artifacts.md](./tools-and-artifacts.md)
- AGI planning approach — see [agi-plan.md](./agi-plan.md)

## Quick Reference

### Installation

```bash
# Recommended: npm or bun
npm install -g @agi-cli/install

# Alternative: curl
curl -fsSL https://install.agi.nitish.sh | sh

# From source
git clone https://github.com/nitishxyz/agi.git
cd agi && bun install
cd apps/cli && bun run build
```

### Key Commands

```bash
agi setup                    # Configure providers
agi "your question"          # Ask a question
agi --agent build "task"     # Use specific agent
agi --last "follow up"       # Continue last session
agi server                   # Start HTTP server
agi agents                   # List agents
agi models                   # List models
agi sessions                 # List sessions
```

### Project Structure

```
agi/
├── apps/
│   ├── cli/          # Main CLI application
│   └── install/      # npm installer
├── packages/
│   ├── auth/         # Authentication
│   ├── config/       # Configuration
│   ├── database/     # SQLite + Drizzle
│   ├── prompts/      # System prompts
│   ├── providers/    # Provider catalog
│   ├── sdk/          # Core SDK
│   └── server/       # HTTP server
└── docs/             # Documentation
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

See [SDK README](../packages/sdk/README.md) for full documentation.
