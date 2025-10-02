# SDK & Server Standalone Usage

## Current Architecture ✅ **FILES OPTIONAL**

### **Server Now Supports Config Injection**

The server **now supports** optional config injection and **can** work without files:

```typescript
// packages/server/src/runtime/askService.ts
async function processAskRequest(request: AskServerRequest) {
  const projectRoot = request.projectRoot || process.cwd();
  
  let cfg: AGIConfig;
  
  // ✅ NEW: Check if config is injected
  if (request.skipFileConfig || request.config) {
    // Create minimal in-memory config
    cfg = {
      projectRoot,
      defaults: {
        provider: request.config?.provider || 'openai',
        model: request.config?.model || 'gpt-4o-mini',
        agent: request.config?.agent || 'general',
      },
      providers: { /* all enabled */ },
      paths: { /* minimal paths */ },
    };
    
    // ✅ Set env vars from injected credentials
    if (request.credentials || request.config?.apiKey) {
      // Set environment variables for API keys
    }
  } else {
    // ✅ Fallback: Load from disk (backward compatible)
    cfg = await loadConfig(projectRoot);
  }
  
  // ✅ Agent config can be inline or from disk
  const agentCfg = request.agentPrompt
    ? { name, prompt: request.agentPrompt, tools: request.tools ?? [...] }
    : await resolveAgentConfig(cfg.projectRoot, agentName);
  
  // ✅ Only check auth files if not using injected config
  if (!request.skipFileConfig && !request.config && !request.credentials) {
    await ensureProviderEnv(cfg, providerForMessage);
  }
}
```

### **What Gets Loaded From Disk**

1. **Config Files** (`loadConfig`)
   - `~/.config/agi/config.json` (global)
   - `{projectRoot}/.agi/config.json` (project)
   - Merged with defaults

2. **Auth Files** (`ensureProviderEnv` → `isProviderAuthorized`)
   - `~/.config/agi/auth.json` (API keys)
   - Sets environment variables

3. **Agent Files** (`resolveAgentConfig`)
   - `~/.config/agi/agents/{name}.txt`
   - `{projectRoot}/.agi/agents/{name}.txt`
   - Embedded defaults (build/plan/general)

4. **Database** (`getDb`)
   - `{projectRoot}/.agi/agi.sqlite`

---

## Standalone Usage Options

### **Option 1: Standalone Server (Environment Variables)**

Use `createStandaloneApp()` to run server with env vars only:

```typescript
import { createStandaloneApp } from '@agi-cli/server';

// Set environment variables
process.env.OPENAI_API_KEY = 'sk-...';
process.env.AGI_PROVIDER = 'openai';      // Optional
process.env.AGI_MODEL = 'gpt-4o-mini';    // Optional
process.env.AGI_AGENT = 'general';         // Optional

// Create standalone server (no config files needed)
const app = createStandaloneApp({
  provider: 'openai',      // Or read from env
  model: 'gpt-4o-mini',    // Or read from env
  defaultAgent: 'general', // Or read from env
});

// Start server
Bun.serve({
  port: 3000,
  fetch: app.fetch,
});
```

### **Option 2: Embedded Server (Full Injection)**

Use `createEmbeddedApp()` for complete control:

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

// Fully injected config (no files, no env vars needed)
const app = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  apiKey: 'sk-ant-...',
  agent: 'general',
});

// Mount in existing server
myApp.route('/ai', app);
```

### **Option 3: Per-Request Injection**

Send config with each API request:

```typescript
// Client code
const response = await fetch('http://localhost:3000/v1/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Hello!',
    skipFileConfig: true,
    config: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-...',
    },
    agentPrompt: 'You are a helpful assistant.',
    tools: ['progress_update', 'finish'],
  }),
});
```

### **Option 4: File-Based (Default)**

Traditional mode with config files:

```typescript
import { createApp } from '@agi-cli/server';

// Uses ~/.config/agi/config.json and auth.json
const app = createApp();

