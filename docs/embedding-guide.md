# Embedding AGI - Complete Guide

[← Back to README](../README.md) • [Docs Index](./index.md)

This guide shows how to embed AGI into your own applications with full TypeScript autocomplete support.

## Overview

AGI can be embedded in any Node.js/Bun application without requiring users to:
- Install AGI CLI separately
- Create auth.json or config files
- Set up `.agi/` directory structure

The parent application controls everything: authentication, configuration, and agent setup.

## Quick Start

```typescript
import { createEmbeddedApp, BUILTIN_AGENTS } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const agiApp = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY || '',
  agent: 'build', // Use built-in agent
});

// Serve the web UI
Bun.serve({
  port: 3456,
  fetch: agiApp.fetch,
  idleTimeout: 240, // Prevent SSE timeout
});
```

## Built-in Agents

AGI ships with 3 built-in agents with full TypeScript autocomplete:

```typescript
import { BUILTIN_AGENTS, type BuiltinAgent } from '@agi-cli/server';

// Available agents: 'build' | 'plan' | 'general'
const agentName: BuiltinAgent = 'build';

// Access agent configuration
console.log(BUILTIN_AGENTS.build.prompt);
console.log(BUILTIN_AGENTS.build.tools);
```

### Agent Presets

- **`build`** - Full-featured development agent
  - Tools: read, write, ls, tree, bash, git, grep, ripgrep, patch, websearch
  - Best for: Building features, making code changes

- **`plan`** - Planning and analysis agent
  - Tools: read, ls, tree, ripgrep, update_plan, websearch
  - Best for: Architecture planning, code analysis

- **`general`** - General purpose assistant
  - Tools: read, write, ls, tree, bash, ripgrep, websearch, update_plan
  - Best for: Mixed tasks, conversational coding

## Built-in Tools

All available tools with autocomplete:

```typescript
import { BUILTIN_TOOLS, type BuiltinTool } from '@agi-cli/server';

// BUILTIN_TOOLS = [
//   'read', 'write', 'ls', 'tree', 'bash', 'grep', 'ripgrep',
//   'git_status', 'git_diff', 'git_commit', 'apply_patch',
//   'update_plan', 'edit', 'websearch', 'progress_update', 'finish'
// ]

// Get safe tools (no write/bash)
const safeTools = BUILTIN_TOOLS.filter(
  tool => !['bash', 'write'].includes(tool)
);
```

## Configuration Options

### Hybrid Fallback Architecture

AGI uses a **three-tier fallback system** for configuration and authentication:

1. **Injected config** (highest priority) - Passed to `createEmbeddedApp()`
2. **Environment variables** - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
3. **Config files** (fallback) - `~/.config/agi/auth.json`, `.agi/config.json`

This allows AGI to work in **any environment**:
- Fully embedded (no files needed)
- CI/CD (env vars only)
- Traditional CLI (config files)
- Hybrid (mix of all three)

### Configuration Types

```typescript
// Optional configuration - all fields are optional!
type EmbeddedAppConfig = {
  // Provider and model (falls back to env/files if not provided)
  provider?: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'opencode';
  model?: string;
  apiKey?: string;
  
  // Default agent to use
  agent?: string;
  
  // Multi-provider auth (optional)
  auth?: Record<string, { apiKey: string }>;
  
  // Custom agents (optional)
  agents?: Record<string, AgentConfigEntry>;
  
  // Default settings (optional)
  defaults?: {
    provider?: string;
    model?: string;
    agent?: string;
  };
};
```

## Network Access & Proxies

The server supports access from:
- **Localhost**: `http://localhost:*` and `http://127.0.0.1:*`
- **Local network**: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`
- **Custom origins**: Configure via `corsOrigins` for Tailscale, reverse proxies, etc.

### Tailscale / Proxy Configuration

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  corsOrigins: [
    'https://myapp.ts.net',           // Tailscale domain
    'https://agi.example.com',        // Custom domain
    'https://subdomain.ngrok.io'      // ngrok tunnel
  ]
});

Bun.serve({
  port: 9100,
  fetch: app.fetch
});
```

