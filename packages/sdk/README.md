# @agi-cli/sdk

AI agent SDK for building intelligent assistants with tool calling, streaming, and multi-provider support.

## Installation

```bash
npm install @agi-cli/sdk
# or
bun add @agi-cli/sdk
```

## What Can You Do With It?

The `@agi-cli/sdk` package provides the building blocks for creating AI agents with tool calling capabilities. Here's what you can build:

### 1. **Multi-Provider AI Applications**

Create apps that work with any AI provider without changing your code:

```typescript
import { resolveModel } from '@agi-cli/sdk';

// Works with OpenAI
const openaiModel = await resolveModel('openai', 'gpt-4o-mini', {
  apiKey: process.env.OPENAI_API_KEY
});

// Works with Anthropic
const anthropicModel = await resolveModel('anthropic', 'claude-sonnet-4', {
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Works with Google
const googleModel = await resolveModel('google', 'gemini-1.5-pro');

// Use with AI SDK
import { generateText } from 'ai';

const result = await generateText({
  model: openaiModel,
  prompt: 'Explain quantum computing'
});
```

**Supported Providers:**
- OpenAI (GPT-4o, GPT-4.1, etc.)
- Anthropic (Claude 3.5, Claude 4, etc.)
- Google (Gemini 1.5 Pro, Flash)
- OpenRouter (access to 100+ models)
- OpenCode (specialized code models)

---

### 2. **AI Agents with Built-in Tools**

Create agents that can interact with filesystems, run commands, search code, and more:

```typescript
import { discoverProjectTools } from '@agi-cli/sdk';
import { generateText } from 'ai';

// Discover all available tools (15+ built-in tools)
const tools = await discoverProjectTools(process.cwd());

// Convert to AI SDK format
const toolMap = Object.fromEntries(
  tools.map(({ name, tool }) => [name, tool])
);

// Create an agent that can use tools
const result = await generateText({
  model: anthropicModel,
  prompt: 'List all TypeScript files in the src/ directory',
  tools: toolMap,
  maxSteps: 10
});

console.log(result.text);
```

**Built-in Tools (15+):**
- **Filesystem:** `read`, `write`, `edit`, `ls`, `cd`, `pwd`, `tree`
- **Search:** `glob`, `grep`, `ripgrep`
- **Git:** `git_status`, `git_diff`, `git_commit`, `git_log`
- **Execution:** `bash` (run shell commands)
- **Planning:** `update_plan`, `progress_update`, `finish`
- **Patching:** `apply_patch` (apply unified diffs)

---

### 3. **Custom Tool Development**

Build custom tools that your AI agent can call:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

// Define a custom tool
const weatherTool = tool({
  description: 'Get current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius')
  }),
  async execute({ city, units }) {
    // Your tool logic here
    const weather = await fetchWeather(city, units);
    return {
      temperature: weather.temp,
      conditions: weather.conditions,
      city
    };
  }
});

// Use with your agent
const result = await generateText({
  model: anthropicModel,
  prompt: 'What\'s the weather in Tokyo?',
  tools: { weather: weatherTool },
  maxSteps: 3
});
```

**Plugin System:**

Create reusable tool plugins in `.agi/tools/`:

```javascript
// .agi/tools/database/tool.js
export default {
  name: 'query_database',
  description: 'Query the project database',
  parameters: {
    query: { type: 'string', description: 'SQL query' }
  },
  async execute({ input, fs, exec }) {
    const result = await exec('sqlite3', ['db.sqlite', input.query]);
    return { data: result.stdout };
  }
};
```

Tools are auto-discovered and loaded by `discoverProjectTools()`.

---

### 4. **Streaming Responses with Artifacts**

Stream AI responses with rich artifacts (file diffs, code blocks, etc.):

```typescript
import { streamText } from 'ai';
import { createFileDiffArtifact } from '@agi-cli/sdk';

const stream = streamText({
  model: anthropicModel,
  prompt: 'Refactor the user service',
  tools: toolMap,
  onFinish: async ({ response }) => {
    // Extract file changes
    for (const part of response.toolCalls) {
      if (part.toolName === 'edit') {
        const diff = createFileDiffArtifact(
          part.args.filePath,
          part.args.oldContent,
          part.args.newContent
        );
        console.log('File changed:', diff.path);
      }
    }
  }
});

// Stream to client
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

**Artifact Types:**
- `FileDiffArtifact` - File changes with unified diffs
- `FileArtifact` - Complete file contents
- Custom artifacts via `createToolResultPayload()`

---

### 5. **Integration Examples**

#### **Example: Code Review Bot**

```typescript
import { resolveModel, discoverProjectTools } from '@agi-cli/sdk';
import { generateText } from 'ai';

async function reviewCode(filePath: string) {
  const model = await resolveModel('anthropic', 'claude-sonnet-4');
  const tools = await discoverProjectTools(process.cwd());
  
  const result = await generateText({
    model,
    prompt: `Review the code in ${filePath} and suggest improvements`,
    tools: Object.fromEntries(tools.map(({ name, tool }) => [name, tool])),
    maxSteps: 5
  });
  
  return result.text;
}
```

#### **Example: Documentation Generator**

```typescript
async function generateDocs(srcDir: string) {
  const model = await resolveModel('openai', 'gpt-4o');
  const tools = await discoverProjectTools(process.cwd());
  
  const result = await generateText({
    model,
    prompt: `Generate API documentation for all TypeScript files in ${srcDir}`,
    tools: Object.fromEntries(tools.map(({ name, tool }) => [name, tool])),
    maxSteps: 20
  });
  
  return result.text;
}
```

#### **Example: Interactive CLI Agent**

