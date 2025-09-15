AGI Server Plan

Summary
- Build a server-first AGI package that any client can talk to over HTTP/SSE.
- Centralize all AI work on the server using AI SDK v5; switch among OpenAI, Anthropic, and Google providers per request.
- Store sessions, messages, and message parts in SQLite (via Drizzle) per project, under `.agi/agi.sqlite`.
- Provide a CLI: `agi serve` to run the server and `agi "<prompt>"` for one‑shot usage.
- Expose a versioned OpenAPI (`/openapi.json`) and REST endpoints for sessions/messages and streaming.
- Support default agents (general, build, plan) with gated tools, plus project‑specific agent/tool extensions via config files and prompt files.
- No auth required initially (local/dev usage).

Non‑Goals (v0)
- No client SDKs yet (web, VSCode, TUI). We focus on server + CLI and solid APIs.
- No persistence beyond local SQLite per project. No cloud DB.
- No auth, RBAC, or multi‑tenant concerns.

Tech Stack
- Runtime: Bun (single executable binary later via `bun build`).
- Framework: Hono (HTTP + SSE friendly).
- AI: AI SDK v5 (`ai@5.x`) with `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`.
- DB: SQLite (per project) with Drizzle ORM + migrations.
- Tests: `bun test` unit/integration. Scripts for manual smoke tests.

Architecture Overview
- Server process starts on a random available port (or user‑specified), prints URL to stdout.
- Clients connect via HTTP endpoints and SSE streams per session.
- Provider+model+agent are chosen by the client and validated by the server; credentials live server‑side via env/config.
- Messages and tool calls stream back over SSE; the server persists all interactions.
- OpenAPI spec is versioned and served from the running server for client generation.

Directory Structure
- `src/server/` — Hono app, routes, handlers, SSE utilities
- `src/ai/` — provider manager, agent registry, tool registry, prompts glue
- `src/db/` — Drizzle module (see DB Module Layout below)
- `src/config/` — config loader/merger (global + project)
- `src/openapi/` — OpenAPI spec and helpers
- `src/cli/` — CLI commands (`serve`, `ask`)
  - `src/cli/setup.ts` — interactive first-run setup (providers/models/API keys)
- `tests/` — unit and integration tests
- `scripts/` — manual test scripts (curl/bun scripts)
- `.agi/` — project data and config:
  - `.agi/agi.sqlite` (SQLite database)
  - `.agi/config.json` (project config: defaults, provider enablement)
  - `.agi/agents.json` (project agent registry overrides/additions)
  - `.agi/agents/<agent>/agent.txt` (agent system prompt override)
  - `.agi/tools/<tool>/tool.ts` (user tool implementation)
  - `.agi/tools/<tool>/prompt.txt` (optional tool prompt/context)

Config & Precedence
- Precedence: project `.agi/config.json` > global `~/.config/agi/config.json` > environment variables.
- Provider credentials are only read server‑side (never accepted from clients):
  - OpenAI: `OPENAI_API_KEY`
  - Anthropic: `ANTHROPIC_API_KEY`
  - Google: `GOOGLE_GENERATIVE_AI_API_KEY`
- Example `.agi/config.json`:
```json
{
  "defaultAgent": "general",
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o-mini",
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true },
    "google": { "enabled": true }
  }
}
```

Agents & Tools
- Built-in agents (default set):
  - `general` — safe defaults, minimal or no tools by default.
  - `build` — for code/build tasks; gated write/shell tools (initially empty; scaffolded).
  - `plan` — for planning/task breakdown; read‑only tools (initially empty; scaffolded).
- Agent prompt loading precedence:
  1) Project override: `.agi/agents/<agent>/agent.txt`
  2) Built‑in default prompt embedded in server
