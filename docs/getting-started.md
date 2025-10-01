# Getting Started

[← Back to README](../README.md) • [Docs Index](./index.md)

## Installation

### Recommended: npm or bun (global install)

The easiest way to install AGI is via npm or bun:

```bash
npm install -g @agi-cli/install
# or
bun install -g @agi-cli/install
```

This will automatically:
- Download the correct prebuilt binary for your OS and architecture
- Install it to your system PATH
- Make the `agi` command available globally

**Supported platforms:**
- macOS (x64, ARM64/Apple Silicon)
- Linux (x64, ARM64)
- Windows (x64)

### Alternative: Direct binary install via curl

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

- Installs the correct prebuilt binary for your OS/arch.
- Uses `/usr/local/bin` when writable; otherwise falls back to `$HOME/.local/bin`.
- If needed, add the chosen directory to your `PATH`.

Pin a specific version:

```bash
AGI_VERSION=v0.1.29 curl -fsSL https://install.agi.nitish.sh | sh
```

### From Source

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
