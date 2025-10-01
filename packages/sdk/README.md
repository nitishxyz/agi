# @agi-cli/sdk

**Batteries-included AI agent SDK.** Build AI assistants with tools, streaming, and multi-provider support in minutes.

## Installation

```bash
npm install @agi-cli/sdk
# or
bun add @agi-cli/sdk
```

**That's it. No need to install `ai`, `@ai-sdk/anthropic`, `hono`, or anything else.** Everything is included.

---

## Quick Start

### 1. Simple AI Call

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

const model = await resolveModel('anthropic', 'claude-sonnet-4');

const result = await generateText({
  model,
  prompt: 'Explain quantum computing in one sentence'
});

console.log(result.text);
```

### 2. AI Agent with Tools

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

const model = await resolveModel('anthropic', 'claude-sonnet-4');
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: 'List all TypeScript files and count total lines',
  tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
  maxSteps: 10
});

console.log(result.text);
```

**That's it!** Your agent now has access to:
- File operations (read, write, edit, ls, tree)
- Code search (glob, grep, ripgrep)
- Git operations (status, diff, commit, log)
- Shell execution (bash)
- And more...

### 3. HTTP Server

```typescript
import { createServer } from '@agi-cli/sdk';

const app = createServer();

// Start server
export default {
  port: 3000,
  fetch: app.fetch
};
```

Run it:
```bash
bun run server.ts
```

Your agent is now available at `http://localhost:3000` with:
- `POST /ask` - Ask questions
- `GET /sessions` - List sessions
- `GET /openapi.json` - OpenAPI spec
- And more...

---

## Complete Examples

### Example 1: Code Review Bot

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

async function reviewFile(filePath: string) {
  const model = await resolveModel('anthropic', 'claude-sonnet-4');
  const tools = await discoverProjectTools(process.cwd());
  
  const result = await generateText({
    model,
    prompt: `Review ${filePath} for code quality, security, and best practices. Provide specific suggestions.`,
    tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
    maxSteps: 10
  });
  
  return result.text;
}

// Usage
const review = await reviewFile('src/auth.ts');
console.log(review);
```

### Example 2: Interactive Agent

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

async function interactiveAgent() {
  const model = await resolveModel('openai', 'gpt-4o');
  const tools = await discoverProjectTools(process.cwd());
  const toolMap = Object.fromEntries(tools.map(t => [t.name, t.tool]));
  
  const messages = [];
  
  while (true) {
    const userInput = prompt('You: ');
    if (userInput === 'exit') break;
    
    messages.push({ role: 'user', content: userInput });
    
    const result = await generateText({
      model,
      messages,
      tools: toolMap,
      maxSteps: 15
    });
    
    console.log('Agent:', result.text);
    messages.push({ role: 'assistant', content: result.text });
  }
}

interactiveAgent();
```

### Example 3: Streaming Responses

```typescript
import { streamText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

async function streamingAgent(prompt: string) {
  const model = await resolveModel('google', 'gemini-1.5-pro');
  const tools = await discoverProjectTools(process.cwd());
  
  const stream = streamText({
    model,
    prompt,
    tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
    maxSteps: 10
  });
  
  // Stream to console
  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }
}

streamingAgent('Refactor the authentication module for better security');
```

### Example 4: Custom Tool

```typescript
import { generateText, resolveModel, discoverProjectTools, tool, z } from '@agi-cli/sdk';

// Define custom tool
const weatherTool = tool({
  description: 'Get weather for a city',
  parameters: z.object({
    city: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius')
  }),
  execute: async ({ city, units }) => {
    const data = await fetch(`https://api.weather.com/${city}`).then(r => r.json());
    return { temperature: data.temp, city, units };
  }
});

// Use with agent
const model = await resolveModel('anthropic', 'claude-sonnet-4');
const builtinTools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: 'What\'s the weather in Tokyo and New York?',
  tools: {
    ...Object.fromEntries(builtinTools.map(t => [t.name, t.tool])),
    weather: weatherTool
  },
  maxSteps: 5
});

