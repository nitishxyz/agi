# Authentication & Configuration Architecture

This document explains how AGI handles authentication and configuration across the SDK, CLI, and Server components.

## Overview

AGI uses a **separation of concerns** approach where:
- **SDK** is auth/config agnostic - it accepts injected credentials
- **CLI** manages auth/config files and injects them where needed
- **Server** loads auth/config and passes credentials to SDK functions

## Architecture Principles

### 1. SDK is Credential-Agnostic

The SDK **never** creates or manages auth/config files. It only works with:
- Injected API keys via `ModelConfig`
- Environment variables (read-only)
- Configuration passed by the caller

```typescript
// SDK accepts credentials via ModelConfig
export async function resolveModel(
  provider: ProviderName,
  model: string,
  config: ModelConfig = {}  // ← Credentials injected here
) {
  if (provider === 'openai') {
    if (config.apiKey) {
      const instance = createOpenAI({ apiKey: config.apiKey });
      return instance(model);
    }
    return openai(model); // Falls back to env vars
  }
  // ...
}
```

### 2. Config Package Reads Files

The `@agi-cli/config` package is responsible for:
- Reading config files (`.agi/config.json`, global config)
- Merging configuration from multiple sources
- Providing configuration to other packages

```typescript
// Config just reads files, doesn't manage credentials
export async function loadConfig(projectRootInput?: string): Promise<AGIConfig> {
  const projectRoot = projectRootInput || process.cwd();
  
  // Load from multiple sources
  const projectCfg = await readJsonOptional(projectConfigPath);
  const globalCfg = await readJsonOptional(globalConfigPath);
  
  // Merge with defaults
  const merged = deepMerge(DEFAULTS, globalCfg, projectCfg);
  
  return {
    projectRoot,
    defaults: merged.defaults,
    providers: merged.providers,
    paths: { dataDir, dbPath, ... }
  };
}
```

### 3. Auth Package Manages Credentials

The `@agi-cli/auth` package:
- Stores credentials in a **secure global location** (`~/.config/agi/auth.json`)
- Never stores credentials locally in project (for security)
- Provides read/write functions for credentials

```typescript
// Auth file location
function globalAuthPath(): string {
  return getSecureAuthPath(); // ~/.config/agi/auth.json
}

// Read all credentials
export async function getAllAuth(_projectRoot?: string): Promise<AuthFile> {
  const globalFile = Bun.file(globalAuthPath());
  const globalData = await globalFile.json().catch(() => ({}));
  return { ...globalData };
}

// Write credential (always to global location)
export async function setAuth(
  provider: ProviderId,
  info: AuthInfo,
  _projectRoot?: string,
  _scope: 'global' | 'local' = 'global'
) {
  const path = globalAuthPath();
  const f = Bun.file(path);
  const existing = await f.json().catch(() => ({}));
  const next = { ...existing, [provider]: info };
  
  await ensureDir(path.dirname());
  await Bun.write(path, JSON.stringify(next, null, 2));
  await fs.chmod(path, 0o600); // Secure permissions
}
```

### 4. CLI Creates and Manages Auth

The CLI is the **only** component that creates auth files:

```typescript
// CLI manages auth via interactive prompts
export async function runAuthLogin(_args: string[]) {
  const cfg = await loadConfig(process.cwd());
  
  const provider = await select({
    message: 'Select provider',
    options: [
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Anthropic' },
      // ...
    ]
  });
  
  const key = await password({
    message: `Paste ${meta.env} here`,
  });
  
  // Write to secure global location
  await setAuth(
    provider,
    { type: 'api', key: String(key) },
    cfg.projectRoot,
    'global'
  );
  
  log.success('Saved');
}
```

### 5. Server Loads Config or Accepts Injection

The server can load config/auth from files OR accept injected config:

```typescript
// Mode 1: File-based (default)
const cfg = await loadConfig(projectRoot);
const auth = await getAllAuth(projectRoot);
const model = await resolveModel(
  cfg.defaults.provider,
  cfg.defaults.model,
  { apiKey: auth[cfg.defaults.provider]?.key }
);

// Mode 2: Injected config (standalone)
const response = await handleAskRequest({
  prompt: 'Hello!',
  skipFileConfig: true,
  config: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// Mode 3: Factory function (embedded)
const app = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  apiKey: 'sk-ant-...',
});
```

## Data Flow

### Authentication Flow

```
1. User runs: agi auth login
   ↓
2. CLI prompts for provider/credentials
   ↓
3. CLI calls setAuth() from @agi-cli/auth
   ↓
4. Auth package writes to ~/.config/agi/auth.json
   ↓
5. File permissions set to 0600 (user-only)
```

### SDK Usage Flow

```
1. Server/CLI loads config via loadConfig()
   ↓
2. Server/CLI loads auth via getAllAuth()
   ↓
3. Server/CLI injects credentials to SDK:
   resolveModel(provider, model, { apiKey: auth[provider].key })
   ↓
4. SDK uses injected credentials OR falls back to env vars
   ↓
5. SDK returns configured model for use
```

### Configuration Priority

```
Environment Variables (highest priority)
  ↓
Injected config via ModelConfig
  ↓
Global config (~/.config/agi/config.json)
  ↓
Project config (.agi/config.json)
  ↓
Built-in defaults (lowest priority)
```

## File Locations

### Config Files

