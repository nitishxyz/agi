# Usage

[← Back to README](../README.md) • [Docs Index](./index.md)

## Core Commands

### Session Management

```bash
agi sessions              # Interactive session picker (default)
agi sessions --list       # List all sessions
agi sessions --json       # Output sessions as JSON
agi sessions --limit 10   # Limit number of sessions shown
```

### Provider & Model Configuration

```bash
agi models               # Interactive provider/model selection
agi switch               # Alias for models command
agi auth login           # Configure provider credentials
agi auth list            # List configured providers
agi auth logout          # Remove provider credentials
```

### Agent & Tool Management

```bash
agi agents               # List and configure agents interactively
agi agents --local       # Edit local project agents
agi tools                # List available tools and agent access
agi scaffold             # Generate new agents, tools, or commands
```

### Diagnostics

```bash
agi doctor               # Check configuration and diagnose issues
agi --version            # Show version
agi --help               # Show help with discovered commands
```

## Server Mode

```bash
agi serve                  # Start HTTP server on random port
agi serve --port 3000      # Start on specific port
agi serve --network        # Start with network access (0.0.0.0)
agi serve --port 3000 --network  # Combine port and network flags
```