The Web UI auto-detects the server URL, so accessing via `https://myapp.ts.net/ui` will connect to `https://myapp.ts.net/v1/*`.

## Usage Examples

### 1. Full Injection (No Files or Env Vars)

```typescript
const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-...', // Hardcoded or from your vault
  agent: 'build',
});
```

### 2. Environment Variables Only

```typescript
// Set env vars: OPENAI_API_KEY=sk-...
const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  // apiKey omitted - falls back to env var
  agent: 'build',
});
```

### 3. Fallback to Config Files

```typescript
// Uses ~/.config/agi/auth.json and .agi/config.json
const app = createEmbeddedApp({
  // All fields omitted - uses file config
});
```

### 4. Hybrid Mode (Mix of All)

```typescript
// Uses injected provider, but falls back to env/files for API key
const app = createEmbeddedApp({
  provider: 'openai', // Injected
  // model and apiKey fall back to env or files
  agent: 'build',
});
```

### 5. Customize Built-in Agent

```typescript
import { BUILTIN_AGENTS } from '@agi-cli/server';

const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY || '',
  agent: 'general',
  agents: {
    general: {
      ...BUILTIN_AGENTS.general, // Extend built-in
      tools: ['read', 'ls', 'tree', 'websearch'], // Limit tools
    }
  }
});
```

### 6. Create Custom Agent

```typescript
const app = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
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

### 7. Multi-Agent Setup

```typescript
const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY || '',
  agent: 'general',
  
  // Multiple providers
  auth: {
    openai: { apiKey: process.env.OPENAI_API_KEY || '' },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || '' },
  },
  
  // Multiple agents
  agents: {
    build: BUILTIN_AGENTS.build,
    plan: BUILTIN_AGENTS.plan,
    
    // Custom agent with different provider
    architect: {
      prompt: BUILTIN_AGENTS.plan.prompt,
      tools: BUILTIN_AGENTS.plan.tools,
      provider: 'anthropic', // Override provider
      model: 'claude-3-5-sonnet-20241022',
    },
    
    // Safe agent (read-only)
    safe: {
      prompt: BUILTIN_AGENTS.general.prompt,
      tools: ['read', 'ls', 'tree', 'websearch', 'ripgrep'],
    },
  },
  
  defaults: {
    provider: 'openai',
    model: 'gpt-4',
    agent: 'general',
  }
});
```

### 8. Embed in Existing App

```typescript
import { Hono } from 'hono';
import { createEmbeddedApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const parentApp = new Hono();

// Your existing routes
parentApp.get('/', (c) => c.text('My App'));

// Embed AGI
const agiApp = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4-turbo',
  apiKey: process.env.OPENAI_API_KEY || '',
  agent: 'build',
});

// Mount AGI routes under /ai
parentApp.route('/ai', agiApp);

// Serve Web UI
const uiHandler = serveWebUI({ 
  prefix: '/ai/ui',
  serverUrl: '/ai'
});

parentApp.all('/ai/ui/*', async (c) => {
  const response = await uiHandler(c.req.raw);
  return response || c.notFound();
});

Bun.serve({
  port: 3000,
  fetch: parentApp.fetch,
  idleTimeout: 240, // Important for SSE!
});
```

## Agent Configuration

### AgentConfigEntry

```typescript
type AgentConfigEntry = {
  // Agent system prompt (required for custom agents)
  prompt?: string;
  
  // Allowed tools (overrides defaults)
  tools?: string[];
  
  // Tools to add to defaults
  appendTools?: string[];
  
  // Override provider for this agent
  provider?: string;
  
  // Override model for this agent
  model?: string;
};
```

## Web UI Integration

### Serving the Web UI

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

// Option 1: Standalone
const uiHandler = serveWebUI({ 
  prefix: '/ui',
  serverUrl: '/api'
});

Bun.serve({
  port: 3456,
  fetch: async (req) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/ui')) {
      const response = await uiHandler(req);
      if (response) return response;
    }
    return agiApp.fetch(req);
  }
});

// Option 2: With Hono
const handler = serveWebUI({ 
  prefix: '/ui',
  serverUrl: '/api'
});

app.all('/ui/*', async (c) => {
  const response = await handler(c.req.raw);
  return response || c.notFound();
});
```

