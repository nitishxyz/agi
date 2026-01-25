# Getting Started

[← Back to README](../README.md) • [Docs Index](./index.md)

---

## Installation

### 🎯 Recommended: One-Liner Install

The fastest way to get started:

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

**What this does:**
- ✅ Detects your OS and architecture automatically
- ✅ Downloads the correct prebuilt binary
- ✅ Installs to `/usr/local/bin` (or `$HOME/.local/bin` as fallback)
- ✅ Makes `agi` available globally

**Pin a specific version:**

```bash
AGI_VERSION=v0.1.135 curl -fsSL https://install.agi.nitish.sh | sh
```

### 📦 Alternative: npm or Bun

Install via package managers:

```bash
# Using npm
npm install -g @agi-cli/install

# Using Bun
bun install -g @agi-cli/install
```

**Supported platforms:**
- macOS (x64, ARM64/Apple Silicon)
- Linux (x64, ARM64)
- Windows (x64)

---

### 🛠️ From Source (For Developers)

> Note: This project uses Bun as its runtime. Install Bun first from https://bun.sh

```bash
# Clone the repository
git clone https://github.com/nitishxyz/agi.git
cd agi

# Install dependencies with Bun
bun install

# Build the CLI binary
cd apps/cli
bun run build

# The binary will be at apps/cli/dist/agi
# Optional: Add to PATH or link globally
```

Optional: Pretty-print markdown output when running from source

```bash
./agi-markdown "<prompt>"
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
agi "refactor this function" --provider anthropic --model claude-sonnet-4
```

## Output & Rendering

AGI provides two output modes for assistant responses:

### Streaming Mode (Default)
- Real-time output as text is generated
- See immediate feedback that the assistant is working
- Plain text without markdown formatting
- Best for interactive use and seeing progress

### Markdown Mode
- Enable with `AGI_RENDER_MARKDOWN=1` or use `./agi-markdown` wrapper
- Buffered output appears all at once after completion
- Rich formatting: headers, bold, italic, lists, code blocks
- Best for documentation, final outputs, pretty results

### Other Options
- JSON output: `--json` for structured result, `--json-stream` for streaming
- Bash output: Limited to 7 lines (use `--json` for full output)
- Plans: Show `[ ]` pending, `[x]` complete, `...` in progress

## Verifying Installation

After installation, verify AGI is working:

```bash
# Check version
agi --version

# Test basic functionality
agi "hello, can you hear me?"

# Check available agents
agi agents

# View available models
agi models
```

## Next Steps

- **Configuration**: See [configuration.md](./configuration.md) for detailed config options
- **Usage**: See [usage.md](./usage.md) for command examples
- **Agents & Tools**: See [agents-tools.md](./agents-tools.md) for built-in capabilities
- **Customization**: See [customization.md](./customization.md) for custom commands and tools
- **SDK**: See [../packages/sdk/README.md](../packages/sdk/README.md) for embedding AGI in your projects

## Troubleshooting

### Command not found after installation

If `agi` is not found after installation:

1. **Check installation location** (curl method):
   - Look for messages during installation about where the binary was placed
   - Common locations: `/usr/local/bin/agi` or `~/.local/bin/agi`

2. **Add to PATH** if needed:
   ```bash
   # For ~/.local/bin
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **For npm/bun install issues**:
   ```bash
   # Check if package was installed
   npm list -g @agi-cli/install
   
   # Reinstall if needed
   npm uninstall -g @agi-cli/install
   npm install -g @agi-cli/install
   ```

### Binary not executable

If you get a permission error:

```bash
chmod +x $(which agi)
# or
chmod +x /path/to/agi
```

### Other issues

See [troubleshooting.md](./troubleshooting.md) for more help, or file an issue at:
https://github.com/nitishxyz/agi/issues
# Run from source
bun run cli "hello"
# Build binary for your platform
bun run compile
# Output: dist/agi

# Or build for specific platforms
bun run build:bin:darwin-arm64
bun run build:bin:linux-x64
**Pretty-print markdown output:**

---
### 1️⃣ Configure Your AI Provider

Set up authentication interactively:
**Set API keys via environment variables:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."
```

### 2️⃣ Start Using AGI
# 💬 Ask a question
# 🔄 Interactive mode
# 🔨 Use specialized agents
agi "design a scalable API" --agent plan
agi "review my changes" --agent git
# 💾 Continue last conversation
# 🎯 Choose provider and model
agi "refactor this function" \\
  --provider anthropic \\
  --model claude-3-5-sonnet-20241022

# 🌐 Start web interface
agi serve
# Open http://127.0.0.1:3456
---

---

# ✅ Check version
# ✅ Test basic functionality
# ✅ List available agents
# ✅ View available models

# ✅ Check current configuration
agi doctor
---

Ready to dive deeper? Check out these guides:

- **Web UI**: See [mobile-support.md](./mobile-support.md) for web interface guide

---
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
   
   # For macOS zsh
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
### Provider authentication issues

```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY

# Reconfigure authentication
agi auth login

# Or use the setup wizard
agi setup
```

### Web UI not loading

```bash
# Check if server is running
curl http://127.0.0.1:3456/health

# Try different port
agi serve --port 3000

# Enable network access
agi serve --network
```


---

<p align="center">
  <strong>Ready to start? Run <code>agi setup</code> to begin! 🚀</strong>
</p>
