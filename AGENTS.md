Purpose
- This file defines conventions for LLM contributors working in this repo.

Formatting and Linting
- Use Biome for linting/formatting. Run via `bun lint`.
- Do not disable rules globally. If an exception is required, limit scope and add a short rationale in the PR/commit message.
- Keep imports sorted and unused code removed.

Modular Structure
- Prefer many small, focused modules over large files.
- One route module per endpoint group (or per endpoint if it grows).
- One schema/table per file under `src/db/schema/`, re-exported via `src/db/schema.ts` and `src/db/schema/index.ts`.
- Avoid circular dependencies. If a module grows beyond ~200–300 lines, consider refactoring.

Path Aliases
- Use `tsconfig.json` path aliases for imports instead of deep relative paths:
  - `@/ai/*` → `src/ai/*`
  - `@/db/*` → `src/db/*`
  - `@/config/*` → `src/config/*`
  - `@/prompts/*` → `src/prompts/*`
  - `@/providers/*` → `src/providers/*`
  - `@/server/*` → `src/server/*`

Runtime and Tooling
- Use Bun for everything: scripts, running, building, testing, linting.
- Do not use npm/yarn/pnpm commands.
- Tests must use `bun:test` and live in `tests/`.

Database and Migrations
- SQLite via Drizzle ORM. Schema lives under `src/db/schema/`.
- Migrations are generated with Drizzle Kit into `./drizzle/`.
- The server ensures the database exists and runs migrations on startup.

API and Server
- Hono app. Each endpoint belongs in its own module under `src/server/routes/`.
- Expose OpenAPI at `/openapi.json`. Keep the spec in code (`src/openapi/`) and serve JSON.
- Streaming uses SSE; prefer AI SDK helpers for stream responses when possible.

AI SDK and Agents
- Use AI SDK v5 APIs (`generateText`, `streamText`, `generateObject`, `streamObject`, `tool`, `embed`, `rerank`).
- Support provider switching (OpenAI, Anthropic, Google) on the server side only.
- Agents and tools are modular; load defaults from `src/ai` and allow project overrides under `.agi/`.

Commits and Changes
- Make minimal, focused changes. Avoid unrelated refactors.
- Keep filenames, public APIs, and structure stable unless the change is required by the task.
- Update small docs (`docs/`) when adding features or changing conventions.