```typescript
import { resolveModel, discoverProjectTools } from '@agi-cli/sdk';
import { generateText } from 'ai';
import * as readline from 'readline';

async function interactiveAgent() {
  const model = await resolveModel('anthropic', 'claude-sonnet-4');
  const tools = await discoverProjectTools(process.cwd());
  const toolMap = Object.fromEntries(tools.map(({ name, tool }) => [name, tool]));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const messages: any[] = [];
  
  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('You: ', resolve);
    });
    
    if (userInput === 'exit') break;
    
    messages.push({ role: 'user', content: userInput });
    
    const result = await generateText({
      model,
      messages,
      tools: toolMap,
      maxSteps: 10
    });
    
    console.log('Agent:', result.text);
    messages.push({ role: 'assistant', content: result.text });
  }
  
  rl.close();
}
```

---

### 6. **Project Configuration**

The SDK integrates with AGI's configuration system:

```typescript
import { loadConfig } from '@agi-cli/config';
import { resolveModel } from '@agi-cli/sdk';

// Load project config (.agi/config.json)
const config = await loadConfig(process.cwd());

// Use configured defaults
const model = await resolveModel(
  config.defaults.provider,
  config.defaults.model
);
```

---

## API Reference

### `resolveModel(provider, model, config?)`

Resolves an AI SDK model instance for any provider.

**Parameters:**
- `provider`: `'openai' | 'anthropic' | 'google' | 'openrouter' | 'opencode'`
- `model`: Model ID (e.g., `'gpt-4o'`, `'claude-sonnet-4'`)
- `config`: Optional configuration:
  - `apiKey?: string` - Provider API key
  - `baseURL?: string` - Custom API endpoint
  - `customFetch?: typeof fetch` - Custom fetch function

**Returns:** AI SDK model instance compatible with `generateText()`, `streamText()`, etc.

---

### `discoverProjectTools(projectRoot, globalConfigDir?)`

Discovers all available tools (built-in + custom).

**Parameters:**
- `projectRoot`: Project directory path
- `globalConfigDir`: Global config dir (defaults to `~/.config/agi`)

**Returns:** `Promise<DiscoveredTool[]>`
- Each tool has `{ name: string, tool: Tool }`
- Tools are ready to use with AI SDK

**Built-in Tools:**
- `read`, `write`, `edit` - File operations
- `ls`, `cd`, `pwd`, `tree` - Directory navigation
- `glob`, `grep`, `ripgrep` - Search
- `git_status`, `git_diff`, `git_commit`, `git_log` - Git operations
- `bash` - Execute shell commands
- `apply_patch` - Apply unified diffs
- `update_plan`, `progress_update`, `finish` - Planning and workflow

**Custom Tools:** Place in `.agi/tools/{name}/tool.js` or globally in `~/.config/agi/tools/`

---

### `createFileDiffArtifact(path, before, after)`

Creates a file diff artifact with unified diff format.

**Parameters:**
- `path`: File path
- `before`: Original content
- `after`: New content

**Returns:** `FileDiffArtifact` with path, before, after, and diff

---

### `createToolResultPayload(result, artifacts?)`

Wraps tool results with optional artifacts for streaming.

**Parameters:**
- `result`: Tool execution result
- `artifacts?`: Array of artifact objects

**Returns:** Formatted payload for streaming responses

---

## Types

```typescript
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'opencode';

export type ModelConfig = {
  apiKey?: string;
  customFetch?: typeof fetch;
  baseURL?: string;
};

export type DiscoveredTool = {
  name: string;
  tool: Tool; // AI SDK Tool type
};

export type Artifact = {
  type: string;
  [key: string]: unknown;
};

export type FileDiffArtifact = {
  type: 'file-diff';
  path: string;
  before: string;
  after: string;
  diff: string;
};

export type FileArtifact = {
  type: 'file';
  path: string;
  content: string;
};

export type ExecutionContext = {
  project: string;
  projectRoot: string;
  directory: string;
  worktree: string;
};

export type ToolResult = {
  ok: boolean;
  output?: string;
  error?: string;
  artifacts?: Artifact[];
};
```

---

## Use Cases

### What You Can Build:

1. **AI-Powered CLIs** - Interactive command-line tools with AI assistance
2. **Code Assistants** - Automated code review, refactoring, documentation
3. **Project Automation** - Smart build tools, deployment scripts, CI/CD
4. **Development Bots** - Slack/Discord bots that interact with codebases
5. **Custom Agents** - Task-specific AI agents with domain knowledge
6. **IDE Extensions** - AI-powered features for VSCode, Vim, etc.
7. **API Services** - HTTP APIs that leverage AI with tools
8. **Desktop Apps** - Electron/Tauri apps with AI capabilities

---

## Dependencies

The SDK depends on:
- `ai` - Vercel AI SDK v5
- `@ai-sdk/openai` - OpenAI provider
- `@ai-sdk/anthropic` - Anthropic provider  
- `@ai-sdk/google` - Google AI provider
- `@openrouter/ai-sdk-provider` - OpenRouter provider
- `@agi-cli/config` - Configuration management
- `@agi-cli/providers` - Provider catalog
- `zod` - Schema validation

---

## Examples Repository

Check out example projects using the SDK:

- [Code Review Bot](https://github.com/ntishxyz/agi/tree/main/examples/review-bot)
- [Documentation Generator](https://github.com/ntishxyz/agi/tree/main/examples/doc-gen)
- [Custom Agent](https://github.com/ntishxyz/agi/tree/main/examples/custom-agent)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

---

## Links

- [GitHub Repository](https://github.com/ntishxyz/agi)
- [Full CLI Documentation](https://github.com/ntishxyz/agi#readme)
- [Architecture Guide](https://github.com/ntishxyz/agi/blob/main/ARCHITECTURE.md)
- [Issue Tracker](https://github.com/ntishxyz/agi/issues)
