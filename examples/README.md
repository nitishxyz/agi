# AGI Examples

This directory contains real-world examples demonstrating how to use AGI CLI and the `@agi-cli/sdk` package.

## Available Examples

### 1. [Basic CLI Bot](./basic-cli-bot/)
A simple question-answering agent that uses AGI to answer questions via the command line.

**Use case:** Quick AI interactions, one-off questions  
**Difficulty:** Beginner  
**Demonstrates:** Basic `generateText` usage, model resolution

### 2. [Code Review Tool](./code-review-tool/)
Automated code review bot that analyzes files for code quality, security, and best practices.

**Use case:** CI/CD integration, pre-commit hooks  
**Difficulty:** Intermediate  
**Demonstrates:** File operations, custom prompts, multi-step reasoning

### 3. [Project Scaffolder](./project-scaffolder/)
AI-powered project template generator that creates boilerplate code based on descriptions.

**Use case:** Quick project setup, learning new frameworks  
**Difficulty:** Intermediate  
**Demonstrates:** File writing, directory structures, template generation

### 4. [Git Commit Helper](./git-commit-helper/)
Smart commit message generator that analyzes git diffs and suggests conventional commit messages.

**Use case:** Developer workflow automation  
**Difficulty:** Beginner  
**Demonstrates:** Git integration, structured output with `generateObject`

### 5. [Documentation Generator](./documentation-generator/)
Automatically generates markdown documentation from TypeScript/JavaScript code.

**Use case:** Documentation maintenance, API docs  
**Difficulty:** Advanced  
**Demonstrates:** AST parsing, streaming, artifact generation

## Running Examples

Each example has its own directory with a README and can be run independently:

```bash
cd examples/basic-cli-bot
bun install
bun run index.ts
```

## Prerequisites

All examples require:
- Bun runtime (or Node.js 18+)
- API key for at least one AI provider (OpenAI, Anthropic, Google)

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

## Creating Your Own Example

1. **Create a new directory:**
   ```bash
   mkdir examples/my-example
   cd examples/my-example
   ```

2. **Initialize package.json:**
   ```bash
   bun init
   ```

3. **Install the SDK:**
   ```bash
   bun add @agi-cli/sdk
   ```

4. **Create your script:**
   ```typescript
   // index.ts
   import { generateText, resolveModel } from '@agi-cli/sdk';
   
   const model = await resolveModel('anthropic', 'claude-sonnet-4');
   const result = await generateText({
     model,
     prompt: 'Your prompt here'
   });
   
   console.log(result.text);
   ```

5. **Run it:**
   ```bash
   bun run index.ts
   ```

## Example Templates

### Simple CLI Tool

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

async function main() {
  const question = process.argv[2] || 'Hello!';
  
  const model = await resolveModel('anthropic', 'claude-sonnet-4');
  const result = await generateText({
    model,
    prompt: question
  });
  
  console.log(result.text);
}

main();
```

### Agent with Tools

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

async function main() {
  const model = await resolveModel('anthropic', 'claude-sonnet-4');
  const tools = await discoverProjectTools(process.cwd());
  
  const result = await generateText({
    model,
    prompt: 'Analyze the codebase and suggest improvements',
    tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
    maxSteps: 10
  });
  
  console.log(result.text);
}

main();
```

### HTTP Server

```typescript
import { createServer } from '@agi-cli/sdk';

const app = createServer();

// Add custom routes
app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  port: 3000,
  fetch: app.fetch
};
```

## Contributing Examples

We welcome new examples! To contribute:

1. Create a new directory under `examples/`
2. Add a clear README explaining the use case
3. Keep dependencies minimal
4. Add comments explaining key concepts
5. Test thoroughly with multiple providers
6. Submit a PR

## License

All examples are MIT licensed. Feel free to use them as starting points for your own projects!
