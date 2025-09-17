# agi — AI-powered development assistant (server + CLI)

A Bun-based AGI server and CLI built on AI SDK v5. It streams assistant output, supports tool/function calling, persists sessions in a local SQLite DB, and works with OpenAI, Anthropic, and Google models. Project- and user-specific agents, tools, and commands are discoverable from .agi/ directories.

Highlights
- Streaming chat and tool calls over HTTP/SSE
- Local persistence per project in .agi/agi.sqlite (Drizzle + SQLite)
- Built-in and project-defined tools with artifacts (e.g., file diffs)
- Progress updates: assistants can emit lightweight status lines (stage + %)
- Discovered commands: simple JSON manifests with optional prompt files
- Works with OpenAI, Anthropic, Google via AI SDK v5

Requirements
- Bun 1.2+ installed
- At least one provider API key: OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY

Install
- bun install

Authenticate providers
- bun run index.ts auth login
  - Follow prompts to store provider keys (global by default; add --local to write per-project)

Run the server
- bun run index.ts serve
  - Starts the HTTP server (prints http://localhost:<port>) and prepares .agi/agi.sqlite

One-shot ask (CLI)
- bun run index.ts "Explain the repo in two lines" [--agent <name>] [--provider <p>] [--model <m>] [--project <path>] [--last|--session <id>]

Compiled binary (optional)
- bun run build  → produces dist/agi
- ./dist/agi serve
- ./dist/agi "Hello" --agent general

CLI overview
- serve                    Start the HTTP server
- sessions [--list|--json] Manage or pick sessions (default: pick)
- auth <login|list|logout> Manage provider credentials (use --local to write/remove local auth)
- setup                   Alias for "auth login"
- models|switch           Pick default provider/model (interactive)
- scaffold|generate       Create agents, tools, or commands (interactive)
- agents [--local]        Edit agents.json entries (interactive)
- tools                   List discovered tools and agent access
- doctor                  Diagnose auth, defaults, and agent/tool issues
- chat [--last|--session] Start an interactive chat (if enabled)

Common options
- --project <path>         Use project at <path> (default: cwd)
- --last                   Send to most-recent session
- --session <id>           Send to a specific session
- --json | --json-stream   Machine-readable outputs

Agents
- Built-in agents: general, build, plan
  - Prompts are embedded by default and can be overridden per project via .agi/agents/<agent>/agent.md
  - Defaults were updated to allow periodic progress updates; long or multi-step tasks may emit non-sensitive status lines

Tools
- Built-in tool registry plus project tools in .agi/tools/<tool>/tool.ts
- New: progress_update tool (lightweight status events)
  - name: progress_update
  - input: { message: string (<= 200 chars); pct?: 0–100; stage?: planning|generating|writing|verifying }
  - purpose: let the assistant surface short status lines without revealing chain-of-thought
  - CLI render: shows a stage badge and optional progress bar; results are not echoed to avoid clutter

Discovered commands
- Place JSON manifests in either location; later entries override earlier ones by name:
  - Global: ~/.agi/commands/*.json
  - Project: ./.agi/commands/*.json
- Minimal manifest
  {
    "name": "commit",
    "description": "Propose a Conventional Commits message for staged changes",
    "agent": "git",
    "interactive": true
  }
- Prompt sources (precedence inside a manifest):
  1) promptPath – relative path resolved against manifest dir, then project root; supports ~/ expansion
  2) prompt – inline string
  3) promptTemplate – template string; if it contains {input}, it will be replaced; otherwise the user input is appended
  4) Sibling prompt file: if none of the above are set, a file named <manifestName>.md or .txt next to the manifest is used if present
- {input} placeholder: replaced with remaining CLI args or interactive input when interactive: true
- Example tree
  .agi/commands/
  ├─ commit.json
  └─ commit.md

Doctor
- Prints configuration, provider auth status, agents, tools, and now Commands:
  - Shows global and local command directories, discovered names, and details per command (json path and prompt origin)

Data storage
- SQLite DB per project at .agi/agi.sqlite
- Messages and tool calls/results are persisted; file diff artifacts can be stored inline or as files

Docs
- See docs/ for deeper details:
  - docs/ai-sdk-v5.md – SDK usage patterns
  - docs/tools-and-artifacts.md – authoring tools, artifacts, and diff format
  - docs/agi-plan.md – architecture plan and conventions

License
- MIT
