# Agents & Tools

[← Back to README](../README.md) · [Docs Index](./index.md)

---

## Agents

otto ships with four built-in agents. Each agent has a system prompt and a curated set of tools.

### build

Code generation, bug fixes, feature implementation. The most capable agent with full filesystem and shell access.

**Tools:** read, write, ls, tree, bash, update_todos, glob, ripgrep, git_status, terminal, apply_patch, websearch

```bash
otto "create an auth component" --agent build
otto "fix the failing test" --agent build
```

### plan

Architecture planning and code analysis. Read-only — cannot modify files or run commands.

**Tools:** read, ls, tree, ripgrep, update_todos, websearch

```bash
otto "design the API architecture" --agent plan
otto "review the dependency graph" --agent plan
```

### general

General-purpose assistant for mixed tasks.

**Tools:** read, write, ls, tree, bash, ripgrep, glob, websearch, update_todos

```bash
otto "explain how this module works" --agent general
```

### research

Deep research across sessions and the web. Can query past sessions for context.

**Tools:** read, ls, tree, ripgrep, websearch, update_todos, query_sessions, query_messages, get_session_context, search_history, get_parent_session, present_action

```bash
otto "research how auth is implemented across the codebase" --agent research
```

All agents also receive: `progress_update`, `finish`, `skill`.

---

## Tools

### File System

| Tool | Description |
|---|---|
| `read` | Read file contents. Supports line ranges and multiple file types. |
| `write` | Write content to a file. Creates the file if it doesn't exist. |
| `ls` | List directory contents (non-recursive). |
| `tree` | Render a directory tree with configurable depth. |
| `glob` | Find files matching glob patterns (e.g., `**/*.ts`). |

### Search

| Tool | Description |
|---|---|
| `grep` | Search file contents with regex. Returns grouped results. |
| `ripgrep` | Fast regex search using rg. Supports include globs and case-insensitive search. |
| `websearch` | Search the web or fetch content from a URL. |

### Editing

| Tool | Description |
|---|---|
| `edit` | Structured file editing with operations: replace, insert-before, insert-after, delete. |
| `apply_patch` | Apply unified diff patches with fuzzy matching. Supports enveloped patch format. |

### Shell

| Tool | Description |
|---|---|
| `bash` | Execute a shell command. Returns stdout, stderr, and exit code. |
| `terminal` | Manage persistent terminal sessions. Start, read, write, interrupt, list, kill. Uses bun-pty for PTY support. |

### Git

| Tool | Description |
|---|---|
| `git_status` | Show git status in porcelain format. |
| `git_diff` | Show git diff (staged or all changes). |
| `git_commit` | Create a git commit with a message. |

### Agent

| Tool | Description |
|---|---|
| `progress_update` | Emit a progress update to the user (short status message with optional percentage). |
| `finish` | Signal task completion. |
| `update_todos` | Create and manage a task list displayed to the user. |
| `skill` | Load a skill by name to get specialized instructions. |

### Research (research agent only)

| Tool | Description |
|---|---|
| `query_sessions` | Search past sessions by content. |
| `query_messages` | Search messages across sessions. |
| `get_session_context` | Get full context from a specific session. |
| `search_history` | Search conversation history. |
| `get_parent_session` | Get the parent session for context. |
| `present_action` | Present research findings to the user. |

---

## Agent Configuration

### Per-Project

Create `.otto/agents.json` in your project root:

```json
{
  "build": {
    "tools": ["read", "write", "bash", "git_status", "git_diff", "ripgrep"],
    "prompt": ".otto/agents/build/agent.md"
  },
  "custom-agent": {
    "tools": ["read", "ls", "tree", "ripgrep"],
    "prompt": ".otto/agents/custom-agent/agent.md"
  }
}
```

### Global

Create `~/.config/otto/agents.json` for global agent overrides.

### Options

| Field | Description |
|---|---|
| `tools` | Override the default tool list for the agent. |
| `appendTools` | Add tools to the default list (instead of replacing). |
| `prompt` | Path to a custom system prompt file. |
| `provider` | Override the provider for this agent. |
| `model` | Override the model for this agent. |

---

## Custom Tools

Add project-specific tools in `.otto/tools/`:

```typescript
// .otto/tools/deploy.ts
import { tool } from "@ottocode/sdk";
import { z } from "zod";

export default tool({
  name: "deploy",
  description: "Deploy the application",
  parameters: z.object({
    environment: z.enum(["staging", "production"]),
  }),
  execute: async ({ environment }) => {
    // your deployment logic
    return { success: true, environment };
  },
});
```

Custom tools are automatically discovered and made available to agents.

---

## Skills

Skills are markdown files that provide specialized instructions to agents on demand, loaded via the `skill` tool.

Skills can be defined at three levels:
- **Project:** `.otto/skills/`
- **Global:** `~/.config/otto/skills/`
- **Built-in:** bundled with otto

```bash
otto skills                    # list available skills
```
