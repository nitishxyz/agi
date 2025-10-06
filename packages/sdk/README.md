# @agi-cli/sdk

> **The single source of truth for AGI CLI functionality** - Comprehensive, tree-shakable, and developer-friendly.

## Overview

`@agi-cli/sdk` is the unified SDK for building AI agents with AGI CLI. It re-exports all functionality from the underlying packages (`@agi-cli/core`, `@agi-cli/providers`, `@agi-cli/auth`, etc.) in a tree-shakable way.

**Why use the SDK?**
- ✅ **Single import**: All functionality from one package
- ✅ **Tree-shakable**: Bundlers only include what you use
- ✅ **Type-safe**: Full TypeScript support with comprehensive types
- ✅ **Zero circular dependencies**: Clean architecture
- ✅ **Consistent API**: No need to remember which package exports what

## Installation

```bash
bun add @agi-cli/sdk
```

## Quick Start

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';
import type { ProviderId } from '@agi-cli/sdk';

const model = resolveModel('anthropic', 'claude-3-5-sonnet-20241022');

const { text } = await generateText({
  model,
  prompt: 'What is the meaning of life?',
});

console.log(text);
```

## What's Included?

### Types (from `@agi-cli/types`)

All shared types are available:

```typescript
import type { 
  ProviderId, 
  ModelInfo, 
  AuthInfo, 
  AGIConfig,
  ProviderConfig,
  Scope
} from '@agi-cli/sdk';
```

### Providers (from `@agi-cli/providers`)

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
} from '@agi-cli/sdk';

// Check available providers
console.log(providerIds); // ['openai', 'anthropic', 'google', 'openrouter', 'opencode']

// Get model information
const models = catalog.anthropic.models;

// Validate provider/model combination
const result = validateProviderModel('anthropic', 'claude-3-5-sonnet-20241022');
```

### Authentication (from `@agi-cli/auth`)

Manage API keys and OAuth:

```typescript
import { 
  getAuth, 
  setAuth, 
  removeAuth, 
  getAllAuth,
  authorize,
  createApiKey 
} from '@agi-cli/sdk';

// Set API key
await setAuth('openai', { apiKey: 'sk-...' });

// Get auth info
const auth = await getAuth('openai');

// OAuth flow
const url = await authorize('anthropic');
console.log(`Visit: ${url}`);
```

### Configuration (from `@agi-cli/config`)

Load and manage configuration:

```typescript
import { loadConfig, readConfig } from '@agi-cli/sdk';
import type { AGIConfig } from '@agi-cli/sdk';

const config = await loadConfig();
console.log(config.provider); // 'anthropic'
console.log(config.model);    // 'claude-3-5-sonnet-20241022'
```

### Prompts (from `@agi-cli/prompts`)

Pre-built system prompts:

```typescript
import { systemPrompt, codeContext } from '@agi-cli/sdk';

const prompt = systemPrompt('dev', {
  workdir: '/home/user/project',
  platform: 'linux',
});

const context = codeContext({ includeGitInfo: true });
```

### Core AI Functions (from `@agi-cli/core`)

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
} from '@agi-cli/sdk';
import type { CoreMessage, Tool, DiscoveredTool } from '@agi-cli/sdk';

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

### Database (from `@agi-cli/database`)

Database access:

```typescript
import { getDb, dbSchema } from '@agi-cli/sdk';

const db = getDb();
const messages = await db.select().from(dbSchema.messages);
```

### Server (from `@agi-cli/server`)

Create an HTTP server:

```typescript
import { createServer } from '@agi-cli/sdk';

const app = createServer();
```

### Error Handling (from `@agi-cli/core`)

Typed error classes:

```typescript
import { 
  AGIError, 
  AuthError, 
  ConfigError, 
  ToolError,
  ProviderError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ServiceError
} from '@agi-cli/sdk';

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
import { generateText, resolveModel } from '@agi-cli/sdk';
```

## Direct Package Access (Not Recommended)

While you _can_ import directly from individual packages, we recommend using the SDK for consistency:

```typescript
// ❌ Discouraged - fragmented imports
import { catalog } from '@agi-cli/providers';
import { generateText } from '@agi-cli/core';
import type { ProviderId } from '@agi-cli/types';

// ✅ Recommended - single source of truth
import { catalog, generateText } from '@agi-cli/sdk';
import type { ProviderId } from '@agi-cli/sdk';
```

## Architecture

The SDK follows a clean dependency graph with zero circular dependencies:

```
@agi-cli/types (foundation)
    ↓
@agi-cli/providers, @agi-cli/auth, @agi-cli/config
    ↓
@agi-cli/database, @agi-cli/prompts
    ↓
@agi-cli/core
    ↓
@agi-cli/server
    ↓
@agi-cli/sdk ← YOU ARE HERE (single source of truth)
```

## Examples

### Basic Agent

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

const model = resolveModel('anthropic');

const { text } = await generateText({
  model,
  prompt: 'Explain TypeScript generics',
});

console.log(text);
```

### Agent with Tools

```typescript
import { streamText, resolveModel, buildFsTools, buildGitTools } from '@agi-cli/sdk';

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
import { generateObject, resolveModel, z } from '@agi-cli/sdk';

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
import { generateText, resolveModel, loadConfig } from '@agi-cli/sdk';

const config = await loadConfig();
const model = resolveModel(config.provider, config.model);

const { text } = await generateText({
  model,
  prompt: 'Hello from AGI CLI!',
  temperature: config.temperature,
});
```

## TypeScript

Full TypeScript support with comprehensive types:

```typescript
import type { 
  ProviderId, 
  ModelInfo, 
  AGIConfig,
  CoreMessage,
  Tool,
  DiscoveredTool,
  Artifact,
  ExecutionContext
} from '@agi-cli/sdk';

// All types are fully documented and type-safe
const providerId: ProviderId = 'anthropic';
const config: AGIConfig = await loadConfig();
```

## License

MIT

## Contributing

See the main repository for contribution guidelines.
