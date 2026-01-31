# Development

[← Back to README](../README.md) · [Docs Index](./index.md)

For the full development guide covering all components, see [Development Guide](development-guide.md).

## Prerequisites

- [Bun](https://bun.sh) v1.0+

## Quick Start

```bash
git clone https://github.com/nitishxyz/agi.git
cd agi
bun install
```

## Commands

```bash
bun run cli ask "hello"        # run CLI from source
bun test                       # run all tests
bun lint                       # lint (Biome)
bun run typecheck              # type check all packages
bun run compile                # build standalone binary
```

## Dev Servers

```bash
bun run dev:cli                # CLI dev mode
bun run dev:web                # Web UI (Vite dev server on :5173)
bun run dev:desktop            # Desktop app (Tauri)
bun sst dev                    # SST dev (setu, preview-api, preview-web)
```

## Testing

```bash
bun test                       # all tests
bun test tests/agents.test.ts  # specific file
bun test --pattern "config"    # pattern match
bun test --watch               # watch mode
```

Tests use `bun:test` and live in `tests/`.

## Database

```bash
bun run db:generate            # generate Drizzle migrations
bun run db:reset               # reset local database
```

See [Development Guide](development-guide.md) for schema change workflow.

## Build

```bash
bun run compile                        # build for current platform
bun run build:bin:darwin-arm64         # macOS ARM64
bun run build:bin:darwin-x64           # macOS x64
bun run build:bin:linux-x64            # Linux x64
bun run build:bin:linux-arm64          # Linux ARM64
```

## Other

```bash
bun run catalog:update         # update provider model catalog
bun run version:bump           # bump version across all packages
bun lint --write               # auto-fix lint issues
```