### Important Server Configuration

Always set `idleTimeout` when using SSE (Server-Sent Events):

```typescript
Bun.serve({
  port: 3456,
  fetch: app.fetch,
  idleTimeout: 240, // 4 minutes - prevents SSE timeout
});
```

## TypeScript Autocomplete

The embedded API provides full TypeScript autocomplete:

```typescript
import { 
  createEmbeddedApp,
  BUILTIN_AGENTS,
  BUILTIN_TOOLS,
  type BuiltinAgent,
  type BuiltinTool 
} from '@agi-cli/server';

// Autocomplete for agent names
const agent: BuiltinAgent = 'build'; // ← Suggests: 'build' | 'plan' | 'general'

// Autocomplete for tool names
const tools: BuiltinTool[] = ['read', 'write']; // ← Suggests all 16 tools

// Extend built-in agents with autocomplete
const customAgent = {
  ...BUILTIN_AGENTS.build, // ← Autocomplete for .build, .plan, .general
  tools: ['read', 'bash'], // ← Autocomplete for tool names
};
```

## Use Cases

### VSCode Extension
```typescript
// Use VSCode's API key storage
const apiKey = await vscode.workspace.getConfiguration('ai').get('apiKey');

const agiApp = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey,
  agent: 'build',
});
```

### Electron App
```typescript
import { app } from 'electron';

const agiApp = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: await keytar.getPassword('myapp', 'anthropic'),
  agent: 'general',
});
```

### SaaS Platform
```typescript
// Per-user API keys from database
const user = await db.users.findOne(userId);

const agiApp = createEmbeddedApp({
  provider: user.aiProvider,
  model: user.aiModel,
  apiKey: decrypt(user.encryptedApiKey),
  agent: user.preferredAgent || 'general',
});
```

## Fallback Priority

When AGI needs a configuration value, it checks in this order:

```
1. Injected config (createEmbeddedApp({ ... }))
   ↓ if not found
2. Environment variables (OPENAI_API_KEY, etc.)
   ↓ if not found
3. Config files (~/.config/agi/auth.json, .agi/config.json)
   ↓ if not found
4. Built-in defaults
```

### Example Scenarios

| Scenario | Injected | Env Vars | Files | Result |
|----------|----------|----------|-------|--------|
| **Full Injection** | ✅ All | ❌ None | ❌ None | Uses injected config |
| **Env Only** | ❌ None | ✅ API keys | ❌ None | Uses env vars |
| **CLI Mode** | ❌ None | ❌ None | ✅ All | Uses config files |
| **Hybrid** | ✅ Provider | ✅ API key | ✅ Model | Uses all three! |

## Deployment Modes

### Mode 1: Fully Embedded (No Files)
Best for: SaaS platforms, VSCode extensions, Electron apps

```typescript
const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: await getFromVault(),
  agent: 'build',
});
```

### Mode 2: Environment Variables (CI/CD)
Best for: GitHub Actions, Docker, serverless

```typescript
// Set: OPENAI_API_KEY=sk-...
const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  // Falls back to env var
});
```

### Mode 3: Traditional CLI (Config Files)
Best for: Desktop development, local usage

```typescript
// Uses ~/.config/agi/auth.json
const app = createEmbeddedApp({});
```

## Next Steps

- See [examples/embedded-with-autocomplete.ts](../examples/embedded-with-autocomplete.ts) for complete examples
- Review [Architecture](./architecture.md) for system design
- Check [API Reference](./api-reference.md) for detailed API docs

## Troubleshooting

### SSE Timeout Errors
Set `idleTimeout: 240` in `Bun.serve()` options.

### Tools Not Working
Ensure tools are listed in agent's `tools` array and are valid built-in tool names.

### Agent Not Loading
Check that custom agent has a `prompt` field or extends a built-in agent.

### API Key Issues
Verify API key is valid and provider name matches: `'openai'`, `'anthropic'`, `'google'`, etc.
