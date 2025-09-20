Tools and Artifacts

Summary
- Author tools using AI SDK v5 `tool({ inputSchema, execute })`.
- The adapter persists tool calls/results into the DB and emits SSE events.
- For code/file changes, return an `artifact` with a consistent shape.

Authoring a tool
```ts
// .agi/tools/greeter/tool.ts
import { tool } from 'ai';
import { z } from 'zod';

export default tool({
  description: 'Greet a name',
  inputSchema: z.object({ name: z.string() }),
  async execute({ name }) {
    return { message: `Hello, ${name}!` };
  },
});
```

Returning file diffs
```ts
import { tool } from 'ai';
import { z } from 'zod';
import { createFileDiffArtifact } from '@/ai/artifacts.ts';

export default tool({
  description: 'Propose a change to README.md',
  inputSchema: z.object({}),
  async execute() {
    const patch = `*** Begin Patch\n*** Update File: README.md\n@@\n-Old line\n+New line\n*** End Patch\n`;
    return {
      result: { changed: ['README.md'] },
      artifact: createFileDiffArtifact(patch, { files: 1, additions: 1, deletions: 1 }),
    };
  },
});
```

What gets persisted
- On tool call: a `tool_call` message part with `{ name, args }`.
- On tool result: a `tool_result` message part with `{ name, result?, artifact? }`.
- If the tool streams output (AsyncIterable), the adapter emits `tool.delta` SSE events per chunk and persists the final `tool_result` once finished.

SSE events
- `tool.call` — `{ name, args, stepIndex }`
- `tool.delta` — `{ name, channel: 'input'|'output', delta, stepIndex }`
- `tool.result` — `{ name, result?, artifact?, stepIndex }`

Guidelines
- Prefer returning a single `artifact` object for diffs; keep it small and self‑contained.
- Use unified patch format inside `artifact.patch` for maximum compatibility with renderers.
- For very large diffs, consider chunking or follow-up tools to fetch details.
