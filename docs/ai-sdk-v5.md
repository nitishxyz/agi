[← Back to README](../README.md) • [Docs Index](./index.md)

AI SDK v5 Cheat Sheet

Purpose: quick, practical reminders for the latest AI SDK (ai@5.x) APIs we use across Bun/Node, Hono, and server contexts.

Core Imports
- From `ai`:
  - `generateText` – one-shot text generation.
  - `streamText` – server‑sent streaming text/chat.
  - `generateObject` – one‑shot structured output (Zod/standard-schema).
  - `streamObject` – streaming structured output.
  - `tool` – helper for tool/function calling.
  - `embed` – embeddings generation.
  - `rerank` – document reranking.
- From providers:
  - `import { openai } from '@ai-sdk/openai'`
  - `import { anthropic } from '@ai-sdk/anthropic'`
  - `import { google } from '@ai-sdk/google'`

Provider Setup
- Environment:
  - OpenAI: `OPENAI_API_KEY`
  - Anthropic: `ANTHROPIC_API_KEY`
  - Google: `GOOGLE_GENERATIVE_AI_API_KEY`
- Model selection examples:
  - OpenAI: `openai('gpt-4o-mini')`, `openai('o4-mini')`
  - Anthropic: `anthropic('claude-3-5-sonnet-latest')`
  - Google: `google('gemini-1.5-pro')`, `google('gemini-1.5-flash')`

Text Generation (non‑streaming)
```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text, finishReason, usage } = await generateText({
  model: openai('gpt-4o-mini'),
  // either prompt:
  prompt: 'Say hi in one sentence.',
  // or chat messages:
  // messages: [
  //   { role: 'system', content: 'Be concise.' },
  //   { role: 'user', content: 'Summarize AI SDK v5.' },
  // ],
  temperature: 0.7,
  maxTokens: 256,
});
```

Text Generation (streaming)
```ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await streamText({
  model: openai('gpt-4o-mini'),
  messages: [
    { role: 'system', content: 'Be helpful and brief.' },
    { role: 'user', content: 'Explain RAG in two lines.' },
  ],
});

// Hono/Fetch: return an SSE Response
return result.toAIStreamResponse();
```

Structured Outputs (non‑streaming)
```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

const schema = z.object({
  title: z.string(),
  tags: z.array(z.string()).default([]),
});

const { object, usage } = await generateObject({
  model: openai('gpt-4o-mini'),
  schema,
  prompt: 'Create a blog post title and 3 tags about vector databases.',
});
```

Structured Outputs (streaming)
```ts
import { streamObject } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

const schema = z.object({ steps: z.array(z.string()) });

const result = await streamObject({
  model: openai('gpt-4o-mini'),
  schema,
  prompt: 'Outline 5 steps to implement RAG.',
});

// Option 1: SSE Response
return result.toAIStreamResponse();

// Option 2: manual consumption
// for await (const delta of result.partialObjectStream) {
//   console.log('delta', delta);
// }
```

Tool / Function Calling
```ts
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const tools = {
  getWeather: tool({
    description: 'Get the current weather',
    parameters: z.object({ city: z.string() }),
    // Called automatically when model selects this tool
    execute: async ({ city }) => {
      // fetch from your weather API here
      return { city, tempC: 24, condition: 'Sunny' };
    },
  }),
};

const result = await streamText({
  model: openai('gpt-4o-mini'),
  tools,
  messages: [
    { role: 'system', content: 'You may call tools when helpful.' },
    { role: 'user', content: 'What is the weather in Paris?' },
  ],
});

return result.toAIStreamResponse();
```

Embeddings
```ts
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embedding, usage } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'The quick brown fox jumps over the lazy dog',
});
```

Reranking
```ts
import { rerank } from 'ai';
import { google } from '@ai-sdk/google';

const { results } = await rerank({
  model: google.reranker('text-multirank-1.5'),
  query: 'vector databases for RAG',
  documents: [
    'How to build a RAG pipeline with pgvector',
    'Cooking with cast iron pans',
    'Indexing strategies in Elasticsearch',
  ],
});
// results are sorted with scores in descending order
```

Multimodal (vision input)
```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4o-mini'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image.' },
        { type: 'image', image: 'https://example.com/cat.jpg' },
      ],
    },
  ],
});
```

Common Options
- `temperature`, `maxTokens`, `topP` – sampling controls.
- `system` – system prompt string (shortcut for first system message).
- `messages` – chat array (`{ role, content }[]`) or `prompt` string.
- `tools`, `toolChoice` – enable/guide function calling.
- `signal` – pass `AbortSignal` for cancellation.

Hono Route Examples
```ts
// Basic streaming chat route
import { Hono } from 'hono';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const app = new Hono();

app.post('/api/chat', async c => {
  const body = await c.req.json().catch(() => ({}));
  const messages = body?.messages ?? [
    { role: 'user', content: 'Hello there!' },
  ];

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages,
  });

  return result.toAIStreamResponse();
});

export default app;
```

Notes & Tips
- Prefer `messages` for multi‑turn and multimodal; use `prompt` for simple one‑shot tasks.
- For structured data, favor `generateObject`/`streamObject` with Zod schemas to reduce parsing errors.
- `tool` abstracts tool metadata and validation; you can also pass plain objects with `parameters` and `execute`.
- Use provider‑specific model families for embeddings/rerankers (e.g., `openai.embedding('...')`, `google.reranker('...')`).
- For streaming responses to browsers, always return `result.toAIStreamResponse()` from route handlers.
- Tracing is available via OpenTelemetry; the `ai` package integrates with `@opentelemetry/api` when configured.

