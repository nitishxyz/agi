# Basic CLI Bot Example

A simple question-answering agent that demonstrates the core AGI SDK functionality.

## What It Does

This example creates a minimal CLI bot that:
- Accepts a question as a command-line argument
- Uses the AGI SDK to process it with an AI model
- Returns the answer to stdout

## Prerequisites

- Bun (or Node.js 18+)
- An API key for Anthropic, OpenAI, or Google

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set your API key:**
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   # or
   export OPENAI_API_KEY=sk-...
   # or
   export GOOGLE_GENERATIVE_AI_API_KEY=...
   ```

## Usage

```bash
# Ask a question
bun run index.ts "What is TypeScript?"

# Or with a different provider
PROVIDER=openai MODEL=gpt-4o bun run index.ts "Explain async/await"
```

## Code Walkthrough

```typescript
import { generateText, resolveModel } from '@agi-cli/sdk';

// Get question from command line (default to "Hello!")
const question = process.argv[2] || 'Hello!';

// Get provider/model from env or use defaults
const provider = process.env.PROVIDER || 'anthropic';
const modelId = process.env.MODEL || 'claude-sonnet-4';

// Resolve the model instance
const model = await resolveModel(provider, modelId);

// Generate a response
const result = await generateText({
  model,
  prompt: question
});

// Output the result
console.log(result.text);
```

## Key Concepts

### 1. Model Resolution
```typescript
const model = await resolveModel('anthropic', 'claude-sonnet-4');
```
The `resolveModel` function handles provider-specific configuration and returns a ready-to-use model instance.

### 2. Text Generation
```typescript
const result = await generateText({
  model,
  prompt: 'Your question here'
});
```
`generateText` is the simplest way to get a response from an AI model.

### 3. Environment Variables
The SDK automatically reads API keys from standard environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

## Extending This Example

### Add Streaming

```typescript
import { streamText, resolveModel } from '@agi-cli/sdk';

const model = await resolveModel('anthropic', 'claude-sonnet-4');
const stream = streamText({
  model,
  prompt: question
});

// Stream to console
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Add Tools

```typescript
import { generateText, resolveModel, discoverProjectTools } from '@agi-cli/sdk';

const model = await resolveModel('anthropic', 'claude-sonnet-4');
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: question,
  tools: Object.fromEntries(tools.map(t => [t.name, t.tool])),
  maxSteps: 5
});
```

### Add Conversation History

```typescript
const messages = [
  { role: 'user', content: 'Hi!' },
  { role: 'assistant', content: 'Hello! How can I help?' },
  { role: 'user', content: question }
];

const result = await generateText({
  model,
  messages
});
```

## Next Steps

- Try the [Code Review Tool](../code-review-tool/) example to see tool usage
- Explore [Project Scaffolder](../project-scaffolder/) for file generation
- Check the [SDK README](../../packages/sdk/README.md) for full API reference
