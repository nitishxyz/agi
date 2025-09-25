[← Back to README](../README.md) • [Docs Index](./index.md)

# Streaming Overhaul (AI SDK v5)

Purpose: adopt AI SDK v5 streaming callbacks to make assistant streaming, DB persistence, and SSE events more robust and observable without breaking existing clients.

Scope
- Keep the centralized runner driving model streaming and DB writes.
- Preserve existing route semantics (`POST /v1/sessions/:id/messages` enqueues a run; `GET /v1/sessions/:id/stream` provides SSE for the session).
- Maintain tool pipeline and events in the tool adapter.
- Add step-aware callbacks for cleaner boundaries and better usage reporting.

Key Changes
- Runner uses `streamText` v5 callbacks:
  - `onStepFinish`: marks the current assistant text part complete, emits a step event, and starts a new text part for the next step.
  - `onFinish`: finalizes the assistant message, usage, latency, and cost and emits `message.completed`.
  - `onError`: persists error and emits `error`.
  - `onAbort`: emits `error` with an "aborted" message (message status set to `error`).
- Remove text-part rotation tied to `tool.result` events; rotation now follows step boundaries via `onStepFinish`.
- Continue to stream text deltas via `result.textStream` for incremental DB updates and `message.part.delta` events.
- Introduce two non-breaking SSE events for observability:
  - `finish-step` — payload: `{ usage, finishReason, response }`.
  - `usage` — payload: per-step usage (optional, mirrors `finish-step.usage`).

- Step Indexing
  - Add `stepIndex` (0-based) to all assistant segments and tool events.
  - DB: new nullable column `message_parts.step_index` (no backfill, alpha stage).
  - SSE payloads include `stepIndex` on `message.part.delta`, `finish-step`, `usage`, `tool.call`, `tool.delta`, and `tool.result`.

Design Notes
- Tools remain managed by the adapter. Tool call/result events and DB writes are unchanged to prevent duplication.
- Step boundaries (assistant → tools → assistant) are cleaner when rotating parts on `onStepFinish` rather than `tool.result`.
- Existing clients keep working; new events are additive and can be ignored by older clients.

Implementation Outline
1) Event Types
   - Extend `AGIEventType` with `'finish-step' | 'usage'`.

2) Runner
   - Pass `onStepFinish`, `onFinish`, `onError`, `onAbort` to `streamText`.
   - On step finish: close current part (`completedAt`), emit `finish-step` (and `usage`), create a fresh assistant text part and reset in-memory accumulator.
   - On finish: finalize message (status, usage, total tokens, latency), close last part, emit `message.completed`.
   - On error/abort: persist error and emit `error`.
   - Keep `for await (const delta of result.textStream)`; persist deltas and emit `message.part.delta` as today.
   - Maintain a `stepIndex` counter; include it in events and set on new text parts.

3) Docs
   - README: list the additional SSE events.
   - agi-plan: describe the step events under Streaming & Events.

Non-Goals (this pass)
- Persist reasoning parts or provider metadata into the DB schema.
- Change tool adapter behavior.
- Replace the session-wide SSE bus with `toAIStreamResponse()` per request.

Rollout
- Changes are backwards-compatible at the SSE layer.
- No schema changes required; no migrations.
 - For step indexing, a new migration adds `message_parts.step_index`. Reset DB in alpha (`bun run db:reset`) or recreate to apply.
