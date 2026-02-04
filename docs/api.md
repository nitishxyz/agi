# API

[← Back to README](../README.md) • [Docs Index](./index.md)

When running in server mode (`otto serve`), a REST API is available.

## REST Endpoints

- `GET /openapi.json` — OpenAPI specification
- `GET /health` — Health check endpoint
- `GET /sessions` — List all sessions
- `POST /sessions` — Create new session
- `GET /sessions/:id` — Get session details
- `POST /sessions/:id/messages` — Send message (SSE streaming response)

## SSE Streaming Events

The server streams responses as Server-Sent Events with these event types:

- `assistant.delta` — Incremental text chunks from the assistant
- `tool.call` — Tool invocation notification
- `tool.result` — Tool execution result
- `plan.updated` — The agent has published or updated its plan
- `finish-step` — Step boundary with `{ usage, finishReason, response }`
- `usage` — Token usage statistics (may emit per-step)
- `error` — Error messages
