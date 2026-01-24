# SDK Architecture - Single Source of Truth

## Overview

The `@agi-cli/sdk` package is the **single, tree-shakable source of truth** for all AGI CLI functionality. All authentication, configuration, providers, prompts, tools, and core AI functionality are included in this package.

## Package Structure

The SDK contains all functionality internally:

```
@agi-cli/sdk/src/
├── auth/           ← Authentication (OAuth, API keys)
├── config/         ← Configuration (global + project)
├── core/           ← Core AI functionality
│   ├── providers/     (model resolution)
│   ├── tools/         (builtin tools)
│   ├── streaming/     (artifacts)
│   └── errors.ts      (error classes)
├── prompts/        ← System prompts
├── providers/      ← Provider catalog & utilities
└── index.ts        ← Main exports
```

## Related Packages

```
@agi-cli/
├── sdk/            ← Core SDK (this package)
├── database/       ← SQLite persistence (depends on sdk)
├── server/         ← HTTP API (depends on sdk, database)
├── api/            ← Type-safe API client (standalone)
├── web-sdk/        ← React hooks & components (depends on api)
├── web-ui/         ← Pre-built static assets (standalone)
└── install/        ← npm installer (standalone)
```

## Import Strategy

### ✅ Recommended: SDK-First

```typescript
// Everything from one place
import { 
  generateText,           // Core AI
  resolveModel,          // Provider resolution
  catalog,               // Provider catalog
  getAuth,               // Authentication
  loadConfig,            // Configuration
  providerBasePrompt,    // Prompts
} from '@agi-cli/sdk';

import type { 
  ProviderId,            // Types
  ModelInfo,
  AGIConfig,
  AuthInfo
} from '@agi-cli/sdk';
```

## Tree-Shaking

The SDK uses **named exports**, making it fully tree-shakable:

```typescript
// Only generateText and its dependencies are bundled
import { generateText } from '@agi-cli/sdk';

// Catalog, auth, database NOT included ✅
```

### Bundle Size Example

```typescript
// Minimal import
import { generateText, resolveModel } from '@agi-cli/sdk';

// Estimated bundle: ~150KB (minified)
// Includes: AI SDK, provider resolution, minimal deps
// Excludes: Catalog (large), database, server, auth
```

```typescript
// Full import
import { 
  generateText,
  catalog,        // +200KB (all model data)
  loadConfig,     // +20KB (config management)
} from '@agi-cli/sdk';

// Estimated bundle: ~370KB (minified)
```

## Export Organization

The SDK organizes exports into logical sections:

### 1. Types
- `ProviderId`, `ModelInfo`
- `AuthInfo`, `OAuth`, `ApiAuth`, `AuthFile`
- `AGIConfig`, `ProviderConfig`, `Scope`

### 2. Providers
- `catalog` - Complete model catalog
- `isProviderId`, `providerIds` - Provider helpers
- `isProviderAuthorized` - Authorization checks
- `validateProviderModel` - Validation
- `estimateModelCostUsd` - Cost estimation
- `providerEnvVar`, `readEnvKey`, `setEnvKey` - Environment

### 3. Authentication
- `getAuth`, `setAuth`, `removeAuth`, `getAllAuth`
- `authorize`, `exchange`, `refreshToken`
- `openAuthUrl`, `createApiKey`

### 4. Configuration
- `loadConfig`, `readConfig`

### 5. Prompts
- `providerBasePrompt`

### 6. Core AI Functions

#### AI SDK Re-exports
- `generateText`, `streamText`
- `generateObject`, `streamObject`
- `tool`
- `CoreMessage`, `Tool` (types)

#### Provider & Model Resolution
- `resolveModel`
- `ProviderName`, `ModelConfig` (types)

#### Tools
- `discoverProjectTools`
- `buildFsTools`, `buildGitTools`
- `DiscoveredTool` (type)

#### Streaming & Artifacts
- `createFileDiffArtifact`, `createToolResultPayload`
- `Artifact`, `FileDiffArtifact`, `FileArtifact` (types)

#### Error Handling
- `AGIError`, `AuthError`, `ConfigError`
- `ToolError`, `ProviderError`, `DatabaseError`
- `ValidationError`, `NotFoundError`, `ServiceError`

#### Schema Validation
- `z` (zod re-export)

## Usage Examples

### Basic Agent
```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

const model = resolveModel('anthropic', 'claude-sonnet-4-20250514');
const { text } = await generateText({ model, prompt: 'Hello!' });
```

### Agent with Tools
```typescript
import { 
  streamText, 
  resolveModel, 
  buildFsTools, 
  buildGitTools 
} from '@agi-cli/sdk';

const tools = { ...buildFsTools(), ...buildGitTools() };
const { textStream } = streamText({
  model: resolveModel('openai', 'gpt-4o'),
  prompt: 'What files are in this directory?',
  tools
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

### With Configuration
```typescript
import { generateText, resolveModel, loadConfig } from '@agi-cli/sdk';

const config = await loadConfig();
const model = resolveModel(config.provider, config.model);

const { text } = await generateText({
  model,
  prompt: 'Hello!',
  temperature: config.temperature
});
```

## Type Safety

All types are exported and fully documented:

```typescript
import type { 
  // Provider types
  ProviderId,
  ModelInfo,
  
  // Auth types
  AuthInfo,
  OAuth,
  
  // Config types
  AGIConfig,
  ProviderConfig,
  
  // AI types
  CoreMessage,
  Tool,
  
  // Tool types
  DiscoveredTool,
  
  // Artifact types
  Artifact,
  FileDiffArtifact,
} from '@agi-cli/sdk';
```

## Benefits

### 1. Developer Experience
- **One package to learn** - no need to know internal boundaries
- **Consistent imports** - always `from '@agi-cli/sdk'`
- **Auto-complete friendly** - IDE shows all exports
- **Type-safe** - full TypeScript support

### 2. Architecture
- **Zero circular dependencies** - clean, unidirectional flow
- **Clear separation** - types → utilities → core
- **Maintainable** - easy to understand and extend
- **Testable** - modules can be tested in isolation

### 3. Performance
- **Tree-shakable** - only bundle what you use
- **Lazy loading** - import on demand
- **Small bundles** - modern bundlers optimize well
- **Fast builds** - TypeScript can skip unused modules

## Summary

The `@agi-cli/sdk` is the **single, tree-shakable source of truth** for AGI CLI:

- ✅ All functionality in one place
- ✅ Tree-shakable named exports
- ✅ Zero circular dependencies
- ✅ Comprehensive TypeScript support
- ✅ Excellent developer experience

**Use the SDK for all application code.**
