# ACP (Agent Client Protocol) Integration Research

## What is ACP?

The **Agent Client Protocol** is an open protocol (Apache 2.0) created by Zed Industries that standardizes communication between **code editors/IDEs** (Clients) and **AI coding agents** (Agents). Think of it as "LSP but for AI agents."

- **Website**: https://agentclientprotocol.com
- **TypeScript SDK**: `@agentclientprotocol/sdk` (npm, ~1.7M weekly downloads)
- **Protocol version**: 1 (integer-based, only bumped on breaking changes)
- **Transport**: JSON-RPC 2.0 over **stdio** (agent runs as subprocess of the editor)
- **Reference implementations**: Gemini CLI (Google), claude-code-acp (Zed)

## Does it Require a TUI?

**No.** ACP does NOT require building a TUI. The agent is a **headless subprocess** that communicates via JSON-RPC over stdin/stdout. The editor (Zed, JetBrains, Neovim, VS Code, etc.) provides the entire UI.

Otto would run as a background process, and the editor handles:
- Rendering agent messages, diffs, tool calls
- File navigation / following the agent
- Permission prompts (allow/deny tool use)
- Multi-buffer edit review
- Terminal management

## How it Works (Architecture)

```
┌──────────────────────┐        stdio (JSON-RPC)       ┌──────────────────────┐
│      Client          │  ──────────────────────────▶   │      Agent           │
│  (Zed, JetBrains,    │  ◀──────────────────────────   │  (otto)              │
│   Neovim, VS Code)   │                                │                      │
│                       │                                │  - Calls LLMs        │
│  - UI rendering       │                                │  - Runs tools        │
│  - File system access │                                │  - Sends updates     │
│  - Terminal mgmt      │                                │  - Requests perms    │
│  - Permission prompts │                                │                      │
└──────────────────────┘                                └──────────────────────┘
```

## Protocol Flow

### 1. Initialization
Client spawns agent as subprocess, sends `initialize` with:
- `protocolVersion: 1`
- `clientCapabilities` (fs read/write, terminal support)
- `clientInfo` (name, version)

Agent responds with:
- `agentCapabilities` (prompt types, MCP support, session load/resume/fork/list)
- `agentInfo` (name, title, version)
- `authMethods` (how to authenticate)

### 2. Authentication
Client calls `authenticate` if agent requires it (API keys, OAuth, etc.)

### 3. Session Setup
Client calls `session/new` with:
- `cwd` (absolute path to working directory)
- `mcpServers` (MCP server configurations to connect to)

Agent responds with `sessionId`, available models, available modes.

### 4. Prompt Turn (core loop)
1. Client sends `session/prompt` with user message (text, images, files, resource links)
2. Agent processes and streams back via `session/update` notifications:
   - `agent_message_chunk` - text responses
   - `agent_thought_chunk` - thinking/reasoning
   - `tool_call` - tool invocation started
   - `tool_call_update` - tool progress/completion
   - `plan` - TODO list / plan entries
   - `available_commands_update` - slash commands
   - `current_mode_update` - mode changes
3. Agent may call Client methods:
   - `fs/read_text_file` - read files through the editor
   - `fs/write_text_file` - write files through the editor
   - `terminal/create`, `terminal/output`, etc. - terminal operations
   - `session/request_permission` - ask user to approve tool use
4. Turn ends with `session/prompt` response containing `stopReason`

### 5. Cancellation
Client sends `session/cancel` notification; agent stops and responds with `cancelled` stop reason.

## Compatible Clients (as of Feb 2026)

- **Zed** (primary)
- **JetBrains IDEs** (IntelliJ, WebStorm, PyCharm, etc.)
- **Neovim** (via CodeCompanion, agentic.nvim, avante.nvim plugins)
- **VS Code** (via ACP Client extension)
- **Emacs** (via agent-shell.el)
- **Obsidian**, **marimo notebook**, **DuckDB**, and many more
- **Web browsers** (via AI SDK with @mcpc/acp-ai-provider)

