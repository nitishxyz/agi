# Getting Started

[← Back to README](../README.md) • [Docs Index](./index.md)

## Installation

### Using curl (recommended)

```bash
curl -fsSL https://install.agi.nitish.sh | sh
```

- Installs the correct prebuilt binary for your OS/arch.
- Uses `/usr/local/bin` when writable; otherwise falls back to `$HOME/.local/bin`.
- If needed, add the chosen directory to your `PATH`.

Pin a specific version:

```bash
AGI_VERSION=v0.1.9 curl -fsSL https://install.agi.nitish.sh | sh
```

### Via Bun (global package)

```bash
bun pm -g trust @agi-cli/core   # allow postinstall to fetch the binary
bun install -g @agi-cli/core
```

After install, the first `agi` run will download the matching binary if it’s missing.

### From Source

> Note: This project uses Bun as its runtime. Install Bun first from https://bun.sh

```bash
# Clone the repository
git clone https://github.com/nitishxyz/agi.git
cd agi

# Install dependencies with Bun
bun install

# Build the CLI binary
bun run build

# Optional: Link globally for system-wide access
bun link
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
agi "refactor this function" --provider anthropic --model claude-3-opus
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