```
~/.config/agi/config.json          # Global config (optional)
{
  "defaults": {
    "agent": "general",
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  },
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true }
  }
}

<project>/.agi/config.json          # Project config (optional)
{
  "defaults": {
    "agent": "build",
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

### Auth Files

```
~/.config/agi/auth.json             # Global auth (secure, 0600)
{
  "openai": {
    "type": "api",
    "key": "sk-..."
  },
  "anthropic": {
    "type": "oauth",
    "access": "...",
    "refresh": "...",
    "expires": 1234567890
  }
}
```

### Database

```
<project>/.agi/agi.sqlite           # Project-specific conversation history
```

## Environment Variables

Environment variables are read by the SDK and take highest priority:

```bash
# Provider API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...
OPENCODE_API_KEY=...

# Optional server URL (for CLI)
AGI_SERVER_URL=http://localhost:3000
```

## Security Model

### Auth File Security

1. **Global only**: Auth files are never stored in project directories
2. **Secure permissions**: Files are created with `0600` (user read/write only)
3. **Secure location**: Stored in user config directory (`~/.config/agi/`)

### Credential Injection

1. **Never in code**: SDK never hardcodes credentials
2. **Caller responsibility**: Calling code (CLI/Server) manages credentials
3. **Environment fallback**: SDK falls back to env vars if no credentials injected

## Usage Examples

### SDK Standalone (with env vars)

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

// SDK reads from environment
const model = await resolveModel('openai', 'gpt-4o-mini');

const result = await generateText({
  model,
  prompt: 'Hello'
});
```

### SDK with Injected Credentials

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

// Inject credentials explicitly
const model = await resolveModel('openai', 'gpt-4o-mini', {
  apiKey: 'sk-...'
});

const result = await generateText({
  model,
  prompt: 'Hello'
});
```

### CLI/Server with Config Files

```typescript
import { loadConfig, getAllAuth, resolveModel, generateText } from '@agi-cli/sdk';

// Load config and auth from files
const cfg = await loadConfig(process.cwd());
const auth = await getAllAuth();

// Inject from config
const model = await resolveModel(
  cfg.defaults.provider,
  cfg.defaults.model,
  { apiKey: auth[cfg.defaults.provider]?.key }
);

const result = await generateText({
  model,
  prompt: 'Hello'
});
```

### Server Standalone (No Files)

```typescript
import { createStandaloneApp } from '@agi-cli/server';

// Set env vars
process.env.OPENAI_API_KEY = 'sk-...';

// Create server without config files
const app = createStandaloneApp({
  provider: 'openai',
  model: 'gpt-4o-mini',
});

Bun.serve({ port: 3000, fetch: app.fetch });
```

### Server Embedded (Full Injection)

```typescript
import { createEmbeddedApp } from '@agi-cli/server';

// Fully injected - no files, no env vars needed
const app = createEmbeddedApp({
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  apiKey: getApiKeyFromVault(),
  agent: 'general',
});

myApp.route('/ai', app);
```

## Benefits of This Architecture

### 1. **Security**
- Credentials never stored in project directories
- Secure file permissions (0600)
- Clear separation between config and secrets

### 2. **Flexibility**
- SDK can be used standalone with env vars
- SDK can be used with explicit credential injection
- CLI manages credentials via secure global storage

### 3. **Simplicity**
- SDK has no file I/O for credentials
- Clean dependency graph: SDK → Config/Auth packages
- Each component has a single responsibility

### 4. **Portability**
- SDK works in any environment (browser, Deno, etc.)
- No assumptions about file system structure
- Credentials can come from any source

## Component Responsibilities

| Component | Responsibilities | File Operations | Injection Support |
|-----------|-----------------|-----------------|-------------------|
| **SDK** | - Accept injected credentials<br>- Fall back to env vars<br>- Provide AI functions | None (credentials) | ✅ Full |
| **Auth Package** | - Read/write auth files<br>- Manage OAuth flows<br>- Secure credential storage | ~/.config/agi/auth.json | N/A |
| **Config Package** | - Read config files<br>- Merge configurations<br>- Provide config objects | ~/.config/agi/config.json<br>.agi/config.json | N/A |
| **CLI** | - Interactive auth setup<br>- Inject config to SDK<br>- Manage user experience | None (uses Auth package) | ✅ Partial |
| **Server** | - Load config/auth OR accept injection<br>- Inject to SDK<br>- Handle API requests | Optional (Config/Auth packages) | ✅ Full |

## Summary

**The SDK is completely agnostic to how credentials are stored.** It only cares about:
1. Receiving credentials via `ModelConfig` parameter
2. Reading environment variables as fallback

**The Server now supports multiple modes:**
1. **File-based mode** (default) - Uses `@agi-cli/auth` and `@agi-cli/config` packages
2. **Standalone mode** - Reads from environment variables only
3. **Embedded mode** - Accepts fully injected configuration
4. **Per-request mode** - Config passed in API request body

**File creation and management happens in dedicated packages:**
- `@agi-cli/auth` - Manages credential files (optional for server)
- `@agi-cli/config` - Manages config files (optional for server)
- CLI - Provides user interface to these packages

This creates a clean separation where:
- The SDK remains portable and reusable
- The Server can run with or without files
- The CLI handles user-facing file management

**Use Cases Enabled:**
- ✅ Run server in CI/CD without config files
- ✅ Embed server in other applications
- ✅ Deploy to serverless/containers with env vars only
- ✅ Create GitHub bots without file system access
- ✅ Traditional desktop usage with config files
