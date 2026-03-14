# Development Guide

[← Back to README](../README.md) • [Docs Index](./index.md)

This guide covers the current development workflow for the otto monorepo.

## Contents

1. [Prerequisites](#prerequisites)
2. [Repo overview](#repo-overview)
3. [Getting started](#getting-started)
4. [Core development commands](#core-development-commands)
5. [Server development](#server-development)
6. [CLI development](#cli-development)
7. [Web and web-sdk development](#web-and-web-sdk-development)
8. [Database workflow](#database-workflow)
9. [API/OpenAPI workflow](#apiopenapi-workflow)
10. [Infrastructure](#infrastructure)
11. [Testing and validation](#testing-and-validation)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

Required:

- [Bun](https://bun.sh)
- Git
- platform-specific tooling for the surface you are working on
  - Tauri tooling for desktop/launcher work
  - mobile toolchain for `apps/mobile`

Repository conventions:

- use Bun for installs, scripts, builds, and tests
- use Biome via `bun lint`
- use workspace imports (`@ottocode/...`) across packages
- keep changes focused and modular

## Repo overview

Current workspace layout:

```text
otto/
├── apps/
│   ├── cli/
│   ├── desktop/
│   ├── intro-video/
│   ├── landing/
│   ├── launcher/
│   ├── mobile/
│   ├── preview-api/
│   ├── preview-web/
│   ├── tui/
│   └── web/
├── packages/
│   ├── acp/
│   ├── ai-sdk/
│   ├── api/
│   ├── database/
│   ├── install/
│   ├── openclaw-setu/
│   ├── sdk/
│   ├── server/
│   ├── web-sdk/
│   └── web-ui/
├── infra/
├── functions/
│   └── og/
├── scripts/
├── tests/
└── docs/
```

Important package roles:

- `@ottocode/sdk` — providers, auth, config, prompts, built-in tools
- `@ottocode/server` — Hono server and runtime
- `@ottocode/api` — generated client from OpenAPI
- `@ottocode/database` — SQLite + Drizzle ORM
- `@ottocode/web-sdk` — React hooks/components
- `@ottocode/web-ui` — prebuilt browser UI assets

## Getting started

```bash
git clone https://github.com/nitishxyz/otto.git
cd otto
bun install
```

Basic validation:

```bash
bun lint
bun run typecheck
bun test
```

## Core development commands

```bash
bun lint
bun test
bun run typecheck
bun run compile
```

Useful workspace commands:

```bash
bun run cli
bun run dev:cli
bun run dev:server
bun run dev:web
bun run dev:desktop
bun run --filter @ottocode/tui dev
bun run --filter @ottocode/sdk dev
bun run --filter @ottocode/server dev
```

## Server development

The server package is `@ottocode/server`.

Run it with:

```bash
bun run dev:server

# or
cd packages/server
bun run dev
```

### Current server shape

Relevant areas:

```text
packages/server/src/
├── index.ts
├── openapi/
│   ├── spec.ts
│   └── paths/
├── routes/
│   ├── ask.ts
│   ├── auth.ts
│   ├── branch.ts
│   ├── doctor.ts
│   ├── files.ts
│   ├── mcp.ts
│   ├── provider-usage.ts
│   ├── research.ts
│   ├── root.ts
│   ├── session-files.ts
│   ├── session-messages.ts
│   ├── session-stream.ts
│   ├── sessions.ts
│   ├── setu.ts
│   ├── skills.ts
│   ├── terminals.ts
│   └── tunnel.ts
└── runtime/
    ├── agent/
    ├── ask/
    ├── message/
    ├── prompt/
    ├── session/
    ├── stream/
    └── tools/
```

### Current API shape

The server exposes:

- `/`
- `/openapi.json`
- `/v1/*`

Examples:

- `POST /v1/ask`
- `GET /v1/server/info`
- `GET /v1/sessions`
- `GET /v1/sessions/{id}/stream`

### Making server changes

Recommended order:

1. update route handlers under `packages/server/src/routes/`
2. update `packages/server/src/openapi/spec.ts`
3. regenerate the client:

```bash
bun run --filter @ottocode/api generate
```

4. update any consuming clients using `@ottocode/api`

## CLI development

The CLI lives in `apps/cli`.

Run one-shot and command flows from source:

```bash
bun run cli ask "hello"
bun run cli --version
```

Or use the app-local dev script:

```bash
cd apps/cli
bun run dev ask "hello"
```

Current CLI responsibilities include:

- one-shot ask flow
- starting the local server
- TUI startup
- auth/setup
- sessions/models/agents/tools/skills commands
- MCP commands
- scaffold/doctor/share/setu/web flows

Important areas:

```text
apps/cli/src/
├── ask/
├── commands/
├── cli.ts
├── custom-commands.ts
├── middleware/
├── scaffold.ts
└── ui.ts
```

## Web and web-sdk development

### Web app

Run the browser app with:

```bash
bun run dev:web

# or
cd apps/web
bun run dev
```

This starts the Vite dev server.

### web-sdk

`@ottocode/web-sdk` is usually developed in context through `apps/web`, since the web app is its main consumer.

### web-ui

`@ottocode/web-ui` contains the prebuilt static assets and embedding helpers. If the web frontend changes, rebuild/regenerate the packaged assets through the repo build flow.

## Database workflow

Useful commands:

```bash
bun run db:generate
bun run db:reset
```

When changing schema:

1. edit schema files under `packages/database/src/schema/`
2. generate migrations with Drizzle
3. update `packages/database/src/migrations-bundled.ts`
4. test the migration locally

Do not hand-author migration files.

## API/OpenAPI workflow

The OpenAPI source of truth lives in:

- `packages/server/src/openapi/spec.ts`

The generated artifacts live in:

- `packages/api/openapi.json`
- `packages/api/src/generated/`

Regenerate after API changes:

```bash
bun run --filter @ottocode/api generate
```

Typecheck the generated client if needed:

```bash
bun run --filter @ottocode/api typecheck
```

## Infrastructure

`sst.config.ts` currently wires these modules:

- `infra/script`
- `infra/landing`
- `infra/preview-api`
- `infra/preview-web`
- `infra/og`

Common commands:

```bash
bun sst dev
bun sst deploy --stage prod
```

## Testing and validation

Run the full repo checks:

```bash
bun lint
bun run typecheck
bun test
```

Targeted checks you will use often:

```bash
bun run --filter @ottocode/server typecheck
bun run --filter @ottocode/sdk typecheck
bun run --filter @ottocode/api typecheck
bun run --filter landing typecheck
```

## Troubleshooting

### Port already in use

If a local server port is occupied, restart using a different port or stop the conflicting process.

### Regenerated artifacts out of sync

If API or web asset files look stale:

```bash
bun run --filter @ottocode/api generate
```

Then rerun typechecks.

### Dependency or workspace issues

```bash
rm -rf node_modules bun.lock
bun install
```

### Before opening a PR

- run lint, typecheck, and relevant tests
- update docs when behavior changed
- keep changes focused
- follow `AGENTS.md`
