# AGI CLI Documentation

[← Back to README](../README.md)

Welcome to the AGI CLI documentation. This index provides an overview of all available documentation.

## 📖 Table of Contents

### Getting Started
- **[Installation & Quick Start](getting-started.md)** - Install AGI and get running
- **[Usage Guide](usage.md)** - Core commands and workflows
- **[Configuration](configuration.md)** - Settings and project configuration

### Features & Usage
- **[Agents & Tools](agents-tools.md)** - Built-in agents and tools reference
- **[Customization](customization.md)** - Create custom commands and tools
- **[Environment](environment.md)** - Environment variables and flags
- **[API Reference](api.md)** - REST endpoints and SSE events

### Architecture & Development
- **[Architecture](architecture.md)** - Monorepo structure and design principles
- **[Development](development.md)** - Development workflow, structure, testing
- **[Publishing](publishing.md)** - Release workflow and version management
- **[Contributing](../AGENTS.md)** - Contribution guidelines for AI agents and humans

### Advanced Topics
- **[Embedding Guide](embedding-guide.md)** - Embed AGI in your applications
- **[AI SDK v5 Integration](ai-sdk-v5.md)** - How AGI uses AI SDK v5
- **[Streaming Architecture](streaming-overhaul.md)** - Real-time streaming implementation
- **[Tools & Artifacts](tools-and-artifacts.md)** - Tool system and artifact handling
- **[File Editing Solution](file-editing-solution.md)** - File editing capabilities

### Reference
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[License](license.md)** - MIT License information

## 🚀 Quick Reference

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
agi serve                    # Start HTTP server
agi agents                   # List agents
agi models                   # List models
agi sessions                 # List sessions
```

### Project Structure

```
agi/
├── apps/
│   ├── cli/          # Main CLI application
│   └── web/          # Web interface
├── packages/
│   ├── auth/         # Authentication
│   ├── config/       # Configuration
│   ├── database/     # SQLite + Drizzle
│   ├── install/      # npm installer
│   ├── prompts/      # System prompts
│   ├── providers/    # Provider catalog
│   ├── sdk/          # Core SDK
│   ├── server/       # HTTP server
│   └── web-ui/       # Web UI components
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

console.log(result.text);
```

**Full SDK documentation:** [../packages/sdk/README.md](../packages/sdk/README.md)

## 📚 Documentation by Topic

### For Users

Start here if you're using AGI CLI:

1. [Getting Started](getting-started.md) - Installation and first steps
2. [Usage Guide](usage.md) - Basic commands
3. [Configuration](configuration.md) - Customize your setup
4. [Agents & Tools](agents-tools.md) - What AGI can do
5. [Troubleshooting](troubleshooting.md) - When things go wrong

### For Developers

Start here if you're building with AGI SDK:

1. [SDK README](../packages/sdk/README.md) - SDK overview
2. [Embedding Guide](embedding-guide.md) - Embed AGI in your applications
3. [API Reference](api.md) - HTTP API documentation
4. [Architecture](architecture.md) - System design

### For Contributors

Start here if you're contributing to AGI:

1. [Contributing Guidelines](../AGENTS.md) - How to contribute
2. [Development](development.md) - Development workflow
3. [Architecture](architecture.md) - Codebase structure
4. [Publishing](publishing.md) - Release process

## 🔗 External Resources

- **GitHub Repository**: https://github.com/nitishxyz/agi
- **Issue Tracker**: https://github.com/nitishxyz/agi/issues
- **npm Package**: https://www.npmjs.com/package/@agi-cli/install
- **SDK Package**: https://www.npmjs.com/package/@agi-cli/sdk

## 📝 Documentation Standards

This documentation follows these principles:

- **Clarity**: Clear, concise language
- **Examples**: Code examples for all features
- **Completeness**: Cover all functionality
- **Accuracy**: Keep docs in sync with code
- **Organization**: Logical structure with cross-links

If you find errors or areas for improvement, please [contribute](../AGENTS.md)!

---

**Last updated**: Documentation restructured with modular organization
