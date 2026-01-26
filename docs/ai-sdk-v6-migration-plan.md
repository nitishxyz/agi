# AI SDK v6 Migration Plan

## Overview

This document outlines the migration from AI SDK v5.0.43 to v6.x for the AGI CLI project.

**Estimated Effort:** 2-4 hours (core migration) + optional refactoring
**Risk Level:** Low-Medium
**Breaking Changes:** Minimal for current usage patterns

---

## Current State

### Package Versions
| Package | Current Version | Target Version |
|---------|-----------------|----------------|
| `ai` | ^5.0.43 | ^6.x |
| `@ai-sdk/anthropic` | ^2.0.16 | ^3.x (v3 spec) |
| `@ai-sdk/google` | ^2.0.14 | ^3.x (v3 spec) |
| `@ai-sdk/openai` | ^2.0.30 | ^3.x (v3 spec) |
| `@ai-sdk/openai-compatible` | ^1.0.18 | ^2.x (v3 spec) |

### Files Using AI SDK (41 files)

#### Core AI Functions
| File | Imports | Notes |
|------|---------|-------|
| `packages/server/src/runtime/agent/runner.ts` | `streamText`, `hasToolCall` | Main agent loop |
| `packages/server/src/runtime/message/service.ts` | `generateText`, `streamText` | Title generation |
| `packages/server/src/runtime/message/compaction-auto.ts` | `streamText` | Context compaction |
| `packages/server/src/routes/git/commit.ts` | `generateText` | Commit message generation |

#### History & Message Types
| File | Imports | Notes |
|------|---------|-------|
| `packages/server/src/runtime/message/history-builder.ts` | `convertToModelMessages`, `ModelMessage`, `UIMessage` | History conversion |
| `packages/server/src/runtime/message/history-truncator.ts` | `ModelMessage` | Type only |
| `packages/server/src/runtime/context/cache-optimizer.ts` | `ModelMessage` | Type only |
| `packages/server/src/runtime/context/optimizer.ts` | `ModelMessage` | Type only |

#### Error Handling
| File | Imports | Notes |
|------|---------|-------|
| `packages/server/src/runtime/errors/handling.ts` | `APICallError` | Error parsing |
| `packages/server/src/runtime/stream/error-handler.ts` | `APICallError` | Error handling |

#### Tool Definitions (28 files)
All tools use `tool()` and `Tool` type from 'ai':
- `packages/sdk/src/core/src/tools/builtin/bash.ts`
- `packages/sdk/src/core/src/tools/builtin/edit.ts`
- `packages/sdk/src/core/src/tools/builtin/finish.ts`
- `packages/sdk/src/core/src/tools/builtin/glob.ts`
- `packages/sdk/src/core/src/tools/builtin/grep.ts`
- `packages/sdk/src/core/src/tools/builtin/patch.ts`
- `packages/sdk/src/core/src/tools/builtin/progress.ts`
- `packages/sdk/src/core/src/tools/builtin/ripgrep.ts`
- `packages/sdk/src/core/src/tools/builtin/terminal.ts`
- `packages/sdk/src/core/src/tools/builtin/todos.ts`
- `packages/sdk/src/core/src/tools/builtin/websearch.ts`
- `packages/sdk/src/core/src/tools/builtin/git.ts`
- `packages/sdk/src/core/src/tools/builtin/fs/*.ts` (6 files)
- `packages/server/src/tools/database/*.ts` (6 files)
- `packages/sdk/src/skills/tool.ts`
- `packages/sdk/src/core/src/tools/loader.ts`

#### Provider Clients
| File | Imports |
|------|---------|
| `packages/sdk/src/core/src/providers/resolver.ts` | `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible` |
| `packages/server/src/runtime/provider/openai.ts` | `@ai-sdk/openai` |
| `packages/server/src/runtime/provider/anthropic.ts` | `@ai-sdk/anthropic` |
| `packages/sdk/src/providers/src/solforge-client.ts` | `@ai-sdk/openai`, `@ai-sdk/anthropic` |
| `packages/sdk/src/providers/src/opencode-client.ts` | `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible` |
| `packages/sdk/src/providers/src/google-client.ts` | `@ai-sdk/google` |
| `packages/sdk/src/providers/src/zai-client.ts` | `@ai-sdk/openai-compatible` |

