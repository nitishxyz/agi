# Development Guide

[← Back to README](../README.md) • [Docs Index](./index.md)

This guide covers development workflows for all components of the ottocode project: **Server**, **CLI**, **Web SDK**, and **Web App**.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Project Overview](#project-overview)
4. [Development Workflows](#development-workflows)
   - [Server Development](#server-development)
   - [CLI Development](#cli-development)
   - [Web SDK Development](#web-sdk-development)
   - [Web App Development](#web-app-development)
5. [Testing](#testing)
6. [Building](#building)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Bun** v1.0+ (primary runtime and package manager)
- **Node.js** 18+ (for npm compatibility)
- **SQLite3** (included with most systems)
- **Git** (version control)

### Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

## Getting Started

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/nitishxyz/otto.git
cd otto

# Install all dependencies (uses Bun workspaces)
bun install
```

This installs dependencies for all packages and applications in the monorepo.

### 2. Verify Setup

```bash
# Run linter
bun lint

# Run type checking
bun run typecheck

# Run tests
bun test
```

## Project Overview

The ottocode is organized as a **Bun workspace monorepo**:

```
otto/
├── apps/
│   ├── cli/              # CLI application (main binary)
│   └── web/              # Web interface (React + Vite)
├── packages/
│   ├── api/              # Type-safe API client
│   ├── database/         # SQLite + Drizzle ORM
│   ├── install/          # npm installer package
│   ├── sdk/              # Core SDK
│   ├── server/           # HTTP server (Hono)
│   ├── web-sdk/           # React hooks/components
│   └── web-ui/           # Web UI components (pre-built)
└── docs/                 # Documentation
```

**Key Points:**

- **Monorepo**: All packages share a single `node_modules` via Bun workspaces
- **Workspace Protocol**: Packages reference each other via `workspace:*`
- **TypeScript**: All code is TypeScript with strict mode enabled
- **No Build Step**: Most packages use `.ts` files directly (except web)

## Development Workflows

### Server Development

The server package (`@ottocode/server`) provides an HTTP API for ottocode.

#### Running the Server

```bash
# From workspace root
bun run dev:server

# Or from packages/server
cd packages/server
bun run dev
```

The server will start on `http://localhost:9100` by default.

#### Server Structure

```
packages/server/
├── src/
│   ├── routes/          # API route handlers
│   │   ├── ask.ts       # /api/ask endpoint
│   │   ├── sessions.ts  # Session management
│   │   ├── models.ts    # Model listing
│   │   └── ...
│   ├── runtime/         # Runtime services
│   │   ├── ask-service.ts
│   │   └── agent-registry.ts
│   ├── events/          # Event system
│   └── index.ts         # Server factory
└── package.json
```

#### Key Files

- **`src/index.ts`**: Main server factory (`createServer`, `createApp`)
- **`src/routes/ask.ts`**: Core `/api/ask` endpoint with SSE streaming
- **`src/runtime/ask-service.ts`**: Business logic for AI interactions

#### Making Changes

1. **Add a new route:**

```typescript
// packages/server/src/routes/my-feature.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/my-feature', async (c) => {
  return c.json({ message: 'Hello from my feature!' });
});

export default app;
```

2. **Register the route:**

```typescript
// packages/server/src/index.ts
import myFeature from './routes/my-feature';

app.route('/api', myFeature);
```

3. **Test the endpoint:**

```bash
curl http://localhost:9100/api/my-feature
```

#### Hot Reload

The server uses `bun run dev` which automatically reloads on file changes.

---

### CLI Development

The CLI application (`@ottocode/cli`) is the main user-facing interface.

#### Running the CLI

```bash
# From workspace root
bun run cli ask "your prompt here"

# Or from apps/cli
cd apps/cli
bun run dev ask "your prompt"
```

#### CLI Structure

```
apps/cli/
├── src/
│   ├── ask/             # Ask mode implementation
│   ├── commands/        # CLI commands
│   │   ├── setup.ts
│   │   ├── serve.ts
│   │   ├── sessions.ts
│   │   └── ...
│   ├── ui/              # Terminal UI components
│   └── index.ts         # CLI entry point
├── index.ts             # Main entry (imports src/index.ts)
└── package.json
```

#### Key Commands

- **`otto setup`**: Configure providers and credentials
- **`otto serve`**: Start HTTP server with web UI
- **`otto agents`**: List available agents
- **`otto models`**: List available models
- **`otto sessions`**: Manage conversation sessions

#### Making Changes

1. **Add a new command:**

```typescript
// apps/cli/src/commands/my-command.ts
import { intro, outro } from '@clack/prompts';

export async function myCommand() {
  intro('My Command');
  
  // Your logic here
  
  outro('Done!');
}
```

2. **Register the command:**

```typescript
// apps/cli/src/index.ts
import { myCommand } from './commands/my-command';

if (args.includes('my-command')) {
  await myCommand();
  process.exit(0);
}
```

3. **Test the command:**

```bash
bun run cli run my-command
```

#### Building the Binary

```bash
# Build for your platform
cd apps/cli
bun run build

# Output: apps/cli/dist/otto (self-contained binary)
```

The binary includes:
- All dependencies bundled
- Bun runtime embedded
- ~61MB total size

---

### Web SDK Development

The web SDK (`@ottocode/web-sdk`) provides React hooks and components for building web UIs.

#### Running Development

The web SDK is used by the web app, so develop it in context:

```bash
# Start the web app (which uses web-sdk)
bun run dev:web
```

#### Web SDK Structure

```
packages/web-sdk/
├── src/
│   ├── components/      # React components
│   │   ├── Chat.tsx
│   │   ├── SessionList.tsx
│   │   └── ...
│   ├── hooks/           # React hooks
│   │   ├── useChat.ts
│   │   ├── useSessions.ts
│   │   └── ...
│   ├── lib/             # Utilities
│   │   ├── api.ts       # API client
│   │   └── ...
│   └── index.ts         # Exports
└── package.json
```

#### Key Hooks

- **`useChat()`**: Real-time chat with SSE streaming
- **`useSessions()`**: Session management
- **`useModels()`**: Available models
- **`useAgents()`**: Available agents

#### Making Changes

1. **Add a new hook:**

```typescript
// packages/web-sdk/src/hooks/useMyFeature.ts
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useMyFeature() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    api.get('/my-feature').then(setData);
  }, []);
  
  return data;
}
```

2. **Export the hook:**

```typescript
// packages/web-sdk/src/index.ts
export { useMyFeature } from './hooks/useMyFeature';
```

3. **Use in web app:**

```tsx
// apps/web/src/App.tsx
import { useMyFeature } from '@ottocode/web-sdk';

function App() {
  const data = useMyFeature();
  return <div>{JSON.stringify(data)}</div>;
}
```

---

### Web App Development

The web app (`apps/web`) is a React + Vite application that provides the browser UI.

#### Running the Web App

**Option 1: Standalone Development Server**

```bash
# From workspace root
bun run dev:web

# Or from apps/web
cd apps/web
bun run dev
```

This starts Vite dev server on `http://localhost:5173` with hot reload.

**Option 2: Full Stack (Server + Web UI)**

```bash
# Start the CLI server (serves both API and web UI)
cd apps/cli
bun run dev serve
```

This starts both the API server and serves the web UI on `http://localhost:9100`.

#### Web App Structure

```
apps/web/
├── src/
│   ├── components/      # React components
│   │   ├── ChatInterface.tsx
│   │   ├── SessionSidebar.tsx
│   │   └── ...
│   ├── assets/          # Static assets
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Public assets
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS config
└── package.json
```

#### Key Technologies

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **TailwindCSS**: Utility-first CSS
- **TypeScript**: Type safety
- **@ottocode/web-sdk**: API integration

#### Making Changes

1. **Add a new component:**

```tsx
// apps/web/src/components/MyFeature.tsx
export function MyFeature() {
  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2 className="text-xl font-bold">My Feature</h2>
      <p>Feature content here</p>
    </div>
  );
}
```

2. **Use in App:**

```tsx
// apps/web/src/App.tsx
import { MyFeature } from './components/MyFeature';

function App() {
  return (
    <div>
      <MyFeature />
    </div>
  );
}
```

3. **Hot reload**: Changes appear instantly in browser

#### Building for Production

```bash
# Build the web app
cd apps/web
bun run build

# Output: apps/web/dist/ (static files)
```

The build is automatically copied to `packages/web-ui/dist/web-assets/` for embedding.

#### Web UI Package

The `@ottocode/web-ui` package contains the **pre-built** web app for embedding:

```bash
# Build web app and copy to web-ui package
bun run scripts/build-web.ts
```

This is run automatically before building the CLI binary.

---

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/agents.test.ts

# Run tests matching pattern
bun test --pattern "config"

# Watch mode (re-run on changes)
bun test --watch
```

### Test Structure

```
tests/
├── agents.test.ts
├── ask-route.test.ts
├── builtin-tools.test.ts
├── config.test.ts
└── ...
```

### Writing Tests

```typescript
// tests/my-feature.test.ts
import { describe, test, expect } from 'bun:test';
import { myFunction } from '../packages/sdk/src/my-feature';

describe('MyFeature', () => {
  test('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

---

## Building

### Build Everything

```bash
# Build all packages and apps
bun run build:all

# Build only packages
bun run build:packages

# Build only apps
bun run build:apps
```

### Build CLI Binary

```bash
# Build for your platform
bun run build

# Cross-compile for other platforms
bun run build:bin:darwin-arm64   # macOS ARM64
bun run build:bin:darwin-x64     # macOS x64
bun run build:bin:linux-x64      # Linux x64
bun run build:bin:linux-arm64    # Linux ARM64
```

Binaries are output to `dist/` directory.

### Build Web App

```bash
# Build web app and copy to web-ui package
bun run scripts/build-web.ts
```

---

## Common Tasks

### Database Tasks

```bash
# Generate migrations (after schema changes)
bun run db:generate

# Reset database (development only!)
bun run db:reset
```

#### Making Schema Changes

1. **Edit schema:**

```typescript
// packages/database/src/schema/my-table.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable('my_table', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});
```

2. **Export schema:**

```typescript
// packages/database/src/schema/index.ts
export * from './my-table';
```

3. **Generate migration:**

```bash
bunx drizzle-kit generate
```

4. **Update migrations bundle:**

```typescript
// packages/database/src/migrations-bundled.ts
import migration4 from '../drizzle/0004_my_migration.sql';

export const migrations = [
  // ... existing migrations
  { id: 4, sql: migration4 },
];
```

### Update Provider Catalog

```bash
# Fetch latest models from providers
bun run catalog:update
```

### Version Bumping

```bash
# Bump version across all packages
bun run version:bump
```

### Linting and Formatting

```bash
# Check code quality
bun lint

# Auto-fix issues
bun lint --write
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Server won't start (port 9100 in use)
Error: listen EADDRINUSE: address already in use :::9100

# Solution: Kill the process
lsof -ti:9100 | xargs kill -9
```

#### Database Lock Error

```bash
# Database is locked
Error: database is locked

# Solution: Reset the database
bun run db:reset
```

#### Module Not Found

```bash
# Cannot find module '@ottocode/sdk'
Error: Cannot find module '@ottocode/sdk'

# Solution: Reinstall dependencies
rm -rf node_modules
bun install
```

#### Build Failures

```bash
# Binary build fails
Error: failed to compile

# Solution: Clear cache and rebuild
rm -rf apps/cli/dist
bun run build
```

### Development Tips

1. **Use workspace scripts**: Run scripts from root with `bun run`
2. **Hot reload**: Most packages support hot reload in dev mode
3. **Type checking**: Run `bun run typecheck` frequently
4. **Test early**: Write tests as you develop features
5. **Follow AGENTS.md**: Read [AGENTS.md](../AGENTS.md) for conventions

### Getting Help

- **Documentation**: Check [docs/](./index.md) for guides
- **Architecture**: See [architecture.md](./architecture.md) for system design
- **Issues**: Search [GitHub issues](https://github.com/nitishxyz/otto/issues)
- **Contributing**: Read [AGENTS.md](../AGENTS.md) for guidelines

---

## Development Checklist

When working on features:

- [ ] Read [AGENTS.md](../AGENTS.md) for conventions
- [ ] Create feature branch from `main`
- [ ] Write code following existing patterns
- [ ] Add tests for new functionality
- [ ] Run `bun lint` and fix issues
- [ ] Run `bun run typecheck` and fix errors
- [ ] Run `bun test` and ensure all pass
- [ ] Test manually (CLI, server, web UI)
- [ ] Update documentation if needed
- [ ] Commit with conventional commit message
- [ ] Create pull request

---

## Quick Reference

### Workspace Scripts

| Script | Description |
|--------|-------------|
| `bun lint` | Run Biome linter |
| `bun run typecheck` | Type check all packages |
| `bun test` | Run all tests |
| `bun run cli` | Run CLI in dev mode |
| `bun run dev:server` | Start server in dev mode |
| `bun run dev:web` | Start web app in dev mode |
| `bun run build` | Build CLI binary |
| `bun run db:generate` | Generate DB migrations |
| `bun run db:reset` | Reset database |

### Package-Specific Scripts

| Package | Script | Description |
|---------|--------|-------------|
| `apps/cli` | `bun run dev` | Run CLI directly |
| `apps/cli` | `bun run build` | Build binary |
| `apps/web` | `bun run dev` | Vite dev server |
| `apps/web` | `bun run build` | Build static files |
| `packages/server` | `bun run dev` | Run server |

### Ports

- **CLI Server**: `9100` (default)
- **Web Dev Server**: `5173` (Vite default)
- **Custom**: Set via `--port` flag

---

**Happy Coding! 🚀**
