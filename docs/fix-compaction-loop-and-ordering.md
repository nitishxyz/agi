# Fix: Auto-Compaction Loop and Summary Appearing at Top

## Problems

### 1. Compaction summary jumps to top of response
When auto-compaction triggers mid-response, the summary text appears **before** existing reasoning/text parts because it's inserted at `index: 0` on the same assistant message.

### 2. Compaction infinite loop
Auto-compaction can loop endlessly because:
- Compaction inserts summary on the **same** message that triggered the overflow
- `markSessionCompacted` skips the last 2 user turns and only compacts messages **before** the compact message's `createdAt`
- The current message's bloated tool_call/tool_result parts are **never compacted**
- Retry → still too long → compaction again → loop

### 3. No retry limit
There's no counter to cap compaction retries, so even edge cases loop forever.

## Root Cause

`error-handler.ts` calls `performAutoCompaction()` which inserts a compaction summary part at `index: 0` on the **current** assistant message (`opts.assistantMessageId`), then retries with a new message. The current message's tool results (the actual bloat) are never eligible for compaction.

## Fix: Break → Compact → Retry

Instead of compacting on the same message, **complete the current message first**, then trigger compaction as a separate step:

### Step 1: Complete/break the current message
- Mark current assistant message as `complete` (it already has content — reasoning, text, tool results)
- Publish `message.completed`

### Step 2: Trigger compaction as separate message
- Create a new assistant message for the compaction summary
- Run `performAutoCompaction()` on this **new** message
- Now `markSessionCompacted` sees the just-completed message's tool results as compaction candidates

### Step 3: Retry with fresh message
- Create another new assistant message for the actual retry
- Enqueue it

### Step 4: Safety net — retry counter
- Add `compactionRetries?: number` to `RunOpts`
- Pass `(opts.compactionRetries ?? 0) + 1` through `enqueueAssistantRun`
- Guard at top: if `compactionRetries >= 2`, skip compaction and emit error

## Files Changed

| File | Change |
|------|--------|
| `packages/server/src/runtime/stream/error-handler.ts` | Rewrite compaction block: complete current msg → new msg for compact → retry with counter |
| `packages/server/src/runtime/message/compaction-auto.ts` | Remove hardcoded `index: 0`; accept message ID as param (already does); use `nextIndex` or query max |
| `packages/server/src/runtime/session/queue.ts` | Add `compactionRetries?: number` to `RunOpts` |

## Testing

1. Trigger context overflow (long conversation or large tool results)
2. Verify compaction summary appears as its own message (not mixed into the error message)
3. Verify the retry succeeds (bloated content from previous message is now compacted)
4. Verify max 2 retries — after that, error is surfaced to user
5. Verify no infinite loop under any condition