Bun.serve({
  port: 3000,
  fetch: app.fetch,
});
```

### **Option 5: SDK-Only (No Server)**

Use the SDK directly (no server needed):

```typescript
import { chat } from '@agi-cli/sdk';

// 100% in-memory, no files
const response = await chat({
  prompt: 'Hello!',
  systemPrompt: 'You are a helpful assistant.',
  config: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4o-mini',
  },
});
```

---

## Implementation Details ✅

### **1. Config Injection (Implemented)**

```typescript
// packages/server/src/runtime/askService.ts
export type InjectableConfig = {
  provider?: string;
  model?: string;
  apiKey?: string;
  agent?: string;
};

export type InjectableCredentials = Partial<
  Record<ProviderId, { apiKey: string }>
>;

export type AskServerRequest = {
  projectRoot?: string;
  prompt: string;
  
  // ✅ IMPLEMENTED: Config injection
  skipFileConfig?: boolean;
  config?: InjectableConfig;
  credentials?: InjectableCredentials;
  
  // ✅ IMPLEMENTED: Inline agent config
  agentPrompt?: string;
  tools?: string[];
  
  agent?: string;
  provider?: string;
  model?: string;
  sessionId?: string;
  last?: boolean;
  jsonMode?: boolean;
};
```

### **2. Agent Config Injection (Implemented)**

```typescript
// ✅ IMPLEMENTED
const agentCfg = request.agentPrompt
  ? {
      name: agentName,
      prompt: request.agentPrompt,
      tools: request.tools ?? ['progress_update', 'finish'],
      provider: request.provider,
      model: request.model,
    }
  : await resolveAgentConfig(cfg.projectRoot, agentName);
```

### **3. Provider Selection Without Auth (Implemented)**

```typescript
// packages/server/src/runtime/providerSelection.ts
export async function selectProviderAndModel(input: SelectionInput) {
  // ✅ IMPLEMENTED: Skip auth check if using injected config
  const provider = input.skipAuth
    ? input.explicitProvider ?? input.agentProviderDefault
    : await pickAuthorizedProvider({ ... });
  
  // ...
}
```

### **4. Factory Functions (Implemented)**

```typescript
// packages/server/src/index.ts

// ✅ IMPLEMENTED: Standalone server
export function createStandaloneApp(config?: {
  provider?: ProviderId;
  model?: string;
  defaultAgent?: string;
}): Hono;

// ✅ IMPLEMENTED: Embedded server
export function createEmbeddedApp(config: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  agent?: string;
}): Hono;
```

---

## Summary

| Component | Current State | Standalone Capable? |
|-----------|---------------|---------------------|
| **SDK** | ✅ Config-agnostic | ✅ YES - accepts `ModelConfig` param |
| **Server** | ✅ Optional file loading | ✅ YES - supports config injection |
| **CLI** | ⚙️ User interface | ⚠️ N/A - manages config files for users |

### **Available Modes**

1. **File-based** (Default): `createApp()` - Uses `~/.config/agi/` files ✅
2. **Standalone**: `createStandaloneApp()` - Uses env vars only ✅
3. **Embedded**: `createEmbeddedApp()` - Full config injection ✅
4. **Per-request**: Send config in API request body ✅
5. **SDK-only**: Use SDK directly without server ✅

### **What Was Implemented**

✅ Config injection to `askService.ts` → `processAskRequest()`
✅ Inline agent config in `agentRegistry.ts` → `resolveAgentConfig()`
✅ Skip auth in `providerSelection.ts` → `selectProviderAndModel()`
✅ Factory functions `createStandaloneApp()` and `createEmbeddedApp()`
✅ Request body support for all injection options

### **Example: Fully Standalone**

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
  agent: 'general',
});

Bun.serve({ port: 3000, fetch: app.fetch });
```

No files required. No auth.json. No config.json. Works in CI, containers, GitHub Actions, etc.
