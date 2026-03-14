# Environment

[← Back to README](../README.md) • [Docs Index](./index.md)

This page lists environment variables with verified code usage in the current repo.

## Provider credentials

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...
OPENCODE_API_KEY=...
SETU_PRIVATE_KEY=...
MOONSHOT_API_KEY=...
MINIMAX_API_KEY=...
ZAI_API_KEY=...
ZAI_CODING_API_KEY=...
```

Copilot auth can also be sourced from:

```bash
COPILOT_GITHUB_TOKEN=...
GH_TOKEN=...
GITHUB_TOKEN=...
```

## Server and client ports

```bash
PORT=3000         # API server port for `otto serve` / server startup
OTTO_PORT=9100    # TUI client default API port override
HOST=0.0.0.0      # used by some dev/build flows
```

## otto debug flags

```bash
OTTO_DEBUG=1              # enable debug logging
DEBUG_OTTO=1              # alternate debug flag
OTTO_DEBUG_TIMING=1       # include timing-oriented debug output
OTTO_DEBUG_DUMP=1         # dump debug turn data
OTTO_DEBUG_TOOL_INPUT=1   # log tool input payloads
OTTO_DEBUG_TOOLS=1        # log custom tool/plugin loading issues
OTTO_DEVTOOLS=1           # enable AI SDK devtools integration
OTTO_TRACE=1              # trace-oriented runtime flag
TRACE_OTTO=1              # alternate trace flag
```

## Web and app-specific variables

These are used by specific apps rather than the shared server runtime:

```bash
OTTO_SERVER_URL=...
OTTO_SHARE_API_URL=...
EXPO_PUBLIC_API_URL=...
EXPO_PUBLIC_ENV=...
EXPO_PUBLIC_PAY_URL=...
SETU_BASE_URL=...
SETU_PROXY_PORT=8403
SETU_SOLANA_RPC_URL=...
TAURI_DEV_HOST=...
TAURI_RESOURCE_DIR=...
OTUI_TREE_SITTER_WORKER_PATH=...
```

## Build/signing variables

```bash
APPLE_SIGNING_IDENTITY=...
CLOUDFLARE_ACCOUNT_ID=...
DEBUG_OTTO_WEB_ASSETS=1
BUN_PTY_LIB=...
```

## Variables intentionally removed from docs

These older names were previously documented but are not backed by current code in the main runtime docs surface:

- `GOOGLE_AI_API_KEY`
- `OTTO_PROJECT_ROOT`
- `DB_FILE_NAME`
- `OTTO_RENDER_MARKDOWN`

If you need a compatibility alias, document it as deprecated in the code that actually consumes it before re-adding it here.
