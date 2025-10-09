# AGI CLI Packages

The AGI CLI monorepo contains several packages that can be used independently or together to build AI-powered applications.

## Core Packages

### @agi-cli/sdk

The core SDK for building AI agents and tools.

- **Location**: `packages/sdk`
- **Purpose**: Core SDK with agent system, tool framework, and AI provider integration
- **Key Features**:
  - AI provider abstraction (Anthropic, OpenAI, Google, etc.)
  - Built-in tools (file system, bash, git, etc.)
  - Streaming support
  - Tool result artifacts
- **Install**: `npm install @agi-cli/sdk`
- **Docs**: [packages/sdk/README.md](../packages/sdk/README.md)

### @agi-cli/server

HTTP API server for AGI CLI with SSE streaming.

- **Location**: `packages/server`
- **Purpose**: RESTful API server for AGI CLI functionality
- **Key Features**:
  - Session management
  - Message handling
  - Server-Sent Events (SSE) streaming
  - OpenAPI spec
- **Install**: `npm install @agi-cli/server`
- **Docs**: [API Documentation](./api.md)

### @agi-cli/database

Database layer using Drizzle ORM.

- **Location**: `packages/database`
- **Purpose**: Database schema and operations for sessions and messages
- **Key Features**:
  - SQLite with Drizzle ORM
  - Session persistence
  - Message history
  - Token usage tracking
- **Install**: `npm install @agi-cli/database`

---

## New Packages 🎉

### @agi-cli/api

**Type-safe API client for AGI CLI server** (auto-generated from OpenAPI spec)

- **Location**: `packages/api`
- **Purpose**: Type-safe API client for consuming the AGI server
- **Key Features**:
  - ✅ Fully typed - generated from OpenAPI spec
  - ✅ SSE streaming support
  - ✅ Simple, intuitive API
  - ✅ Configurable (base URL, headers, custom fetch)
- **Install**: `npm install @agi-cli/api`
- **Docs**: [packages/api/README.md](../packages/api/README.md)

**Example:**

```typescript
import { createApiClient, createSSEStream } from '@agi-cli/api';

// Create API client
const api = createApiClient({
  baseUrl: 'http://localhost:9100'
});

// Make type-safe API calls
const sessions = await api.sessions.list();
const session = await api.sessions.create({
  agent: 'code',
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022'
});

// Stream events
await createSSEStream({
  baseUrl: 'http://localhost:9100',
  sessionId: session.id,
  onEvent: (event) => {
    console.log(event.event, event.data);
  }
});
```

### @agi-cli/web-ui

**Embeddable web UI with React components and hooks**

- **Location**: `packages/web-ui`
- **Purpose**: Embeddable web UI + reusable React components
- **Key Features**:
  - ✅ Pre-built web UI (embedded static assets)
  - ✅ Reusable React components
  - ✅ React hooks for AGI server integration
  - ✅ Tailwind CSS styling
  - ✅ Dark mode support
- **Install**: `npm install @agi-cli/web-ui`
- **Docs**: [packages/web-ui/README.md](../packages/web-ui/README.md)

**Three ways to use:**

**1. Serve the embedded web UI:**

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  fetch: serveWebUI({ prefix: '/ui' })
});
```

**2. Use React components:**

```typescript
import { Button, Card, ChatInput } from '@agi-cli/web-ui/components';

function MyUI() {
  return (
    <Card>
      <ChatInput onSubmit={handleSend} />
      <Button variant="primary">Send</Button>
    </Card>
  );
}
```

**3. Use React hooks:**

```typescript
import { useSessions, useMessages, useSessionStream } from '@agi-cli/web-ui/hooks';

function ChatApp() {
  const { sessions } = useSessions();
  const { messages } = useMessages(sessionId);
  const { events, connected } = useSessionStream(sessionId);
  
  // Build your custom UI...
}
```

---

## Supporting Packages

### @agi-cli/install

Global installer for the AGI CLI.

- **Location**: `packages/install`
- **Purpose**: Bootstrap script for installing AGI CLI
- **Install**: `npm install -g @agi-cli/install`

---

## Apps

### CLI App

The main command-line interface.

- **Location**: `apps/cli`
- **Purpose**: Interactive CLI for AGI
- **Run**: `bun run cli`

### Web App

Full-featured web interface (source for `@agi-cli/web-ui`).

- **Location**: `apps/web`
- **Purpose**: React-based web UI
- **Run**: `bun run --filter web dev`

---

## Package Dependencies

```
@agi-cli/cli
  ├── @agi-cli/sdk
  ├── @agi-cli/server
  └── @agi-cli/web-ui

@agi-cli/server
  ├── @agi-cli/sdk
  └── @agi-cli/database

@agi-cli/web-ui
  └── @agi-cli/api (new!)

@agi-cli/api (new!)
  └── (no dependencies - standalone)
```

---

## When to Use Which Package

| Use Case | Package | Notes |
|----------|---------|-------|
| Build CLI tools | `@agi-cli/sdk` | Core SDK for AI agents |
| Build HTTP APIs | `@agi-cli/server` | RESTful API with SSE |
| Call AGI API | `@agi-cli/api` | Type-safe client |
| Embed web UI | `@agi-cli/web-ui` | Serve pre-built UI |
| Build custom UIs | `@agi-cli/web-ui/components` | React components |
| Integrate with React | `@agi-cli/web-ui/hooks` | React hooks |

---

## Examples

See the [examples](../examples) directory for complete working examples:

- **[basic-cli-bot](../examples/basic-cli-bot)** - Simple CLI bot using SDK
- **[git-commit-helper](../examples/git-commit-helper)** - AI commit messages
- **[api-web-ui-integration](../examples/api-web-ui-integration)** - Custom chat UI with API + components
- **[simple-embedded.ts](../examples/simple-embedded.ts)** - Embedded web UI server
- **[embedded-hybrid-fallback.ts](../examples/embedded-hybrid-fallback.ts)** - Hybrid server setup

---

## Publishing

All packages are published to npm under the `@agi-cli` scope:

- `@agi-cli/sdk`
- `@agi-cli/server`
- `@agi-cli/database`
- `@agi-cli/api` (new!)
- `@agi-cli/web-ui`
- `@agi-cli/install`

See [Publishing Guide](./publishing.md) for release procedures.
