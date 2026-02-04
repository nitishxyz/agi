# @ottocode/sdk

> **The single source of truth for ottocode functionality** - Comprehensive, tree-shakable, and developer-friendly.

## Overview

`@ottocode/sdk` is the unified SDK for building AI agents with ottocode. All authentication, configuration, providers, prompts, tools, and core AI functionality are included in this single package.

**Why use the SDK?**
- ✅ **Single import**: All functionality from one package
- ✅ **Tree-shakable**: Bundlers only include what you use
- ✅ **Type-safe**: Full TypeScript support with comprehensive types
- ✅ **Zero circular dependencies**: Clean architecture
- ✅ **Consistent API**: No need to remember which module exports what

## Installation

```bash
bun add @ottocode/sdk
```

## Quick Start

```typescript
import { generateText, resolveModel } from '@ottocode/sdk';
import type { ProviderId } from '@ottocode/sdk';

const model = resolveModel('anthropic', 'claude-sonnet-4-20250514');

const { text } = await generateText({
  model,
  prompt: 'What is the meaning of life?',
});

console.log(text);
```

## What's Included?

### Types

All shared types are available:

```typescript
import type { 
  ProviderId, 
  ModelInfo, 
  AuthInfo, 
  OttoConfig,
  ProviderConfig,
  Scope
} from '@ottocode/sdk';
```

### Providers

Provider catalog and utilities:

```typescript
import { 
  catalog,
  isProviderId,
  providerIds,
  defaultModelFor,
  hasModel,
  isProviderAuthorized,
  validateProviderModel,
  estimateModelCostUsd,
  providerEnvVar,
  readEnvKey,
  setEnvKey
} from '@ottocode/sdk';

// Check available providers
console.log(providerIds); // ['openai', 'anthropic', 'google', 'openrouter', 'opencode', 'setu']

// Get model information
const models = catalog.anthropic.models;

// Validate provider/model combination
const result = validateProviderModel('anthropic', 'claude-sonnet-4-20250514');
```

### Authentication

Manage API keys and OAuth:

```typescript
import { 
  getAuth, 
  setAuth, 
  removeAuth, 
  getAllAuth,
  authorize,
  createApiKey 
} from '@ottocode/sdk';

// Set API key
await setAuth('openai', { apiKey: 'sk-...' });

// Get auth info
const auth = await getAuth('openai');

// OAuth flow
const url = await authorize('anthropic');
console.log(`Visit: ${url}`);
```

### Configuration

Load and manage configuration:

```typescript
import { loadConfig } from '@ottocode/sdk';
import type { OttoConfig } from '@ottocode/sdk';

const config = await loadConfig();
console.log(config.provider); // 'anthropic'
console.log(config.model);    // 'claude-sonnet-4-20250514'
```

### Prompts

Pre-built system prompts:

```typescript
import { providerBasePrompt } from '@ottocode/sdk';

const prompt = providerBasePrompt('anthropic');
```

### Core AI Functions

AI SDK re-exports and utilities:

```typescript
import { 
  generateText, 
  streamText, 
  generateObject, 
  streamObject,
  tool,
  resolveModel,
  discoverProjectTools,
  buildFsTools,
  buildGitTools,
  createFileDiffArtifact,
  z
} from '@ottocode/sdk';
import type { CoreMessage, Tool, DiscoveredTool } from '@ottocode/sdk';

// Generate text
const { text } = await generateText({
  model: resolveModel('anthropic'),
  prompt: 'Hello!',
});

// Stream text with tools
const { textStream } = streamText({
  model: resolveModel('openai'),
  prompt: 'What files are in the current directory?',
  tools: buildFsTools(),
});

// Generate structured output
const { object } = await generateObject({
  model: resolveModel('anthropic'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  prompt: 'Generate a person',
});

// Discover project tools
const tools = await discoverProjectTools('/path/to/project');
```

### Error Handling

Typed error classes:

```typescript
import { 
  OttoError, 
  AuthError, 
  ConfigError, 
  ToolError,
  ProviderError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ServiceError
} from '@ottocode/sdk';

try {
  // ... your code
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  }
}
```

## Tree-Shaking

The SDK is fully tree-shakable. Modern bundlers (Vite, Rollup, esbuild, webpack) will only include the code you actually use:

```typescript
// Only includes generateText and resolveModel code
import { generateText, resolveModel } from '@ottocode/sdk';
```

## Architecture

The SDK contains all functionality internally:

```
@ottocode/sdk/src/
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

Related packages:
- `@ottocode/database` - SQLite persistence (depends on sdk)
- `@ottocode/server` - HTTP API (depends on sdk, database)
- `@ottocode/api` - Type-safe API client (standalone)
- `@ottocode/web-sdk` - React hooks & components (depends on api)

## Examples

### Basic Agent

```typescript
import { generateText, resolveModel } from '@ottocode/sdk';

const model = resolveModel('anthropic');

const { text } = await generateText({
  model,
  prompt: 'Explain TypeScript generics',
});

console.log(text);
```

### Agent with Tools

```typescript
import { streamText, resolveModel, buildFsTools, buildGitTools } from '@ottocode/sdk';

const tools = {
  ...buildFsTools(),
  ...buildGitTools(),
};

const { textStream } = streamText({
  model: resolveModel('openai'),
  prompt: 'What Git branch am I on? List the files in the current directory.',
  tools,
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

### Structured Output

```typescript
import { generateObject, resolveModel, z } from '@ottocode/sdk';

const schema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
});

const { object } = await generateObject({
  model: resolveModel('anthropic'),
  schema,
  prompt: 'Analyze: "This SDK is amazing!"',
});

console.log(object);
// { sentiment: 'positive', confidence: 0.95, keywords: ['amazing', 'SDK'] }
```

### With Configuration

```typescript
import { generateText, resolveModel, loadConfig } from '@ottocode/sdk';

const config = await loadConfig();
const model = resolveModel(config.provider, config.model);

const { text } = await generateText({
  model,
  prompt: 'Hello from ottocode!',
  temperature: config.temperature,
});
```

## TypeScript

Full TypeScript support with comprehensive types:

```typescript
import type { 
  ProviderId, 
  ModelInfo, 
  OttoConfig,
  CoreMessage,
  Tool,
  DiscoveredTool,
  Artifact
} from '@ottocode/sdk';

// All types are fully documented and type-safe
const providerId: ProviderId = 'anthropic';
const config: OttoConfig = await loadConfig();
```

## License

MIT

## Contributing

See the main repository for contribution guidelines.
