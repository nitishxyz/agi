# API

[← Back to README](../README.md) • [Docs Index](./index.md)

The otto server exposes a generated OpenAPI document and a versioned HTTP API.

## Source of truth

Use these in order:

1. `packages/api/openapi.json`
2. `GET /openapi.json`
3. `@ottocode/api`

Do not treat this page as a complete route listing; it is a guide to the current API shape.

## Base routes

- `GET /` — simple root response (`otto server running`)
- `GET /openapi.json` — generated OpenAPI spec
- `GET /v1/server/info` — server metadata and runtime info

Operational routes live under **`/v1/*`**.

## Main route groups

The current OpenAPI spec exposes route groups including:

- `ask`
- `auth`
- `config`
- `doctor`
- `files`
- `git`
- `mcp`
- `provider-usage`
- `research`
- `sessions`
- `ottorouter`
- `shares`
- `skills`
- `terminals`
- `tunnel`

## Representative routes

### Ask

- `POST /v1/ask`

### Sessions

- `GET /v1/sessions`
- `POST /v1/sessions`
- `GET /v1/sessions/{sessionId}`
- `POST /v1/sessions/{id}/messages`
- `GET /v1/sessions/{id}/stream`
- `POST /v1/sessions/{sessionId}/abort`
- `POST /v1/sessions/{sessionId}/branch`
- `POST /v1/sessions/{sessionId}/share`

### Config

- `GET /v1/config`
- `GET /v1/config/defaults`
- `GET /v1/config/providers`
- `GET /v1/config/models`
- `GET /v1/config/agents`

### Files

- `GET /v1/files`
- `POST /v1/files/read`
- `POST /v1/files/tree`

### Git

- `GET /v1/git/status`
- `POST /v1/git/diff`
- `POST /v1/git/commit`
- `POST /v1/git/stage`
- `POST /v1/git/unstage`
- `POST /v1/git/push`
- `POST /v1/git/pull`

### Auth

- `GET /v1/auth/status`
- `POST /v1/auth/{provider}`
- `POST /v1/auth/{provider}/oauth/start`
- `POST /v1/auth/{provider}/oauth/exchange`
- `GET /v1/auth/{provider}/oauth/callback`

### Terminals

- `GET /v1/terminals`
- `POST /v1/terminals`
- `GET /v1/terminals/{id}`
- `POST /v1/terminals/{id}/input`
- `GET /v1/terminals/{id}/output`

### Skills

- `GET /v1/skills`
- `GET /v1/skills/{name}`
- `GET /v1/skills/{name}/files`
- `GET /v1/skills/{name}/files/{filePath}`
- `POST /v1/skills/validate`

## SSE streaming

Streaming is used for ask/session workflows. The most important stream route is:

- `GET /v1/sessions/{id}/stream`

Common event types include:

- `assistant.delta`
- `assistant`
- `tool.call`
- `tool.result`
- `tool.approval.required`
- `finish-step`
- `usage`
- `error`

Exact event payloads should be derived from the OpenAPI/client implementation rather than copied manually into downstream apps.

## Client guidance

If you are building a first-party or external client:

- prefer `@ottocode/api` over handwritten `fetch`
- treat `/openapi.json` as the authoritative contract
- assume versioned operational routes are under `/v1/*`
