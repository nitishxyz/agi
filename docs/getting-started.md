# Getting Started

[← Back to README](../README.md) · [Docs Index](./index.md)

---

## Install

### Recommended: One-Liner

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

This detects your OS and architecture, downloads the prebuilt binary, and installs to `~/.local/bin`.

Pin a specific version:

```bash
AGI_VERSION=v0.1.161 curl -fsSL https://install.agi.nitish.sh | sh
```

### Alternative: npm or Bun

```bash
bun install -g @agi-cli/install
```

The postinstall script downloads the correct binary for your platform.

**Supported platforms:** macOS (x64, ARM64), Linux (x64, ARM64)

### From Source

Requires [Bun](https://bun.sh) v1.0+.

```bash
git clone https://github.com/nitishxyz/agi.git
cd agi
bun install
bun run compile    # builds to dist/agi
```

---

## Setup

### 1. Configure a Provider

```bash
agi setup
```

This walks you through provider selection and authentication interactively.

Or set API keys via environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."
```

### 2. Start Using AGI

```bash
agi                           # start server + web UI (opens browser)
agi "explain this error"      # one-shot question
agi "write tests" --agent build
agi "follow up" --last        # continue last session
```

### 3. Verify Installation

```bash
agi --version                 # check version
agi doctor                    # check configuration and diagnose issues
agi agents                    # list available agents
agi models                    # list available models
```

---

## How It Works

When you run `agi`, it:

1. Checks if the desktop app is installed — if so, opens it
2. Otherwise, starts a local HTTP server (API + web UI)
3. Opens the web UI in your browser

The web UI is a client for the local server. All AI interactions, session storage, and tool execution happen locally on your machine.

For one-shot usage (`agi "question"`), it starts the server in the background, sends the prompt, streams the response, and exits.

---

## Server Mode

```bash
agi serve                     # start on a random port, open browser
agi serve --port 3000         # specific port
agi serve --network           # bind to 0.0.0.0 for LAN access
agi serve --no-open           # don't open browser
```

The server exposes:
- **API** on the specified port (e.g., `http://localhost:3000`)
- **Web UI** on port + 1 (e.g., `http://localhost:3001`)

---

## Next Steps

- [Usage Guide](usage.md) — All commands and workflows
- [Configuration](configuration.md) — Project and global settings
- [Agents & Tools](agents-tools.md) — Built-in agents and tools
- [Troubleshooting](troubleshooting.md) — Common issues

---

## Troubleshooting

### `agi` not found after installation

Check if `~/.local/bin` is in your PATH:

```bash
echo $PATH | tr ':' '\n' | grep local

# If not present, add it:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Provider authentication issues

```bash
agi auth login                # reconfigure credentials
agi doctor                    # check what's configured
echo $ANTHROPIC_API_KEY       # verify env var is set
```

### Web UI not loading

```bash
curl http://localhost:3000/health    # check if server is running
agi serve --port 3000               # try a specific port
```

### Binary not executable

```bash
chmod +x $(which agi)
```

For more help, see [troubleshooting.md](troubleshooting.md) or file an issue at [github.com/nitishxyz/agi/issues](https://github.com/nitishxyz/agi/issues).