console.log(result.text);
```

### Example 5: HTTP API Server

```typescript
import { createServer, generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

const app = createServer();

// Add custom route
app.post('/custom-ask', async (c) => {
  const { prompt } = await c.req.json();
  
  const model = await resolveModel('anthropic', 'claude-sonnet-4');
  const tools = await discoverProjectTools(process.cwd());
  
  const result = await generateText({
    model,
    prompt,
    tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
    maxSteps: 10
  });
  
  return c.json({ response: result.text });
});

export default {
  port: 3000,
  fetch: app.fetch
};
```

---

## Built-in Tools (15+)

Your agent has access to these tools automatically:

### File Operations
- `read` - Read file contents
- `write` - Write to files
- `edit` - Edit files with diff-based changes
- `ls` - List directory contents
- `cd` - Change directory
- `pwd` - Print working directory
- `tree` - Show directory tree

### Search & Find
- `glob` - Find files by pattern (e.g., `*.ts`)
- `grep` - Search file contents
- `ripgrep` - Fast content search (if installed)

### Git Operations
- `git_status` - Show git status
- `git_diff` - Show git diff
- `git_commit` - Create commit
- `git_log` - Show git log

### Execution
- `bash` - Run shell commands

### Planning
- `update_plan` - Update task plan
- `progress_update` - Report progress
- `finish` - Mark task complete

---

## Supported Providers

Switch providers without changing code:

```typescript
// OpenAI
const model = await resolveModel('openai', 'gpt-4o-mini');

// Anthropic
const model = await resolveModel('anthropic', 'claude-sonnet-4');

// Google
const model = await resolveModel('google', 'gemini-1.5-pro');

// OpenRouter (100+ models)
const model = await resolveModel('openrouter', 'anthropic/claude-3.5-sonnet');

// OpenCode (specialized code models)
const model = await resolveModel('opencode', 'qwen3-coder-14b');
```

Set API keys via environment variables:
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_GENERATIVE_AI_API_KEY=...
```

Or pass directly:
```typescript
const model = await resolveModel('openai', 'gpt-4o', {
  apiKey: 'sk-...'
});
```

---

## Configuration

The SDK integrates with AGI's configuration system:

```typescript
import { loadConfig, readConfig } from '@agi-cli/sdk';

// Load config from .agi/config.json
const config = await loadConfig(process.cwd());

console.log(config.defaults);
// { agent: 'general', provider: 'anthropic', model: 'claude-sonnet-4' }

// Use configured defaults
const model = await resolveModel(
  config.defaults.provider,
  config.defaults.model
);
```

---

## Custom Tools (Plugins)

Create reusable tools in `.agi/tools/{name}/tool.js`:

```javascript
// .agi/tools/database/tool.js
export default {
  name: 'query_database',
  description: 'Query the database',
  parameters: {
    query: {
      type: 'string',
      description: 'SQL query to execute'
    }
  },
  async execute({ input, exec, fs }) {
    const result = await exec('sqlite3', ['db.sqlite', input.query]);
    return {
      success: true,
      data: result.stdout
    };
  }
};
```

Tools are auto-discovered by `discoverProjectTools()`.

**Available helpers in `execute()`:**
- `input` - Tool parameters
- `exec(cmd, args)` - Run shell commands
- `fs.readFile(path)` - Read files
- `fs.writeFile(path, content)` - Write files
- `fs.exists(path)` - Check file exists
- `project` / `projectRoot` / `directory` - Path info
- `env` - Environment variables

---

## Database & Sessions

Store conversation history:

```typescript
import { getDb, dbSchema } from '@agi-cli/sdk';

const db = await getDb(process.cwd());

// Query sessions
const sessions = await db.select().from(dbSchema.sessions).limit(10);

// Query messages
const messages = await db
  .select()
  .from(dbSchema.messages)
  .where(eq(dbSchema.messages.sessionId, sessionId));
```

---

## Authentication

Manage provider credentials:

```typescript
import { getAllAuth, setAuth, getAuth } from '@agi-cli/sdk';

// Get all stored credentials
const auth = await getAllAuth();

// Set API key
await setAuth('openai', {
  type: 'api',
  key: 'sk-...'
});

// Get provider auth
const openaiAuth = await getAuth('openai');
```

---

## What Can You Build?

1. **AI-Powered CLIs** - Interactive command-line tools
2. **Code Assistants** - Review, refactor, document code
3. **Project Automation** - Smart build tools, deployment scripts
4. **Development Bots** - Slack/Discord bots for codebases
5. **Custom Agents** - Task-specific AI agents
6. **IDE Extensions** - AI features for editors
7. **API Services** - HTTP APIs with AI + tools
8. **Desktop Apps** - Electron/Tauri apps with AI
9. **Documentation Generators** - Auto-generate docs
10. **Testing Tools** - AI-powered test generation

---

## API Reference

### Core Functions

#### `generateText(options)`
Generate text with optional tools.

```typescript
const result = await generateText({
  model,              // Model from resolveModel()
  prompt: string,     // Or use 'messages' for multi-turn
  tools?: object,     // Optional tools
  maxSteps?: number,  // Max tool calls (default: 1)
  temperature?: number,
  maxTokens?: number
});
```

#### `streamText(options)`
Stream text generation.

```typescript
const stream = streamText({
  model,
  prompt: string,
  tools?: object,
  maxSteps?: number
});

for await (const chunk of stream.textStream) {
  console.log(chunk);
}
```

#### `generateObject(options)`
Generate structured JSON.

```typescript
const result = await generateObject({
  model,
  schema: z.object({ ... }),
  prompt: string
});
```

#### `streamObject(options)`
Stream structured JSON generation.

---

### Provider Functions

#### `resolveModel(provider, model, config?)`
Get model instance.

```typescript
const model = await resolveModel(
  'anthropic',          // Provider
  'claude-sonnet-4',   // Model ID
  { apiKey: '...' }    // Optional config
);
```

#### `catalog`
Provider/model catalog.

```typescript
import { catalog } from '@agi-cli/sdk';

// List all providers
console.log(Object.keys(catalog));
// ['openai', 'anthropic', 'google', ...]

// List OpenAI models
console.log(catalog.openai.models.map(m => m.id));
```

---

### Tool Functions

#### `discoverProjectTools(projectRoot, globalConfigDir?)`
Discover all available tools.

```typescript
const tools = await discoverProjectTools(process.cwd());

// Convert to object for generateText()
const toolMap = Object.fromEntries(
  tools.map(t => [t.name, t.tool])
);
```

#### `tool(definition)`
Create custom tool.

```typescript
import { tool, z } from '@agi-cli/sdk';

const myTool = tool({
  description: 'Tool description',
  parameters: z.object({ ... }),
  execute: async (params) => { ... }
});
```

---

### Server Functions

#### `createServer()`
Create HTTP server.

```typescript
const app = createServer();

// The server includes:
// - POST /ask - Ask questions
// - GET /sessions - List sessions
// - GET /sessions/:id/messages - Get messages
// - GET /openapi.json - OpenAPI spec
```

---

### Configuration Functions

#### `loadConfig(projectRoot?)`
Load AGI configuration.

```typescript
const config = await loadConfig(process.cwd());
// Returns: { defaults, providers, paths }
```

#### `readConfig(projectRoot?)`
Load config + auth.

```typescript
const { cfg, auth } = await readConfig(process.cwd());
```

---

### Database Functions

#### `getDb(projectRoot?)`
Get database instance.

```typescript
const db = await getDb(process.cwd());

// Use with Drizzle ORM
import { dbSchema } from '@agi-cli/sdk';
const sessions = await db.select().from(dbSchema.sessions);
```

---

## Types

All types are exported:

```typescript
import type {
  // AI SDK types
  CoreMessage,
  Tool,
  
  // Provider types
  ProviderName,
  ProviderId,
  ModelInfo,
  ModelConfig,
  
  // Tool types
  DiscoveredTool,
  
  // Config types
  AGIConfig,
  ProviderConfig,
  Scope,
  
  // Auth types
  AuthInfo,
  OAuth,
  
  // Other types
  ExecutionContext,
  ToolResult,
  Artifact,
  FileDiffArtifact
} from '@agi-cli/sdk';
```

---

## Environment Variables

```bash
# Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...
OPENCODE_API_KEY=...

# Optional
AGI_DEBUG_TOOLS=1  # Debug tool loading
```

---

## Why Use This SDK?

### ✅ **Batteries Included**
Everything you need in one package. No need to install `ai`, provider packages, or anything else.

### ✅ **Zero Configuration**
Works out of the box. Add config only if you need it.

### ✅ **15+ Built-in Tools**
File operations, Git, search, bash - ready to use.

### ✅ **Multi-Provider**
Switch between OpenAI, Anthropic, Google without code changes.

### ✅ **HTTP Server Included**
Create API endpoints in seconds.

### ✅ **Extensible**
Add custom tools easily with the plugin system.

### ✅ **Type-Safe**
Full TypeScript support with exported types.

---

## License

MIT - see [LICENSE](../../LICENSE)

---

## Links

- [GitHub](https://github.com/ntishxyz/agi)
- [Documentation](https://github.com/ntishxyz/agi#readme)
- [Architecture](https://github.com/ntishxyz/agi/blob/main/ARCHITECTURE.md)
- [Issues](https://github.com/ntishxyz/agi/issues)
