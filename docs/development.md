# Development

[← Back to README](../README.md) • [Docs Index](./index.md)

## Prerequisites

- Bun runtime v1.0+
- Node.js 18+ (for npm package compatibility)
- SQLite3 (included with most systems)

## Project Structure

```
agi/
├── src/
│   ├── ai/              # AI agents, tools, and provider logic
│   │   ├── agents/      # Agent registry and defaults
│   │   ├── tools/       # Built-in tool implementations
│   │   └── types.ts     # TypeScript interfaces
│   ├── cli/             # CLI commands and interface
│   ├── config/          # Configuration management
│   ├── db/              # Database schemas and migrations
│   │   └── schema/      # Drizzle ORM schemas
│   ├── providers/       # AI provider integrations
│   ├── runtime/         # Runtime assets and utilities
│   └── server/          # HTTP server and API routes
├── tests/               # Test suites
├── scripts/             # Build and utility scripts
├── drizzle/             # Database migrations
├── docs/                # Additional documentation
└── AGENTS.md            # Contributor conventions
```

## Development Workflow

```bash
# Install dependencies
bun install

# Run the CLI locally
bun run cli "<prompt>"

# Run linter (Biome)
bun lint

# Run tests
bun test

# Generate database migrations
bun run db:generate

# Reset database (development)
bun run db:reset

# Update provider catalog
bun run catalog:update

# Build standalone binary
bun run build

# Cross-compile for other platforms
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test agents.test.ts

# Run tests matching pattern
bun test --pattern "config"
```

## Database Management

The project uses SQLite with Drizzle ORM for data persistence:

- Sessions: Conversation sessions with metadata
- Messages: Individual messages in conversations
- Message Parts: Structured content (text, tool calls, results)
- Artifacts: Large outputs stored separately

Migrations are automatically applied on startup. To reset:

```bash
bun run scripts/reset-db.ts
```