## Compatible Agents (examples)

Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, OpenCode, Augment Code, Goose, Kiro CLI, Qwen Code, and ~30+ more.

## Distribution: ACP Registry

As of Jan 2026, the **ACP Registry** is the preferred distribution mechanism:
- Register once → available in Zed, JetBrains, and all ACP clients
- Auto-updates for users
- Curated set requiring authentication support
- Submit via PR to the registry repo

Previous "Agent Server Extensions" approach is being deprecated in favor of the registry.

## What We Need to Build for Otto

### Core: ACP Agent Server

A new package/entry point that implements the `Agent` interface from `@agentclientprotocol/sdk`:

```typescript
import { Agent, AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";

class OttoAcpAgent implements Agent {
  async initialize(request) → InitializeResponse
  async newSession(params) → NewSessionResponse
  async prompt(params) → PromptResponse
  async cancel(params) → void
  // Optional: loadSession, setSessionMode, setSessionModel, listSessions, etc.
}

// Entry point - reads from stdin, writes to stdout
const input = nodeToWebWritable(process.stdout);
const output = nodeToWebReadable(process.stdin);
const stream = ndJsonStream(input, output);
new AgentSideConnection((client) => new OttoAcpAgent(client), stream);
```

### Key Implementation Details

1. **stdio transport**: stdout is for JSON-RPC messages ONLY. Redirect all logging to stderr:
   ```typescript
   console.log = console.error;  // critical!
   ```

2. **Session management**: Create sessions with unique IDs, track conversation state

3. **Streaming**: Send `session/update` notifications for incremental text, tool calls, plans

4. **Tool permissions**: Use `client.requestPermission()` before dangerous operations

5. **File operations**: Optionally delegate file read/write to the client (editor) for better UX:
   - When client has `fs.readTextFile` capability → use `client.readTextFile()` instead of direct fs
   - When client has `fs.writeTextFile` capability → use `client.writeTextFile()` for diffs in editor

6. **Terminal operations**: Delegate terminal to client when `terminal` capability is present

7. **MCP support**: Connect to MCP servers provided by the client in `session/new`

### Package Structure (suggested)

```
packages/acp/
├── package.json          # @ottocode/acp
├── src/
│   ├── index.ts          # CLI entry point (stdio setup)
│   ├── agent.ts          # OttoAcpAgent implements Agent
│   ├── session.ts        # Session management
│   ├── tools.ts          # Tool call → ACP notification mapping
│   └── utils.ts          # Helpers
└── tsconfig.json
```

### Distribution

**Option A: ACP Registry (recommended)**
- Build otto as a standalone binary/npm package
- Submit to ACP Registry
- Users install from within their editor with one click

**Option B: Custom agent in editor settings**
Users can manually configure in Zed's `settings.json`:
```json
{
  "agent_servers": {
    "Otto": {
      "type": "custom",
      "command": "otto",
      "args": ["--acp"],
      "env": {}
    }
  }
}
```

**Option C: Agent Server Extension (being deprecated)**
- Create extension.toml with download URLs per platform
- Publish to Zed's extension registry

### Dependencies

```json
{
  "@agentclientprotocol/sdk": "0.14.1"
}
```

That's the only required dependency for the protocol layer. The rest is otto's existing SDK/server infrastructure.

## Key Takeaways

1. **No TUI needed** - the editor IS the UI
2. **Headless subprocess** - otto runs as a background process, speaks JSON-RPC over stdio
3. **One implementation, many editors** - works in Zed, JetBrains, Neovim, VS Code, etc.
4. **The SDK does the heavy lifting** - `@agentclientprotocol/sdk` handles JSON-RPC, message framing, types
5. **Reference impl to study** - `zed-industries/claude-code-acp` is a production TypeScript ACP agent
6. **Registry for distribution** - submit once, available everywhere
