# AGI Integration Guide

**The complete guide to integrating AGI into your projects**

This guide shows you how to use AGI in your own applications, whether you need a full AI assistant backend, React UI components, or low-level API control.

## Table of Contents

- [Quick Start](#quick-start)
- [Package Overview](#package-overview)
- [Integration Approaches](#integration-approaches)
  - [1. Server + Web UI (Full Stack)](#1-server--web-ui-full-stack)
  - [2. Server + Custom Frontend](#2-server--custom-frontend)
  - [3. SDK Only (Programmatic)](#3-sdk-only-programmatic)
- [Detailed Guides](#detailed-guides)
  - [Server Integration](#server-integration)
  - [Web UI Package](#web-ui-package)
  - [Web SDK Integration](#web-sdk-integration)
  - [API Package Integration](#api-package-integration)
  - [SDK Package Integration](#sdk-package-integration)
- [Common Use Cases](#common-use-cases)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Choose Your Integration Level

| Need | Packages | Use Case |
|------|----------|----------|
| **Full AI backend + ready-made UI** | `@agi-cli/server` + `@agi-cli/web-ui` | VSCode extension, Electron app, quick deployment |
| **Backend + custom React UI** | `@agi-cli/server` + `@agi-cli/web-sdk` | Custom branded app with your own components |
| **Type-safe API Client** | `@agi-cli/api` | Connect to existing AGI server |
| **Full Control** | `@agi-cli/sdk` | Build custom AI agents from scratch |

### 30-Second Example

**Embedded AI Backend with Complete Web UI:**

```typescript
import { createEmbeddedApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const app = createEmbeddedApp({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: 'general',
});

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Serve complete Web UI at /ui
    if (url.pathname.startsWith('/ui')) {
      const handler = serveWebUI({ prefix: '/ui' });
      const response = await handler(req);
      if (response) return response;
    }
    
    // API routes at /v1/*
    return app.fetch(req);
  },
  idleTimeout: 240, // Important for SSE streaming!
});

console.log('🚀 AGI running at http://localhost:3000');
console.log('📱 Web UI at http://localhost:3000/ui');
```

That's it! You now have a complete AI assistant with a fully-featured web interface.

---

## Package Overview

AGI is distributed as multiple packages for flexible integration:

### Core Packages

#### `@agi-cli/server`
**The complete HTTP backend**

```bash
npm install @agi-cli/server
```

- ✅ Complete REST API + SSE streaming
- ✅ Session and message management
- ✅ Multi-provider support
- ✅ Built-in agents and tools
- ✅ Embeddable with zero config

**Use when:** You need an AI backend server

---

#### `@agi-cli/web-ui`
**Pre-built complete web interface**

```bash
npm install @agi-cli/web-ui
```

- ✅ **One-line integration** - No build step required
- ✅ **Complete AGI web app** - Fully featured chat interface
- ✅ **Framework agnostic** - Works with any HTTP server
- ✅ **Production ready** - Optimized, pre-built static assets
- ✅ **Mobile responsive** - Modern React + Tailwind UI
- ✅ **Auto-routing** - Handles SPA routing automatically

**Use when:** You want a ready-to-use web interface with zero customization

---

#### `@agi-cli/web-sdk`
**React components, hooks, and utilities**

```bash
npm install @agi-cli/web-sdk
```

- ✅ Pre-built chat components
- ✅ React Query hooks
- ✅ State management (Zustand)
- ✅ SSE streaming support
- ✅ Full TypeScript types

**Use when:** Building a custom React frontend with your own styling/branding

---

#### `@agi-cli/api`
**Type-safe API client (auto-generated)**

```bash
npm install @agi-cli/api axios
```

- ✅ Fully typed from OpenAPI spec
- ✅ Axios-powered HTTP client
- ✅ SSE streaming helpers
- ✅ Error handling utilities
- ✅ Tree-shakeable

**Use when:** You need to connect to an AGI server

---

#### `@agi-cli/sdk`
**Low-level AI primitives**

```bash
npm install @agi-cli/sdk
```

- ✅ Direct AI SDK access
- ✅ Provider catalog
- ✅ Built-in tools
- ✅ Configuration management
- ✅ Authentication helpers

**Use when:** Building custom AI agents

---

### Package Comparison

| Package | What It Is | Customization | Use Case |
|---------|-----------|---------------|----------|
| `@agi-cli/web-ui` | Pre-built complete web app | ❌ None (ready-to-use) | Quick deployment, VSCode extensions, Electron apps |
| `@agi-cli/web-sdk` | React component library | ✅ Full (build your own UI) | Custom branded applications |

---

## Integration Approaches

### 1. Server + Web UI (Full Stack)

**Perfect for:** VSCode extensions, Electron apps, quick deployments, SaaS platforms

This gives you a complete AI assistant backend and a **production-ready web interface** with minimal code.

```typescript
import { createEmbeddedApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

// Create the AGI server
const agiApp = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: 'general',
});

// Serve everything
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Serve Web UI at /ui (one line!)
    if (url.pathname.startsWith('/ui')) {
      const handler = serveWebUI({ prefix: '/ui' });
      const response = await handler(req);
      if (response) return response;
    }
    
    // API routes at /v1/*
    return agiApp.fetch(req);
  },
  idleTimeout: 240, // Prevent SSE timeout
});
```

**What you get:**
- ✅ REST API at `/v1/*`
- ✅ **Complete web UI** at `/ui`
- ✅ SSE streaming
- ✅ Session management
- ✅ Database persistence
- ✅ Mobile-responsive interface
- ✅ Zero build step

---

### 2. Server + Custom Frontend

**Perfect for:** Custom React apps, branded AI assistants with specific styling

Use the server package for the backend, and web-sdk for building your own React UI.

#### Backend (server.ts)

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4-turbo',
  apiKey: process.env.OPENAI_API_KEY,
  agent: 'build',
  corsOrigins: ['http://localhost:5173'], // Your frontend URL
});

Bun.serve({
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 240,
});
```

#### Frontend (App.tsx)

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  ChatInputContainer, 
  MessageThread, 
  SessionListContainer 
} from '@agi-cli/web-sdk/components';
import { useSessions, useMessages } from '@agi-cli/web-sdk/hooks';
import { client } from '@agi-cli/api';
import { useState } from 'react';

// Configure API client
client.setConfig({
  baseURL: 'http://localhost:3000',
});

const queryClient = new QueryClient();

function App() {
  const [sessionId, setSessionId] = useState<string>();
  const { data: sessions } = useSessions();
  const { data: messages } = useMessages(sessionId);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-64 border-r">
          <SessionListContainer
            activeSessionId={sessionId}
            onSelectSession={setSessionId}
          />
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <MessageThread messages={messages || []} />
          </div>
          
          <div className="border-t p-4">
            <ChatInputContainer sessionId={sessionId} />
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
```

#### Tailwind Configuration

```js
// tailwind.config.js
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // ⚠️ IMPORTANT: Include web-sdk package
    './node_modules/@agi-cli/web-sdk/dist/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

---

### 3. SDK Only (Programmatic)

**Perfect for:** CLI tools, automation scripts, custom workflows

No server needed - direct AI model access with tools.

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

// Discover available tools in the project
const tools = await discoverProjectTools(process.cwd());

// Resolve model
const model = resolveModel('anthropic', 'claude-3-5-sonnet-20241022');

// Generate response with tools
const result = await generateText({
  model,
  prompt: 'Analyze this codebase and suggest improvements',
  tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
  maxSteps: 10,
});

console.log(result.text);

// Access tool calls
for (const step of result.steps) {
  if (step.type === 'tool-call') {
    console.log(`Tool: ${step.toolName}`);
    console.log(`Args:`, step.args);
  }
}
```

---

## Detailed Guides

### Server Integration

The `@agi-cli/server` package provides a complete Hono-based HTTP server.

#### Installation

```bash
npm install @agi-cli/server
```

#### Basic Setup

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: 'general',
});

Bun.serve({
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 240,
});
```

#### Configuration Options

```typescript
type EmbeddedAppConfig = {
  // Provider and authentication
  provider?: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'opencode';
  model?: string;
  apiKey?: string;
  
  // Multi-provider auth
  auth?: Record<string, { apiKey: string }>;
  
  // Default agent
  agent?: string;
  
  // Custom agents
  agents?: Record<string, {
    prompt?: string;
    tools?: string[];
    appendTools?: string[];
    provider?: string;
    model?: string;
  }>;
  
  // Default settings
  defaults?: {
    provider?: string;
    model?: string;
    agent?: string;
  };
  
  // CORS configuration
  corsOrigins?: string[];
};
```

#### Built-in Agents

AGI ships with 3 pre-configured agents:

```typescript
import { BUILTIN_AGENTS, type BuiltinAgent } from '@agi-cli/server';

// Available: 'general' | 'build' | 'plan'
const app = createEmbeddedApp({
  agent: 'build',
  
  // Or customize a built-in agent
  agents: {
    build: {
      ...BUILTIN_AGENTS.build,
      tools: ['read', 'write', 'bash', 'git_status'], // Limit tools
    }
  }
});
```

**Agent Presets:**

- **`general`** - General purpose assistant
  - Tools: read, write, ls, tree, bash, ripgrep, websearch, update_plan
  
- **`build`** - Full-featured development agent
  - Tools: All tools (read, write, ls, tree, bash, git, grep, ripgrep, patch, websearch)
  
- **`plan`** - Planning and analysis
  - Tools: read, ls, tree, ripgrep, update_plan, websearch

#### Custom Agents

```typescript
const app = createEmbeddedApp({
  agent: 'reviewer',
  agents: {
    reviewer: {
      prompt: 'You are a code reviewer. Find bugs and suggest improvements.',
      tools: ['read', 'tree', 'grep', 'ripgrep'],
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
    }
  }
});
```

#### Embedding in Existing Apps

```typescript
import { Hono } from 'hono';
import { createEmbeddedApp } from '@agi-cli/server';

const app = new Hono();

// Your existing routes
app.get('/', (c) => c.text('My App'));
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Mount AGI under /ai
const agiApp = createEmbeddedApp({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

app.route('/ai', agiApp);

// AGI is now available at:
// - POST /ai/v1/ask
// - GET  /ai/v1/sessions
// - etc.

Bun.serve({
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 240,
});
```

#### Network Access & CORS

By default, the server allows:
- `localhost` and `127.0.0.1`
- Local network IPs (192.168.x.x, 10.x.x.x, etc.)

For Tailscale or reverse proxies:

```typescript
const app = createEmbeddedApp({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  corsOrigins: [
    'https://myapp.ts.net',       // Tailscale
    'https://agi.example.com',    // Custom domain
  ],
});
```

#### Hybrid Configuration

AGI uses a **3-tier fallback system**:

1. **Injected config** (highest priority)
2. **Environment variables** (OPENAI_API_KEY, etc.)
3. **Config files** (~/.config/agi/auth.json)

This means you can:

```typescript
// Full injection (no env vars or files needed)
createEmbeddedApp({
  provider: 'openai',
  apiKey: 'sk-...',
});

// Hybrid (provider injected, API key from env)
createEmbeddedApp({
  provider: 'openai',
  // apiKey falls back to OPENAI_API_KEY env var
});

// Full fallback (uses env vars and config files)
createEmbeddedApp({});
```

#### API Endpoints

The server exposes these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/ask` | Ask a question (with streaming) |
| `GET` | `/v1/sessions` | List all sessions |
| `POST` | `/v1/sessions` | Create a new session |
| `GET` | `/v1/sessions/:id` | Get session details |
| `DELETE` | `/v1/sessions/:id` | Delete a session |
| `GET` | `/v1/sessions/:id/stream` | SSE stream for session updates |
| `GET` | `/v1/sessions/:id/messages` | Get session messages |
| `POST` | `/v1/sessions/:id/messages` | Send a message |

---

### Web UI Package

The `@agi-cli/web-ui` package provides a **complete, pre-built web interface** that you can plug into any server with a single function call.

#### Installation

```bash
npm install @agi-cli/web-ui
```

#### Quick Start - One Line Integration

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  idleTimeout: 240, // IMPORTANT: prevents SSE timeout
  fetch: serveWebUI({ prefix: '/ui' })
});

console.log('Web UI: http://localhost:3000/ui');
```

That's it! The complete AGI web interface is now running at `/ui`.

#### What You Get

- ✅ **Complete chat interface** - Full-featured AGI web app
- ✅ **Session management** - List, create, switch between sessions
- ✅ **Real-time streaming** - SSE-powered live responses
- ✅ **Tool visualization** - See tool calls and results
- ✅ **Artifact viewer** - Code diffs, file changes
- ✅ **Mobile responsive** - Works on all devices
- ✅ **Dark mode** - Modern UI with Tailwind CSS
- ✅ **Zero configuration** - Works out of the box

#### Configuration Options

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

const handler = serveWebUI({
  prefix: '/ui',              // URL prefix (default: '/ui')
  redirectRoot: true,         // Redirect '/' to prefix (default: false)
  serverUrl: undefined,       // API server URL (auto-detects if not provided)
  onNotFound: (req) => null, // Custom 404 handler (optional)
});

Bun.serve({
  port: 3000,
  idleTimeout: 240,
  fetch: handler
});
```

#### Combining with API Server

```typescript
import { createEmbeddedApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const agiApp = createEmbeddedApp({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const webUI = serveWebUI({ prefix: '/ui' });

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Web UI at /ui
    if (url.pathname.startsWith('/ui')) {
      const response = await webUI(req);
      if (response) return response;
    }
    
    // API at /v1
    return agiApp.fetch(req);
  },
  idleTimeout: 240,
});

console.log('🚀 Server: http://localhost:3000/v1');
console.log('📱 Web UI: http://localhost:3000/ui');
```

#### Root Redirect

Automatically redirect `/` to the web UI:

```typescript
Bun.serve({
  port: 3000,
  idleTimeout: 240,
  fetch: serveWebUI({ 
    prefix: '/ui',
    redirectRoot: true  // '/' → '/ui'
  })
});
```

#### Framework Agnostic

Works with any HTTP server:

**Express:**
```typescript
import express from 'express';
import { getWebUIPath, getIndexPath } from '@agi-cli/web-ui';

const app = express();

app.use('/ui', express.static(getWebUIPath()));
app.get('/ui/*', (req, res) => {
  res.sendFile(getIndexPath());
});

app.listen(3000);
```

**Hono:**
```typescript
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getWebUIPath } from '@agi-cli/web-ui';

const app = new Hono();

app.use('/ui/*', serveStatic({ root: getWebUIPath() }));
```

#### Important Notes

**⚠️ SSE Timeout:**
Always set `idleTimeout: 240` (or higher) in your server config. The web UI uses Server-Sent Events for real-time streaming, and Bun's default 10-second timeout will cause connections to drop.

```typescript
Bun.serve({
  port: 3000,
  idleTimeout: 240, // 4 minutes - prevents SSE timeout
  fetch: serveWebUI({ prefix: '/ui' })
});
```

**API Connection:**
The web UI auto-detects the API server from the request origin. If serving both UI and API from the same server, no additional config needed. For separate servers, configure `serverUrl`:

```typescript
serveWebUI({
  prefix: '/ui',
  serverUrl: 'http://api.example.com' // Different API server
})
```

#### Bundle Size

Optimized production build:
- Main bundle: ~370 KB gzipped
- CSS: ~6.5 KB gzipped
- Total: ~376 KB gzipped

#### Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

---

### Web SDK Integration

The `@agi-cli/web-sdk` package provides React components and hooks for building **custom** AI chat interfaces.

#### Installation

```bash
npm install @agi-cli/web-sdk @agi-cli/api axios
npm install @tanstack/react-query lucide-react react-markdown remark-gfm zustand
```

#### Setup

**1. Configure API Client**

```typescript
// src/lib/api.ts
import { client } from '@agi-cli/api';

client.setConfig({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
});
```

**2. Setup React Query**

```tsx
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

**3. Configure Tailwind CSS**

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    // ⚠️ CRITICAL: Include web-sdk package
    './node_modules/@agi-cli/web-sdk/dist/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
};
```

**4. Add CSS Variables**

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 25% 95%;
    --foreground: 220 10% 15%;
    --card: 220 25% 98%;
    --card-foreground: 220 10% 15%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --border: 220 15% 89%;
    --input: 220 15% 89%;
    --ring: 222.2 84% 4.9%;
  }

  .dark {
    --background: 240 10% 8%;
    --foreground: 0 0% 98%;
    --card: 240 10% 10%;
    --card-foreground: 0 0% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --border: 240 10% 15%;
    --input: 240 10% 15%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

#### Using Components

```tsx
import { 
  ChatInputContainer,
  MessageThread,
  SessionListContainer,
} from '@agi-cli/web-sdk/components';

function ChatApp() {
  const [sessionId, setSessionId] = useState<string>();

  return (
    <div className="flex h-screen">
      <aside className="w-64">
        <SessionListContainer
          activeSessionId={sessionId}
          onSelectSession={setSessionId}
        />
      </aside>
      
      <main className="flex-1 flex flex-col">
        <MessageThread sessionId={sessionId} />
        <ChatInputContainer sessionId={sessionId} />
      </main>
    </div>
  );
}
```

#### Using Hooks

```tsx
import { 
  useSessions, 
  useMessages, 
  useSessionStream,
  useTheme 
} from '@agi-cli/web-sdk/hooks';

function MyComponent() {
  // Fetch sessions
  const { data: sessions, isLoading } = useSessions();
  
  // Fetch messages for a session
  const { data: messages } = useMessages(sessionId);
  
  // Stream session updates
  useSessionStream(sessionId, {
    onMessage: (msg) => console.log('New message:', msg),
    onToolCall: (tool) => console.log('Tool called:', tool),
  });
  
  // Theme management
  const { theme, setTheme, toggleTheme } = useTheme();
  
  return <div>...</div>;
}
```

#### Available Components

| Component | Description |
|-----------|-------------|
| `ChatInputContainer` | Message input with send button |
| `MessageThread` | Display message history |
| `SessionListContainer` | Session list sidebar |
| `SessionHeader` | Session info header |
| `ToolCallDisplay` | Render tool execution |
| `ArtifactViewer` | Display code/file artifacts |

#### Available Hooks

| Hook | Purpose |
|------|---------|
| `useSessions()` | Fetch all sessions |
| `useMessages(sessionId)` | Fetch messages |
| `useSessionStream(sessionId)` | Real-time SSE updates |
| `useTheme()` | Dark/light theme management |
| `useCreateSession()` | Create new session |
| `useSendMessage()` | Send message mutation |

#### State Management

```tsx
import { useGitStore, useSidebarStore } from '@agi-cli/web-sdk/stores';

function Sidebar() {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggle = useSidebarStore((state) => state.toggle);
  
  return (
    <aside className={collapsed ? 'w-16' : 'w-64'}>
      <button onClick={toggle}>Toggle</button>
    </aside>
  );
}
```

---

### API Package Integration

The `@agi-cli/api` package provides a type-safe client for connecting to AGI servers.

#### Installation

```bash
npm install @agi-cli/api axios
```

#### Basic Usage

```typescript
import { client, ask, listSessions, createSession } from '@agi-cli/api';

// Configure once
client.setConfig({
  baseURL: 'http://localhost:3000',
});

// Ask a question
const response = await ask({
  body: {
    prompt: 'What files are in this directory?',
    sessionId: 'optional-session-id',
  },
});

if (response.error) {
  console.error('Error:', response.error);
} else {
  console.log('Response:', response.data);
}

// List sessions
const sessions = await listSessions();
console.log('Sessions:', sessions.data);

// Create session
const newSession = await createSession({
  body: { agent: 'general' },
});
```

#### SSE Streaming

```typescript
import { createSSEStream } from '@agi-cli/api';

const stream = createSSEStream({
  url: 'http://localhost:3000/v1/sessions/abc123/stream',
  onMessage: (event) => {
    if (event.type === 'message') {
      console.log('Message:', event.data);
    } else if (event.type === 'tool-call') {
      console.log('Tool:', event.data);
    }
  },
  onError: (error) => {
    console.error('Stream error:', error);
  },
});

// Close when done
stream.close();
```

#### Authentication

```typescript
import { client } from '@agi-cli/api';

// Add auth header to all requests
client.instance.interceptors.request.use((config) => {
  const token = getAuthToken();
  config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
```

#### Error Handling

```typescript
import { ask, isApiError, handleApiError } from '@agi-cli/api';

const response = await ask({ body: { prompt: 'Hello' } });

if (response.error) {
  if (isApiError(response.error)) {
    const { status, message } = handleApiError(response.error);
    console.error(`API Error [${status}]:`, message);
  } else {
    console.error('Unexpected error:', response.error);
  }
}
```

---

### SDK Package Integration

The `@agi-cli/sdk` package provides low-level AI primitives and tools.

#### Installation

```bash
npm install @agi-cli/sdk
```

#### Generate Text

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

const model = resolveModel('anthropic', 'claude-3-5-sonnet-20241022');

const result = await generateText({
  model,
  prompt: 'Explain quantum computing',
  temperature: 0.7,
});

console.log(result.text);
```

#### Stream Text

```typescript
import { streamText, resolveModel } from '@agi-cli/sdk';

const model = resolveModel('openai', 'gpt-4-turbo');

const { textStream } = streamText({
  model,
  prompt: 'Write a story about AI',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

#### Use Tools

```typescript
import { generateText, resolveModel, buildFsTools, buildGitTools } from '@agi-cli/sdk';

const tools = {
  ...buildFsTools(),
  ...buildGitTools(),
};

const result = await generateText({
  model: resolveModel('anthropic'),
  prompt: 'List TypeScript files and count their lines',
  tools,
  maxSteps: 10,
});

console.log(result.text);

// Inspect tool usage
for (const step of result.steps) {
  if (step.type === 'tool-call') {
    console.log(`Called ${step.toolName} with:`, step.args);
  }
}
```

#### Structured Output

```typescript
import { generateObject, resolveModel, z } from '@agi-cli/sdk';

const schema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
});

const { object } = await generateObject({
  model: resolveModel('anthropic'),
  schema,
  prompt: 'Analyze: "AGI is amazing for building AI apps!"',
});

console.log(object);
// { sentiment: 'positive', confidence: 0.95, keywords: ['amazing', 'AI', 'apps'] }
```

#### Custom Tools

```typescript
import { generateText, resolveModel, tool, z } from '@agi-cli/sdk';

const weatherTool = tool({
  description: 'Get weather for a city',
  parameters: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    // Call weather API
    return `Weather in ${city}: Sunny, 72°F`;
  },
});

const result = await generateText({
  model: resolveModel('openai'),
  prompt: 'What's the weather in San Francisco?',
  tools: {
    weather: weatherTool,
  },
});
```

#### Provider Configuration

```typescript
import { 
  catalog, 
  isProviderId, 
  defaultModelFor,
  validateProviderModel 
} from '@agi-cli/sdk';

// Check if provider is valid
if (isProviderId('anthropic')) {
  console.log('Valid provider');
}

// Get default model
const model = defaultModelFor('openai'); // 'gpt-4-turbo'

// Validate provider/model combo
const validation = validateProviderModel('anthropic', 'claude-3-5-sonnet-20241022');
if (validation.valid) {
  console.log('Valid combination');
} else {
  console.error(validation.error);
}

// Browse catalog
console.log(catalog.anthropic.models);
console.log(catalog.openai.pricing);
```

---

## Common Use Cases

### VSCode Extension

```typescript
// extension.ts
import * as vscode from 'vscode';
import { createEmbeddedApp } from '@agi-cli/server';

export function activate(context: vscode.ExtensionContext) {
  const app = createEmbeddedApp({
    provider: 'anthropic',
    apiKey: vscode.workspace.getConfiguration('agi').get('apiKey'),
    agent: 'general',
  });

  const server = Bun.serve({
    port: 0, // Random port
    fetch: app.fetch,
    idleTimeout: 240,
  });

  const panel = vscode.window.createWebviewPanel(
    'agiChat',
    'AGI Assistant',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(server.port);

  context.subscriptions.push({
    dispose: () => server.stop(),
  });
}
```

### Electron App

```typescript
// main.ts
import { app, BrowserWindow } from 'electron';
import { createEmbeddedApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const agiApp = createEmbeddedApp({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const webUI = serveWebUI({ prefix: '/ui' });

const server = Bun.serve({
  port: 9100,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname.startsWith('/ui')) {
      const response = await webUI(req);
      if (response) return response;
    }
    
    return agiApp.fetch(req);
  },
  idleTimeout: 240,
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  win.loadURL('http://localhost:9100/ui');
});
```

### CLI Tool

```typescript
#!/usr/bin/env bun
import { generateText, resolveModel, buildFsTools } from '@agi-cli/sdk';

const question = process.argv[2];

if (!question) {
  console.error('Usage: cli-tool <question>');
  process.exit(1);
}

const model = resolveModel('anthropic');
const tools = buildFsTools();

const result = await generateText({
  model,
  prompt: question,
  tools,
  maxSteps: 5,
});

console.log(result.text);
```

### Next.js API Route

```typescript
// app/api/ai/route.ts
import { createEmbeddedApp } from '@agi-cli/server';

const agiApp = createEmbeddedApp({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  return agiApp.fetch(request);
}

export async function GET(request: Request) {
  return agiApp.fetch(request);
}
```

### Docker Deployment

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "server.ts"]
```

```typescript
// server.ts
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  provider: process.env.AI_PROVIDER,
  apiKey: process.env.AI_API_KEY,
});

Bun.serve({
  port: process.env.PORT || 3000,
  fetch: app.fetch,
  idleTimeout: 240,
});
```

---

## Best Practices

### Security

**1. Never expose API keys in client code**

```typescript
// ❌ BAD - API key in frontend
const app = createEmbeddedApp({
  apiKey: 'sk-...' // Exposed to users!
});

// ✅ GOOD - API key from environment
const app = createEmbeddedApp({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

**2. Validate user input**

```typescript
import { z } from '@agi-cli/sdk';

const inputSchema = z.object({
  prompt: z.string().max(10000),
  sessionId: z.string().uuid().optional(),
});

app.post('/ask', async (c) => {
  const body = await c.req.json();
  const validated = inputSchema.parse(body); // Throws if invalid
  // ...
});
```

**3. Rate limiting**

```typescript
import { RateLimiter } from 'some-rate-limiter';

const limiter = new RateLimiter({ max: 10, window: '1m' });

app.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  if (!limiter.check(ip)) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  await next();
});
```

### Performance

**1. Always set idleTimeout for SSE**

```typescript
Bun.serve({
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 240, // 4 minutes - prevents SSE timeout
});
```

**2. Use streaming for large responses**

```typescript
// ❌ BAD - Wait for full response
const { text } = await generateText({ model, prompt });

// ✅ GOOD - Stream tokens as they arrive
const { textStream } = streamText({ model, prompt });
for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

**3. Lazy-load tools**

```typescript
// ❌ BAD - Load all tools upfront
const allTools = await discoverProjectTools(cwd);

// ✅ GOOD - Load tools on demand
const tools = {
  read: readTool,
  write: writeTool,
  // Only include needed tools
};
```

### Error Handling

**1. Handle API errors gracefully**

```typescript
import { ask } from '@agi-cli/api';

try {
  const response = await ask({ body: { prompt } });
  if (response.error) {
    console.error('API error:', response.error);
    // Show user-friendly message
  }
} catch (error) {
  console.error('Network error:', error);
  // Retry or show offline message
}
```

**2. Validate configuration**

```typescript
import { validateProviderModel } from '@agi-cli/sdk';

const validation = validateProviderModel(provider, model);
if (!validation.valid) {
  throw new Error(`Invalid model: ${validation.error}`);
}
```

### TypeScript

**1. Use generated types**

```typescript
import type { 
  Session, 
  Message, 
  ToolCall 
} from '@agi-cli/api';

function displaySession(session: Session) {
  console.log(session.agent, session.model);
}
```

**2. Leverage autocomplete**

```typescript
import { BUILTIN_AGENTS, type BuiltinAgent } from '@agi-cli/server';

const agent: BuiltinAgent = 'build'; // Autocomplete suggests: 'build' | 'plan' | 'general'
```

---

## Troubleshooting

### Server Issues

**Problem:** SSE connections timeout

**Solution:** Set `idleTimeout` in server config

```typescript
Bun.serve({
  fetch: app.fetch,
  idleTimeout: 240, // Add this!
});
```

---

**Problem:** CORS errors from frontend

**Solution:** Configure `corsOrigins`

```typescript
const app = createEmbeddedApp({
  corsOrigins: ['http://localhost:5173'], // Your frontend URL
});
```

---

**Problem:** "Provider not configured"

**Solution:** Check fallback order:
1. Injected config
2. Environment variables (`ANTHROPIC_API_KEY`)
3. Config files (`~/.config/agi/auth.json`)

```typescript
// Option 1: Inject directly
createEmbeddedApp({
  provider: 'anthropic',
  apiKey: 'sk-...',
});

// Option 2: Use env var
process.env.ANTHROPIC_API_KEY = 'sk-...';
createEmbeddedApp({ provider: 'anthropic' });
```

---

### Web UI Issues

**Problem:** Web UI not loading

**Solution:** Check that `serveWebUI` is properly configured

```typescript
// Make sure the prefix matches your URLs
const handler = serveWebUI({ prefix: '/ui' });

// And idleTimeout is set
Bun.serve({
  port: 3000,
  fetch: handler,
  idleTimeout: 240, // Critical!
});
```

---

**Problem:** Web UI can't connect to API

**Solution:** Ensure API and UI are on the same origin, or configure `serverUrl`

```typescript
// Same origin (auto-detects)
serveWebUI({ prefix: '/ui' })

// Different origin
serveWebUI({ 
  prefix: '/ui',
  serverUrl: 'http://api.example.com'
})
```

---

### Web SDK Issues

**Problem:** Components have no styles

**Solution:** Configure Tailwind to scan web-sdk

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@agi-cli/web-sdk/dist/**/*.{js,jsx}', // Add this!
  ],
};
```

---

**Problem:** "client is not configured"

**Solution:** Call `client.setConfig()` before using hooks

```typescript
import { client } from '@agi-cli/api';

client.setConfig({
  baseURL: 'http://localhost:3000',
});
```

---

**Problem:** SSE not receiving updates

**Solution:** Check `useSessionStream` is mounted

```tsx
function ChatWindow({ sessionId }: { sessionId: string }) {
  // This hook must be called for real-time updates
  useSessionStream(sessionId, {
    onMessage: (msg) => console.log(msg),
  });

  return <MessageThread sessionId={sessionId} />;
}
```

---

### API Client Issues

**Problem:** TypeScript errors on generated types

**Solution:** Regenerate client from latest OpenAPI spec

```bash
cd packages/api
bun run generate
```

---

**Problem:** Request timeout

**Solution:** Configure axios timeout

```typescript
import { client } from '@agi-cli/api';

client.setConfig({
  baseURL: 'http://localhost:3000',
  timeout: 60000, // 60 seconds
});
```

---

### SDK Issues

**Problem:** "Model not found"

**Solution:** Check provider and model are valid

```typescript
import { validateProviderModel } from '@agi-cli/sdk';

const result = validateProviderModel('anthropic', 'claude-3-5-sonnet-20241022');
if (!result.valid) {
  console.error(result.error);
}
```

---

**Problem:** Tool execution fails

**Solution:** Check tool is included in agent's tool list

```typescript
const app = createEmbeddedApp({
  agent: 'custom',
  agents: {
    custom: {
      prompt: 'You are an assistant',
      tools: ['read', 'write', 'bash'], // Must include tools you want to use
    }
  }
});
```

---

## Additional Resources

- **[Embedding Guide](docs/embedding-guide.md)** - Deep dive into server embedding
- **[Development Guide](docs/development-guide.md)** - Contributing to AGI
- **[Architecture](docs/architecture.md)** - System design overview
- **[API Reference](docs/api.md)** - Complete API documentation
- **[Examples](examples/)** - Real-world usage examples

---

## Getting Help

- **Issues:** https://github.com/nitishxyz/agi/issues
- **Discussions:** https://github.com/nitishxyz/agi/discussions
- **Discord:** [Coming soon]

---

## License

MIT © AGI CLI Team
