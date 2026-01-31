# Prompt Caching & Token Tracking Improvements

Tracked issues from code review. Reference files and line numbers current as of 2026-01-31.

---

## 1. Wire Up `addCacheControl` for Anthropic System Prompt Caching

**Status:** Not wired up  
**Impact:** High — system prompt (~30-40k tokens) is re-processed on every API call instead of being cached.

**Problem:**  
`cache-optimizer.ts` defines `addCacheControl()` which converts the system prompt to Anthropic's `cache_control: ephemeral` format and marks the second-to-last user message for caching. However, `runner.ts:156` passes `system` as a plain string to `streamText()` — the cache optimizer is never called in the request path.

**Files:**
- `packages/server/src/runtime/context/cache-optimizer.ts` — has the logic
- `packages/server/src/runtime/agent/runner.ts:156` — `streamText()` call, passes raw `system` string
- `packages/server/src/tools/adapter.ts:156-167` — tool-level caching IS wired up (2 tools get `cacheControl`)

**Fix:**  
In `runner.ts`, before the `streamText()` call, run:
```ts
import { addCacheControl } from '../context/cache-optimizer.ts';

const { system: cachedSystem, messages: cachedMessages } = addCacheControl(
  opts.provider,
  system,
  messagesWithSystemInstructions,
);
```
Then pass `cachedSystem` and `cachedMessages` to `streamText()` instead of the raw values.

**Note:** The `addCacheControl` function already handles the provider check (only applies to Anthropic), so it's safe to call unconditionally.

---

## 2. Use AI SDK v6 Native Cache Control for System Messages

**Status:** Not using native API  
**Impact:** Medium — would simplify caching and be more future-proof.

**Problem:**  
The current `addCacheControl()` manually constructs Anthropic's `cache_control` format by converting the system string to an array of `{ type: 'text', text, cache_control }` objects. AI SDK v6 supports `providerOptions.anthropic.cacheControl` natively on system messages, which is cleaner.

**Files:**
- `packages/server/src/runtime/context/cache-optimizer.ts:38-48` — manual format
- `packages/server/src/runtime/agent/runner-setup.ts` — where `providerOptions` is built

**Fix:**  
Instead of transforming the system string, pass cache control through AI SDK's provider options:
```ts
// In runner.ts streamText call
providerOptions: {
  ...providerOptions,
  anthropic: {
    ...providerOptions.anthropic,
    cacheControl: true, // AI SDK v6 handles the rest
  },
}
```
This tells the Anthropic provider to automatically add cache breakpoints. Check AI SDK v6 docs for exact API — it may support per-message `providerOptions` with `cacheControl`.

---

## 3. Split System Prompt into Stable + Dynamic Parts

**Status:** Not implemented  
**Impact:** High — would maximize cache hit rate and reduce costs significantly.

**Problem:**  
The system prompt is composed of 5-7 parts in `builder.ts`, but they're concatenated into a single string. Some parts are **stable** (same across all messages in a session) and some are **dynamic** (change per message). Caching the entire blob means any dynamic change invalidates the cache.

**Stable parts** (cacheable):
- Provider base prompt (`providerBasePrompt`)
- Base instructions (`base.txt`)
- Agent prompt
- AGENTS.md / project instructions

**Dynamic parts** (change per message):
- Environment info + project tree (first message only)
- Terminal context (changes as terminals start/stop)
- Context summary (changes after compaction)
- User context

**Files:**
- `packages/server/src/runtime/prompt/builder.ts` — `composeSystemPrompt()`
- `packages/server/src/runtime/context/environment.ts` — env + tree
- `packages/server/src/runtime/agent/runner.ts` — where system is passed to `streamText()`

**Fix:**  
Return the system prompt as an array of parts instead of a single string:
```ts
// builder.ts
return {
  stableParts: [providerPrompt, baseInstructions, agentPrompt],
  dynamicParts: [envBlock, terminalContext, contextSummary],
  components,
};
```

Then in `runner.ts`, pass system as an array to `streamText()`:
```ts
system: [
  { type: 'text', text: stablePrompt, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
  { type: 'text', text: dynamicPrompt },
]
```

This way the stable portion (~25-35k tokens) gets cached on the first call and reused for the entire session, while dynamic parts can change freely without invalidating the cache.

**Expected savings:** ~90% reduction in input token costs for Anthropic after the first message in a session (cache reads are 10% the cost of regular input).

---

## Done (this session)

### Fix: `getModelLimits` now uses catalog instead of hardcoded list

**File:** `packages/server/src/runtime/message/compaction-limits.ts`

The hardcoded 9-model list was replaced with a lookup against the SDK's model catalog (60+ models with limits). This means overflow detection now works for ALL models in the catalog, not just the 9 that were hardcoded. Without this, sessions using unlisted models (e.g., newer Claude/GPT variants) would never trigger overflow protection, allowing context to grow unbounded.

### Note: `currentContextTokens` formula is correct

The formula `stepInput + stepCached + stepCacheCreation` is correct because after `normalizeUsage()`:
- **Anthropic:** `inputTokens` = non-cached tokens (Anthropic's `input_tokens` excludes cache hits/writes)
- **OpenAI:** `inputTokens` = `prompt_tokens - cached` (normalization subtracts cached for OpenAI)

In both cases, `inputTokens` represents only the non-cached portion, so summing all three gives the true context window size.

**Potential issue for proxy providers:** If `resolveUsageProvider()` fails to identify the underlying provider (model not found in catalog for openrouter/setu), OpenAI-style responses won't have cached tokens subtracted, leading to double-counting. This is mitigated by keeping the catalog up to date.