#### Type Exports
| File | Exports |
|------|---------|
| `packages/sdk/src/index.ts` | `CoreMessage`, `Tool`, `ToolCallPart` |
| `packages/sdk/src/core/src/index.ts` | `CoreMessage`, `Tool` |

---

## Migration Steps

### Phase 1: Automatic Migration (Codemod)

```bash
# Run from project root
npx @ai-sdk/codemod upgrade v6
```

The codemod handles:
- Import path updates
- Renamed APIs
- Deprecated API replacements

### Phase 2: Update Dependencies

Update `package.json` (root):
```json
{
  "dependencies": {
    "@ai-sdk/anthropic": "^3.0.0",
    "@ai-sdk/google": "^3.0.0",
    "@ai-sdk/openai": "^3.0.0",
    "@ai-sdk/openai-compatible": "^2.0.0",
    "ai": "^6.0.0"
  }
}
```

Update `packages/sdk/package.json`:
```json
{
  "dependencies": {
    "@ai-sdk/anthropic": "^3.0.0",
    "@ai-sdk/google": "^3.0.0",
    "@ai-sdk/openai": "^3.0.0",
    "@ai-sdk/openai-compatible": "^2.0.0",
    "ai": "^6.0.0"
  }
}
```

### Phase 3: Fix Known Breaking Changes

#### 3.1 `experimental_providerMetadata` → `providerMetadata`

**Files to update:**
- `packages/server/src/runtime/stream/step-finish.ts` (lines 50, 59)
- `packages/server/src/runtime/stream/types.ts` (line 7)

**Change:**
```typescript
// Before
step.experimental_providerMetadata

// After
step.providerMetadata
```

#### 3.2 Verify `APICallError` API

**Files:** `packages/server/src/runtime/errors/handling.ts`

Check if `APICallError.isInstance()` method signature changed.

#### 3.3 Check `convertToModelMessages` API

**File:** `packages/server/src/runtime/message/history-builder.ts`

Verify the return type and parameter signature remain compatible.

#### 3.4 Verify `hasToolCall` function

**File:** `packages/server/src/runtime/agent/runner.ts`

Check if `hasToolCall('finish')` still works with `stopWhen`.

### Phase 4: Type Fixes

Remove `// biome-ignore lint/suspicious/noExplicitAny` comments where possible using new v6 types:

**Files with `as any` casts:**
- `packages/server/src/runtime/agent/runner.ts` (lines 167, 176-182)
- `packages/server/src/tools/adapter.ts` (multiple locations)

### Phase 5: Build & Test

```bash
# Install updated dependencies
bun install

# Type check
bun run typecheck

# Lint
bun lint

# Run tests
bun test

# Manual testing
bun run dev
```

---

## Optional Enhancements (Post-Migration)

### Enhancement 1: Adopt `ToolLoopAgent`

**Current:** Custom agent loop in `runner.ts` (~300 lines)
**New:** Use `ToolLoopAgent` class (~30 lines)

```typescript
// packages/server/src/runtime/agent/agent.ts (new file)
import { ToolLoopAgent } from 'ai';

export const createAgent = (config: AgentConfig) => new ToolLoopAgent({
  model: config.model,
  tools: config.toolset,
  system: config.system,
  stopWhen: stepCountIs(20),
});
```

**Benefits:**
- Cleaner code
- Built-in step management
- Better type safety with `InferAgentUIMessage`

**Effort:** Medium (requires refactoring runner.ts and related files)

### Enhancement 2: Add `needsApproval` to Dangerous Tools

```typescript
// packages/sdk/src/core/src/tools/builtin/bash.ts
const bash = tool({
  description: DESCRIPTION,
  inputSchema: z.object({ ... }),
  needsApproval: async ({ cmd }) => {
    const dangerous = ['rm -rf', 'sudo', 'chmod', 'dd if='];
    return dangerous.some(d => cmd.includes(d));
  },
  execute: async ({ cmd, ... }) => { ... }
});
```

