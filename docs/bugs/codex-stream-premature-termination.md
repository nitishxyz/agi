# Bug: Codex OAuth Stream Premature Termination

## Summary

When using OpenAI OAuth (Codex backend) with models like `gpt-5.3-codex` or `gpt-5.2-codex`,
the model stops working mid-task. The stream ends cleanly (no error thrown) but the model was
clearly mid-execution — it had pending tool calls and stated next steps.

## Root Cause

The Codex backend (`chatgpt.com/backend-api/codex/responses`) enforces its own output token
limits. When the model exceeds this limit mid-turn, the backend sends:

```
event: response.incomplete
data: {"type":"response.incomplete","response":{"incomplete_details":{"reason":"max_output_tokens"},...}}
```

The AI SDK (`@ai-sdk/openai` v3.0.25) treats both `response.completed` and `response.incomplete`
as terminal SSE events (`isResponseFinishedChunk` at line 5379 of the compiled source):

```js
function isResponseFinishedChunk(chunk) {
  return chunk.type === "response.completed" || chunk.type === "response.incomplete";
}
```

This maps `max_output_tokens` → `finishReason: "length"` via `mapOpenAIResponseFinishReason`.

Our runner (`packages/server/src/runtime/agent/runner.ts`) processes the `fullStream` iterator.
When the AI SDK ends the stream, the `for await` loop exits cleanly. The runner detects that
`finish` was never called and logs a warning, but does nothing else — the model dies mid-task.

## Evidence

Debug logs show:
```
[RUNNER] Stream finished. finishSeen=false, firstToolSeen=true
[RUNNER] WARNING: Stream ended without finish tool being called.
         Model was mid-execution (tools were used).
         This is likely an unclean stream termination from the provider.
```

The UI shows the model streaming text like "next I'll run a focused type/lint check." and then
stopping abruptly — the model clearly intended to continue but was cut off.

## How Codex CLI Handles This

The official Codex CLI (Rust) uses `previous_response_id` to continue interrupted responses.
When a response ends with `response.incomplete`, it sends a new request referencing the
previous response ID, allowing the model to resume from where it left off.

## Fix Plan

### Phase 1: Auto-continuation in Runner (this PR)

In `runner.ts`, after the stream loop ends:

1. Check if the stream ended prematurely: `!_finishObserved && firstToolSeen && isOpenAIOAuth`
2. If so, re-enqueue the assistant run for the same session
3. The next turn picks up the full conversation history (including tool results from this turn)
   and the model continues where it left off
4. Guard against infinite loops with a `maxContinuations` counter (default: 10)
5. Publish a `continuation` event so the UI can show "Model continuing..." feedback

### Phase 2: Future Improvements

- Use `previous_response_id` (Responses API feature) to avoid re-sending the full history
- Track token budgets across continuations to detect genuine completion vs. infinite loops
- Consider exposing continuation count in the UI

## Files Changed

- `packages/server/src/runtime/agent/runner.ts` — continuation logic after premature stream end
- `packages/server/src/runtime/session/queue.ts` — accept continuation count in RunOpts
- `docs/bugs/codex-stream-premature-termination.md` — this doc
