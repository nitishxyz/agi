# Fix: Text Renders Before Reasoning Block

## Problem

When an LLM streams reasoning followed by text, the text appears **before** the reasoning block in the UI — even though reasoning was already visible. Persists after page reload.

## Root Cause

Anthropic models emit a whitespace text-delta (`"\n\n"`) **before** `reasoning-start` in the stream. The runner's text-delta handler eagerly creates a DB part for it:

```
index 0: text    "\n\n"   startedAt: 1769809210153  ← whitespace filler
index 1: reasoning        startedAt: 1769809210183  ← 30ms later
```

The text part gets index 0, reasoning gets index 1. The UI sort by index correctly puts text first — but the user expects reasoning first since it appeared first visually during streaming.

The `cleanupEmptyTextParts` at stream end only removed parts with `text === ""`, not whitespace-only content like `"\n\n"`.

## Fix

### `packages/server/src/runtime/agent/runner.ts`
- **Defer text part creation** until accumulated text has non-whitespace content
- Buffer whitespace-only text-deltas without creating a DB part or publishing
- When the first non-whitespace delta arrives, create the part (now AFTER reasoning's part was created, so it gets a higher index)
- Initialize the part with the full accumulated text (including buffered whitespace)

### `packages/server/src/runtime/session/db-operations.ts`
- Update `cleanupEmptyTextParts` to also delete whitespace-only text parts (`!t.trim()` instead of `t.length === 0`)

## Files Changed

| File | Change |
|------|--------|
| `packages/server/src/runtime/agent/runner.ts` | Defer text part creation until non-whitespace content |
| `packages/server/src/runtime/session/db-operations.ts` | Clean up whitespace-only text parts too |

## Testing

1. Use a model that emits reasoning (e.g. Claude with thinking enabled)
2. Send a message — reasoning block should appear first, text after
3. Refresh page — order should be correct (reasoning before text in DB)
4. Verify no empty/whitespace-only text parts remain in DB after stream completes
