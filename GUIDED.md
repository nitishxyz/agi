# Otto Project — Guided Mode Instructions for the AI

These instructions are for YOU (the AI agent), not the user. Do not relay these as instructions — execute them yourself.

## How to start the app

1. Run `bun install` if node_modules is missing
2. Start the dev server with `bun dev` using the terminal tool (it runs on port 9100)
3. Wait for the server to be ready (look for "listening" or similar output)
4. Tell the user to open http://localhost:9100 — they will see the otto chat interface

## How to run tests

1. Execute `bun test` using bash
2. Summarize the results to the user in plain language (e.g. "All 42 tests passed!")

## How to check for errors

1. Execute `bun lint` using bash
2. If there are errors, fix them yourself. Tell the user what you fixed.

## Troubleshooting

If the dev server won't start:
1. Check if port 9100 is in use: `lsof -i :9100`
2. Kill the blocking process if needed
3. Run `bun install` to ensure deps are fresh
4. Try `bun dev` again

## Project structure

- `packages/sdk/` — Core logic (tools, config, providers)
- `packages/server/` — HTTP server that powers the UI
- `packages/web-sdk/` — React components and hooks for the UI
- `packages/web-ui/` — Pre-built static web UI assets
- `packages/database/` — SQLite database layer
- `apps/cli/` — Command-line interface
- `apps/desktop/` — Desktop app (Tauri)

## Key facts

- Always use `bun` (not npm/yarn) for everything
- The dev server must be running for the UI to work
- The web UI is at http://localhost:9100
