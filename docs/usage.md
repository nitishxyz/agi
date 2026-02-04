# Usage

[← Back to README](../README.md) • [Docs Index](./index.md)

## Core Commands

### Session Management

```bash
otto sessions              # Interactive session picker (default)
otto sessions --list       # List all sessions
otto sessions --json       # Output sessions as JSON
otto sessions --limit 10   # Limit number of sessions shown
```

### Provider & Model Configuration

```bash
otto models               # Interactive provider/model selection
otto switch               # Alias for models command
otto auth login           # Configure provider credentials
otto auth list            # List configured providers
otto auth logout          # Remove provider credentials
```

### Agent & Tool Management

```bash
otto agents               # List and configure agents interactively
otto agents --local       # Edit local project agents
otto tools                # List available tools and agent access
otto scaffold             # Generate new agents, tools, or commands
```

### Diagnostics

```bash
otto doctor               # Check configuration and diagnose issues
otto --version            # Show version
otto --help               # Show help with discovered commands
```

## Server Mode

```bash
otto serve                  # Start HTTP server on random port
otto serve --port 3000      # Start on specific port
otto serve --network        # Start with network access (0.0.0.0)
otto serve --port 3000 --network  # Combine port and network flags
```
