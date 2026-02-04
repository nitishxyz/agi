# otto Web UI

Browser-based client for the otto server. Provides a chat interface for interacting with AI agents.

## Stack

- React 19, Vite, TypeScript
- TanStack Router + Query
- Tailwind CSS, Zustand
- `@ottocode/web-sdk` for components, hooks, and API integration

## Development

```bash
# Start Vite dev server (needs otto server running separately)
bun run dev

# Or from monorepo root
bun run dev:web
```

The dev server runs on `http://localhost:5173`. You need the otto server running for the web UI to work:

```bash
# In another terminal
bun run cli serve
```

## Build

```bash
bun run build
```

The built assets are copied to `@ottocode/web-ui` for embedding in the CLI binary. This happens automatically during `bun run compile`.

## How It Works

The web app is a client for the local otto server. It communicates via:

- **REST API** for sessions, messages, config, files, git operations
- **SSE (Server-Sent Events)** for real-time streaming of AI responses

When you run `otto serve`, the CLI starts both the API server and serves the pre-built web UI assets. During development, you can run the Vite dev server separately for hot reload.

## Features

- Real-time chat with SSE streaming
- Session history and management
- Syntax highlighting for code blocks
- Terminal rendering (Ghostty web)
- Dark theme
- Mobile-responsive layout