- Project extensions via `.agi/agents.json` to map agents to allowed tools and prompt paths.
- Example `.agi/agents.json`:
```json
{
  "general": {
    "tools": ["search", "fs.read"],
    "prompt": ".agi/agents/general/agent.txt"
  },
  "build": {
    "tools": ["fs.read", "fs.write", "shell.run"],
    "prompt": ".agi/agents/build/agent.txt"
  },
  "custom-repo": {
    "tools": ["custom-tool"],
    "prompt": ".agi/agents/custom-repo/agent.txt"
  }
}
```
- Tool interface for built‑in and user tools (TypeScript):
```ts
// src/ai/types.ts
export interface ToolContext {
  projectRoot: string;
  db: any; // drizzle db client
  logger?: (msg: string, meta?: unknown) => void;
}

export interface AITool<TParams = any, TResult = any> {
  name: string;
  description: string;
  parameters: import('zod').ZodType<TParams>;
  execute: (args: TParams, ctx: ToolContext) => Promise<TResult>;
}
```
- User tool example (`.agi/tools/custom-tool/tool.ts`):
```ts
import { z } from 'zod';
import type { AITool, ToolContext } from '../../../src/ai/types';

const tool: AITool<{ path: string }, { size: number }> = {
  name: 'custom-tool',
  description: 'Get file size at a path',
  parameters: z.object({ path: z.string() }),
  async execute({ path }, ctx: ToolContext) {
    const fs = await import('node:fs/promises');
    const stat = await fs.stat(path);
    return { size: stat.size };
  }
};

export default tool;
```
- The server discovers tools from:
  1) Built‑in registry (`src/ai/tools/*`).
  2) Project registry: `.agi/tools/*/tool.ts` dynamically imported via Bun.
  Allowed tools for an agent are enforced using the merged agent config.

Tool Call Results, Diffs, and Artifacts
- Goal: persist and stream rich tool outputs (including code/file changes) in a normalized way so UIs can render and optionally apply them.
- Message parts remain the canonical event unit. We extend conventions for `content` JSON while keeping the `type` column stable.
- `message_parts.type` includes `tool_call` and `tool_result`. Structured payloads under `content`:
  - `type: 'tool_call'` content:
    ```json
    {
      "name": "fs.write",
      "args": { "path": "src/app.ts", "data": "..." },
      "startedAt": 1736960000000
    }
    ```
  - `type: 'tool_result'` content (generic):
    ```json
    {
      "name": "fs.write",
      "ok": true,
      "result": { "path": "src/app.ts", "bytes": 1024 },
      "finishedAt": 1736960001234
    }
    ```
  - `type: 'tool_result'` content (with file diff artifact):
    ```json
    {
      "name": "apply_patch",
      "ok": true,
      "artifact": {
        "kind": "file_diff",
        "patchFormat": "unified",
        "patch": "*** Begin Patch\n*** Update File: src/app.ts\n@@\n- old\n+ new\n*** End Patch\n",
        "summary": { "files": 1, "additions": 1, "deletions": 1 }
      }
    }
    ```
- Patch format: prefer a self‑contained unified patch similar to our `apply_patch` envelope so clients can render/apply it. Multi‑file patches are supported.
- Large outputs/binaries: store as artifacts on disk to avoid DB bloat.
  - Location: `.agi/artifacts/<uuid>`; metadata embedded in `tool_result.content`:
    ```json
    {
      "name": "shell.run",
      "ok": true,
      "artifact": {
        "kind": "file",
        "id": "5c33...",
        "path": ".agi/artifacts/5c33.../out.log",
        "mime": "text/plain",
        "size": 4096,
        "sha256": "..."
      }
    }
    ```
  - Retention: artifacts live alongside the project and are referenced by message parts for reproducibility.
- Streaming conventions (SSE):
  - `tool.call` — emitted at start with name/args.
  - `tool.delta` — optional incremental updates (e.g., stdout/stderr lines or patch chunks): `{ chunk: "...", channel: "stdout" | "stderr" | "patch" }`.
  - `tool.result` — emitted at completion with `ok`, `result` and/or `artifact` summary.
- OpenAPI: define discriminated unions for message part `content` using a `kind` (or inferred by `type`), so clients can strongly type tool results and diffs.
- Helpers:
  - `createToolCallPart(name, args)` and `createToolResultPart({ name, ok, result?, artifact? })` utilities in `src/ai/parts.ts`.
  - `createFileDiffArtifact(patch: string, summary)` for inline patches; spill to `.agi/artifacts` when large.

