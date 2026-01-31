# Prompt Caching & Context Tracking Improvements

Tracked items from session review on 2026-01-31.

## 1. Wire Up `addCacheControl` for Anthropic

**Status:** Not wired up

**Problem:**
`packages/server/src/runtime/context/cache-optimizer.ts` defines `addCacheControl()` which converts the system prompt into Anthropic's `cache_control: ephemeral` format and marks the second-to-last user message as cacheable. However, `runner.ts:156` passes `system` as a plain string to `streamText()` — `addCacheControl` is never called in the request path.

Tool-level caching IS wired up in `packages/server/src/tools/adapter.ts:156-167` (caches `read` and `write` tool definitions via `providerOptions.anthropic.cacheControl`), but the system prompt and message-level caching is not.

**Fix:**
In `runner.ts`, before the `streamText()` call, apply cache optimization:

```ts
import { addCacheControl } from '../context/cache-optimizer.ts';

// Before streamText:
const { system: cachedSystem, messages: cachedMessages } = addCacheControl(
  opts.provider,
  system,
  messagesWithSystemInstructions,
);
```

Then pass `cachedSystem` and `cachedMessages` to `streamText()` instead of the raw values.

**Alternative:** AI SDK v6 supports `providerOptions.anthropic.cacheControl` on system messages natively. Could refactor to use that instead of the raw `cache_control` block format.

**Files:**
- `packages/server/src/runtime/agent/runner.ts` — needs to call `addCacheControl`
- `packages/server/src/runtime/context/cache-optimizer.ts` — the existing implementation
- `packages/server/src/tools/adapter.ts` — already does tool-level caching (reference)

**Note:** The `addCacheControl` function checks `system.length > 1024` (characters, not tokens). The comment says "1024+ tokens" but checks `.length` which is chars. This is fine since 1024 chars ≈ 256 tokens, well under the Anthropic minimum of 1024 tokens for caching. May want to adjust the threshold to `1024 * 4 = 4096` chars to match the actual 1024-token minimum.

---

## 2. Split System Prompt into Stable + Dynamic Parts

**Status:** Not started

**Problem:**
The system prompt is composed from 5-7 parts in `packages/server/src/runtime/prompt/builder.ts`:
1. Provider base prompt (stable per provider)
2. `base.txt` (stable)
3. Agent prompt (stable per agent)
4. Environment + project tree (dynamic — first message only)
5. User context (dynamic)
6. Context summary (dynamic — after compaction)
7. Terminal context (dynamic)

Parts 1-3 are identical across all messages in a session. If these were sent as a separate cacheable system block, Anthropic would cache them automatically after the first request, saving ~30k+ tokens of input cost on every subsequent turn.

**Fix:**
Structure the system prompt as an array of content blocks for Anthropic:

```ts
// Stable block (cacheable)
{ type: 'text', text: stablePrompt, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }

// Dynamic block (changes per turn)
{ type: 'text', text: dynamicPrompt }
```

This way the stable prefix gets cached and only the dynamic suffix is re-processed.

**Files:**
- `packages/server/src/runtime/prompt/builder.ts` — split return into stable/dynamic
- `packages/server/src/runtime/agent/runner.ts` — pass structured system to streamText

---

## 3. Remove `isOverflow` Function — Rely on API Error Detection

**Status:** Not started

**Problem:**
`packages/server/src/runtime/message/compaction-limits.ts` defines `isOverflow()` which calculates:
```ts
const count = tokens.input + (tokens.cacheRead ?? 0) + (tokens.cacheWrite ?? 0) + tokens.output;
const usableContext = limits.context - limits.output;
return count > usableContext;
```

This calculation is wrong/unreliable:
- It adds `cacheRead + cacheWrite` to input, which double-counts (cached tokens are already part of `input` in Anthropic's reporting)
- The `getModelLimits()` hardcoded map is incomplete and will drift out of date
- It subtracts `limits.output` from context, but that's not how providers enforce limits

Meanwhile, `runner.ts:300-310` already catches the actual API error (`prompt is too long`, `context_length_exceeded`, etc.) and calls `pruneSession()` as a recovery. This is the correct and reliable approach.

**Fix:**
1. Remove `isOverflow()` from `compaction-limits.ts`
2. Remove the overflow check in `finish-handler.ts:109` that calls `isOverflow` then `pruneSession`
3. Keep the error-based compaction in `runner.ts` catch block — it's already the primary path
4. Optionally keep `getModelLimits()` if needed elsewhere, but don't use it for overflow detection

**Files:**
- `packages/server/src/runtime/message/compaction-limits.ts` — remove `isOverflow`
- `packages/server/src/runtime/stream/finish-handler.ts:95-120` — remove overflow check block
- `packages/server/src/runtime/agent/runner.ts:300-340` — keep as-is (this is the correct path)
