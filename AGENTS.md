Purpose

- This file defines conventions for LLM contributors working in this repo.

Formatting and Linting

- Use Biome for linting/formatting. Run via `bun lint`.
- Do not disable rules globally. If an exception is required, limit scope and add a short rationale in the PR/commit message.
- Keep imports sorted and unused code removed.

Modular Structure

- Prefer many small, focused modules over large files.
- One route module per endpoint group (or per endpoint if it grows).
- One schema/table per file under `packages/database/src/schema/`, re-exported via index.
- Avoid circular dependencies. If a module grows beyond ~200–300 lines, consider refactoring.

Monorepo Package Imports

- Use workspace package imports for cross-package dependencies:
  - `@agi-cli/auth` - Authentication & credentials
  - `@agi-cli/config` - Configuration system
  - `@agi-cli/database` - SQLite + Drizzle ORM
  - `@agi-cli/prompts` - System prompts
  - `@agi-cli/providers` - AI provider catalog
  - `@agi-cli/sdk` - Core SDK (tools, streaming, agents)
  - `@agi-cli/server` - HTTP server
- Use relative imports (`./`, `../`) within the same package only.
- Never use `@/` path aliases (removed during monorepo migration).

Runtime and Tooling

- Use Bun for everything: scripts, running, building, testing, linting.
- Do not use npm/yarn/pnpm commands.
- Tests must use `bun:test` and live in `tests/`.

Database and Migrations

- SQLite via Drizzle ORM. Schema lives under `packages/database/src/schema/`.
- Migrations are generated with Drizzle Kit into `packages/database/drizzle/`.
- The server ensures the database exists and runs migrations on startup.

API and Server

- Hono app. Each endpoint belongs in its own module under `packages/server/src/routes/`.
- Expose OpenAPI at `/openapi.json`. Keep the spec in code and serve JSON.
- Streaming uses SSE; prefer AI SDK helpers for stream responses when possible.

AI SDK and Agents

- Use AI SDK v5 APIs (`generateText`, `streamText`, `generateObject`, `streamObject`, `tool`, `embed`, `rerank`).
- Support provider switching (OpenAI, Anthropic, Google, OpenRouter, OpenCode) via `@agi-cli/providers`.
- Agents and tools are modular; load defaults from `packages/sdk/src/tools/` and allow project overrides under `.agi/`.

Commits and Changes

- Make minimal, focused changes. Avoid unrelated refactors.
- Keep filenames, public APIs, and structure stable unless the change is required by the task.
- Update relevant docs (`docs/`, `README.md`, `ARCHITECTURE.md`) when adding features or changing conventions. DO NOT create new docs unless explicitly asked for.

Package Development

- Each package under `packages/` should have:
  - Clear single responsibility
  - Proper exports in package.json
  - tsconfig.json extending `../../tsconfig.base.json`
  - README.md for public packages (sdk, server)
- Follow the dependency graph levels documented in ARCHITECTURE.md.
- No circular dependencies between packages.