Database Schema (Drizzle + SQLite)
- `sessions`
  - `id` TEXT (uuid primary key)
  - `title` TEXT
  - `agent` TEXT
  - `project_path` TEXT
  - `created_at` INTEGER (unix ms)
- `messages`
  - `id` TEXT (uuid pk)
  - `session_id` TEXT (fk -> sessions.id)
  - `role` TEXT ('system'|'user'|'assistant'|'tool')
  - `status` TEXT ('pending'|'complete'|'error')
  - `created_at` INTEGER
- `message_parts`
  - `id` TEXT (uuid pk)
  - `message_id` TEXT (fk -> messages.id)
  - `index` INTEGER
  - `type` TEXT ('text'|'tool_call'|'tool_result'|'image'|'error')
  - `content` TEXT (JSON string)
- Indexes on `sessions(id)`, `messages(session_id)`, `message_parts(message_id)`

Drizzle Relations
- Use Drizzle's `references` and `relations` to model links and enable eager loading:
```ts
// src/db/schema/sessions.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  agent: text('agent').notNull(),
  projectPath: text('project_path').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

export const sessionsRelations = relations(sessions, ({ many }) => ({
  messages: many(messages),
}));

// src/db/schema/messages.ts
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

export const messagesRelations = relations(messages, ({ one, many }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
  parts: many(messageParts),
}));

// src/db/schema/message-parts.ts
export const messageParts = sqliteTable('message_parts', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  type: text('type').notNull(),
  content: text('content', { mode: 'json' }).notNull(),
});

export const messagePartsRelations = relations(messageParts, ({ one, one: oneRel }) => ({
  message: one(messages, { fields: [messageParts.messageId], references: [messages.id] }),
  // optional: artifact 1:1 relation
  artifact: oneRel(artifacts, {
    fields: [messageParts.id],
    references: [artifacts.messagePartId],
  }),
}));

// src/db/schema/artifacts.ts (optional)
export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  messagePartId: text('message_part_id').unique().references(() => messageParts.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'file' | 'file_diff' | ...
  path: text('path'),
  mime: text('mime'),
  size: integer('size'),
  sha256: text('sha256'),
});

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  part: one(messageParts, { fields: [artifacts.messagePartId], references: [messageParts.id] }),
}));
```
- This enables queries like: `db.query.sessions.findMany({ with: { messages: { with: { parts: true } } } })`.

DB Module Layout (Drizzle)
- Location: `src/db/`
- Files:
  - `src/db/index.ts` — DB client creation, connection helpers.
  - `src/db/schema/index.ts` — re‑exports of schema.
  - `src/db/schema/sessions.ts` — `sessions` table (id, title, agent, project_path, created_at).
  - `src/db/schema/messages.ts` — `messages` table (id, session_id, role, status, created_at).
  - `src/db/schema/message-parts.ts` — `message_parts` table (id, message_id, index, type, content JSON).
  - `src/db/schema/artifacts.ts` (optional) — metadata for large artifacts stored under `.agi/artifacts`.
  - `src/db/types/index.ts` — shared types (infers types from Drizzle schema if desired).
- Notes:
  - Migrations stored/generated under `src/db/migrations` or `.agi/migrations` (we can choose `.agi/migrations` to keep project data colocated).
  - Keep schema modular: one file per domain, re‑export via `schema/index.ts`.

Provider/Model Selection
- Client request includes: `{ provider, model, agent, options? }`.
- Server resolves credentials from config/env, validates provider is enabled, then instantiates the correct AI SDK model.
- Default fallbacks from `.agi/config.json` if fields are omitted.

Streaming & Events
- Primary streaming mechanism: AI SDK’s `streamText(...).toAIStreamResponse()`.
- SSE endpoint per session emits structured events for UI clients:
  - `session.created` — payload: session
  - `message.created` — payload: message
  - `message.part.delta` — payload: { partId, type, delta }
  - `message.completed` — payload: message with final parts
  - `tool.call` — payload: { name, args }
  - `tool.result` — payload: { name, result }
  - `error` — payload: { message }

