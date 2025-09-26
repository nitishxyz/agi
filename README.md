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

## Install

Recommended via curl:

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

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

# Test
new line
# End
<!-- fin. -->
