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

### Basic Configuration

```typescript
type EmbeddedAppConfig = {
  // Required: Provider and model
  provider: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'opencode';
  model: string;
  apiKey: string;
  
  // Optional: Default agent to use
  agent?: string;
  
  // Optional: Multi-provider auth
  auth?: Record<string, { apiKey: string }>;
  
  // Optional: Custom agents
  agents?: Record<string, AgentConfigEntry>;
  
  // Optional: Default settings
  defaults?: {
    provider?: string;
    model?: string;
    agent?: string;
  };
};
```

## Usage Examples

### 1. Use Built-in Agent

```typescript
const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY || '',
  agent: 'build', // ← Autocomplete works!
});
```

### 2. Customize Built-in Agent

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

### 3. Create Custom Agent

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

### 4. Multi-Agent Setup

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

### 5. Embed in Existing App

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

## Differences from CLI Mode

| Feature | CLI Mode | Embedded Mode |
|---------|----------|---------------|
| Auth | `~/.config/agi/auth.json` | Injected via config |
| Config | `.agi/config.json` | Injected via config |
| Agents | File-based | Programmatic |
| Database | `.agi/agi.sqlite` | In-memory or custom |
| Setup | User runs `agi login` | Parent app handles |

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