API Endpoints (v1)
- `GET /openapi.json` — serve OpenAPI spec.
- `GET /v1/sessions` — list sessions.
- `POST /v1/sessions` — create session `{ title?, agent? }` → session.
- `GET /v1/sessions/:id/messages` — list messages with parts.
- `POST /v1/sessions/:id/messages` — post user message `{ content, provider?, model?, agent?, options? }` and stream assistant reply via SSE if `Accept: text/event-stream`, or return once complete if JSON.
- `GET /v1/sessions/:id/stream` — subscribe to SSE events for that session.
- `POST /v1/one-shot` — ephemeral one‑shot generation `{ prompt|messages, provider?, model?, agent? }` → streamed or JSON response.

OpenAPI
- Define spec in `src/openapi/spec.ts` (typed builder) and serve serialized JSON at `/openapi.json`.
- Keep versioning in paths (`/v1/*`) and in spec `info.version`.

CLI
- `agi serve [--port <n>] [--db <path>] [--project <path>]`
  - Starts server on random available port if `--port` not provided.
  - Uses DB at `.agi/agi.sqlite` in project or provided path.
- `agi "<prompt>" [--agent <name>] [--provider <p>] [--model <m>] [--project <path>]`
  - Starts ephemeral server (or reuses local instance if detected), creates a session, sends a message, prints streamed output to stdout.
- `agi setup [--project <path>]`
  - Interactive setup using `@clack/prompts` to:
    - Enable providers (OpenAI/Anthropic/Google)
    - Enter API keys per provider
    - Pick default provider/model/agent
  - Writes `.agi/config.json` with defaults and provider configs.

Testing Strategy
- Unit tests:
  - Config loader precedence and validation.
  - Provider+model resolver.
  - Agent tooling gate (allowed vs. blocked tools).
  - DB schema operations (CRUD for sessions/messages/parts).
- Integration tests (spawns server):
  - Create session → post message → receive SSE → data persisted correctly.
  - One‑shot route returns expected shape.
  - OpenAPI served and minimally valid.
- Scripts:
  - `scripts/smoke-serve.ts` — start server, print URL.
  - `scripts/smoke-ask.ts` — hit one‑shot with a sample prompt and stream output.
  - `scripts/reset-db.ts` — delete local SQLite DB for fresh migrations.

Setup Flow and Provider Catalog
- First run: `agi setup` guides through enabling providers, entering API keys, and picking defaults.
- Provider/model catalog is embedded (`src/providers/catalog.ts`) for offline, stable selection.
- Server uses config defaults when client omits `agent`/`provider`/`model`.
- Server sets provider API keys from config to environment variables (server-side only) as needed.

Milestones & Acceptance Criteria
1) Scaffold & Config Loader
   - Folders created, config precedence implemented with tests.
2) Drizzle Schema & Migrations
   - Tables created in `.agi/agi.sqlite`; basic CRUD covered by tests.
3) Provider Manager & Agent Registry
   - OpenAI/Anthropic/Google selectable; default agents wired; tool gating enforced.
4) Routes & Streaming
   - `/v1/sessions*` and streaming endpoints working; messages persisted during streams.
5) OpenAPI
   - `/openapi.json` accurate to endpoints; minimal schema examples.
6) CLI
   - `agi serve` and one‑shot command working against local server.
7) Tests & Scripts
   - bun tests green; smoke scripts exercise main flows.

Operational Notes
- Logging: basic request logs and tool execution logs to stdout; structured logs later.
- Error handling: consistent error payloads and SSE `error` events.
- Performance: start simple; add batching/rate limits later if needed.
- Security: no auth in v0; future versions may add it behind a flag.

Future Enhancements (post‑v0)
- Tracing and metrics with OpenTelemetry.
- Retry/backoff policies for provider errors; circuit breakers.
- File uploads for multimodal inputs; attachments persisted and referenced by parts.
- Structured outputs and tool‑driven workflows using `generateObject`/`streamObject`.
- Agent memory and RAG: embeddings table + retrieval pipeline.