**Files to update:**
- `packages/sdk/src/core/src/tools/builtin/bash.ts`
- `packages/sdk/src/core/src/tools/builtin/fs/write.ts`
- `packages/sdk/src/core/src/tools/builtin/terminal.ts`

**Effort:** Low

### Enhancement 3: Add `toModelOutput` for Token Efficiency

```typescript
// packages/sdk/src/core/src/tools/builtin/fs/read.ts
const read = tool({
  description: DESCRIPTION,
  inputSchema: z.object({ ... }),
  execute: async ({ path }) => ({ ok: true, content: fullContent }),
  toModelOutput: ({ output }) => ({
    type: 'text',
    value: output.content.length > 10000 
      ? `File content (${output.content.length} chars, truncated for context)`
      : output.content
  }),
});
```

**Files to update:**
- `packages/sdk/src/core/src/tools/builtin/fs/read.ts`
- `packages/sdk/src/core/src/tools/builtin/grep.ts`
- `packages/sdk/src/core/src/tools/builtin/ripgrep.ts`

**Effort:** Low

### Enhancement 4: Extended Usage Tracking

Update `UsageData` type to use v6's detailed breakdown:

```typescript
// packages/server/src/runtime/session/db-operations.ts
export type UsageData = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    textTokens?: number;
    reasoningTokens?: number;
  };
};
```

**Effort:** Low-Medium

### Enhancement 5: DevTools Integration

```typescript
// packages/server/src/runtime/agent/runner.ts
import { wrapLanguageModel } from 'ai';
import { devToolsMiddleware } from '@ai-sdk/devtools';

const model = wrapLanguageModel({
  model: baseModel,
  middleware: process.env.NODE_ENV === 'development' 
    ? devToolsMiddleware() 
    : undefined,
});
```

**Effort:** Low

### Enhancement 6: Provider-Specific Tools

Consider adding Anthropic's `codeExecution_20250825` for sandboxed code execution:

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const tools = {
  ...existingTools,
  codeExecution: anthropic.tools.codeExecution_20250825(),
};
```

**Effort:** Low

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Type incompatibilities | Medium | Low | Run typecheck, fix incrementally |
| `convertToModelMessages` API change | Low | Medium | Test history building thoroughly |
| `stopWhen` behavior change | Low | High | Test agent loop completion |
| Provider client breaking changes | Low | Medium | Test each provider separately |
| `APICallError` API change | Low | Low | Check error handling tests |

---

## Rollback Plan

1. Revert `package.json` changes
2. Run `bun install`
3. Revert any code changes via git

```bash
git checkout HEAD -- package.json packages/sdk/package.json
bun install
```

---

## Testing Checklist

- [ ] `bun install` succeeds
- [ ] `bun run typecheck` passes
- [ ] `bun lint` passes
- [ ] `bun test` passes
- [ ] Manual test: Start a session with Anthropic
- [ ] Manual test: Start a session with OpenAI
- [ ] Manual test: Tool execution (bash, read, write)
- [ ] Manual test: History rebuilding (multi-turn conversation)
- [ ] Manual test: Error handling (trigger an API error)
- [ ] Manual test: Token usage tracking

---

## Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Run codemod | 5 min |
| 2 | Update dependencies | 5 min |
| 3 | Fix breaking changes | 30 min |
| 4 | Type fixes | 30 min |
| 5 | Build & test | 1-2 hours |
| **Total Core Migration** | | **2-3 hours** |
| Optional | Adopt ToolLoopAgent | 2-4 hours |
| Optional | Add needsApproval | 30 min |
| Optional | Add toModelOutput | 30 min |
| Optional | DevTools integration | 15 min |

---

## References

- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6)
- [AI SDK 6 Migration Guide](https://sdk.vercel.ai/docs/migration/v6)
- [ToolLoopAgent Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/agents)
- [Tool Approval Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/tools#tool-execution-approval)
