# TUI Plan — otto terminal interface

> Status: **Planning**
> Last updated: 2026-03-01

---

## 1. Design Philosophy

**Chat-first, command-driven, zero chrome.**

No sidebar. No panels. No mouse-required UI. Just a clean chat interface with `/commands` — like IRC, vim, or a modern terminal chat client.

The terminal is narrow and precious. Every column matters. A sidebar wastes 20-30 columns for a list you glance at once. Instead:

- `/sessions` — list & switch sessions
- `/new` — create session
- `/config` — change provider/model
- `/help` — show commands
- Type normally to chat

### ASCII Layout

```
┌─────────────────────────────────────────────────────────────┐
│ otto • anthropic/claude-sonnet • session: fix-auth-bug      │  ← status bar (1 line)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  You                                                        │
│  Fix the authentication bug in the login flow               │
│                                                             │
│  Assistant                                                  │
│  I'll investigate the auth flow. Let me start by reading    │
│  the relevant files.                                        │
│                                                             │
│  ┌ read src/auth/login.ts ──────────────────────────────┐   │  ← tool call (collapsible)
│  │ ✓ 45 lines read                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  The issue is on line 23 where the token validation...      │
│                                                             │
│  ```typescript                                              │  ← syntax highlighted
│  const isValid = await validateToken(token);                │
│  ```                                                        │
│                                                             │
│  ┌ apply_patch src/auth/login.ts ───────────────────────┐   │  ← diff view
│  │ -  const isValid = validateToken(token);              │   │
│  │ +  const isValid = await validateToken(token);        │   │
│  │ ✓ Applied                                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ > Type a message... (Ctrl+Enter to send)                    │  ← input area
└─────────────────────────────────────────────────────────────┘
```

### `/sessions` overlay

When you type `/sessions`, a select overlay appears over the chat:

```
┌─────────────────────────────────────────────────────────────┐
│ otto • sessions                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌ Sessions ─────────────────────────────────────────────┐  │
│  │ > fix-auth-bug              anthropic  2 min ago      │  │
│  │   refactor-database         openai     15 min ago     │  │
│  │   add-tui-support           anthropic  1 hour ago     │  │
│  │   untitled                  google     2 hours ago    │  │
│  │                                                       │  │
│  │  ↑↓ navigate  enter select  n new  d delete  esc back │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ > /sessions                                                 │
└─────────────────────────────────────────────────────────────┘
```

### `/config` overlay

```
┌─────────────────────────────────────────────────────────────┐
│ otto • config                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌ Configuration ────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  Provider:  [anthropic ▼]                             │  │
│  │  Model:     [claude-sonnet-4-20250514 ▼]              │  │
│  │  Agent:     [build ▼]                                 │  │
│  │                                                       │  │
│  │  tab navigate  enter select  esc back                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ > /config                                                   │
└─────────────────────────────────────────────────────────────┘
```

### Tool approval overlay

When a tool needs approval (non-auto-approve mode):

```
┌─────────────────────────────────────────────────────────────┐
│ otto • anthropic/claude-sonnet • fix-auth-bug               │
├─────────────────────────────────────────────────────────────┤
│  ...chat messages...                                        │
│                                                             │
│  ┌ Tool Approval Required ───────────────────────────────┐  │
│  │                                                       │  │
│  │  bash                                                 │  │
│  │  rm -rf node_modules && bun install                   │  │
│  │                                                       │  │
│  │  [y] approve  [n] deny  [a] always approve this tool  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ > ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture

Same client-server model as web/desktop. The TUI is just another client.

```
┌─────────────────────────────────┐
│  apps/tui                       │  ← New app (this plan)
│  @opentui/react + React 19      │
│  @ottocode/api (HTTP + SSE)     │
└──────────┬──────────────────────┘
           │ HTTP / SSE (localhost:9100)
┌──────────▼──────────────────────┐
│  @ottocode/server (Hono)        │  ← Existing, unchanged
│  SQLite, agents, tools, SSE     │
└─────────────────────────────────┘
```

No server changes needed. The TUI connects to the same local server the web UI uses.

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| TUI framework | `@opentui/core` + `@opentui/react` | Bun-native, Yoga layout, React bindings, built-in markdown/code/diff |
| API client | `@ottocode/api` | Already generated, type-safe, SSE streaming |
| State | React `useState`/`useReducer` | Simple; no Zustand needed for TUI scope |
| Runtime | Bun | Required by OpenTUI |

---

## 4. Package Structure

```
apps/tui/
├── index.tsx                # Entry: createCliRenderer + createRoot + <App />
├── package.json
├── tsconfig.json
├── src/
│   ├── App.tsx              # Root: layout + overlay router
│   ├── api.ts               # API client setup (base URL, helpers)
│   ├── theme.ts             # Color palette + syntax styles
│   ├── commands.ts          # /command parser + registry
│   ├── types.ts             # Local TUI types
│   │
│   ├── components/
│   │   ├── StatusBar.tsx        # Top bar: provider, model, session title
│   │   ├── ChatView.tsx         # Main scrollbox with messages
│   │   ├── MessageItem.tsx      # Single message (user or assistant)
│   │   ├── ToolCallItem.tsx     # Collapsible tool call/result box
│   │   ├── ChatInput.tsx        # Bottom textarea with /command detection
│   │   ├── SessionsOverlay.tsx  # /sessions select list overlay
│   │   ├── ConfigOverlay.tsx    # /config provider/model picker
│   │   ├── ApprovalOverlay.tsx  # Tool approval dialog
│   │   └── HelpOverlay.tsx      # /help command reference
│   │
│   └── hooks/
│       ├── useApi.ts            # Fetch wrapper around @ottocode/api
│       ├── useStream.ts         # SSE stream consumer + state reducer
│       ├── useSession.ts        # Session CRUD + active session state
│       ├── useMessages.ts       # Message list state + streaming updates
│       └── useConfig.ts         # Provider/model/agent config
```

---

## 5. Commands

| Command | Action |
|---|---|
| `/sessions` or `/s` | Open sessions overlay |
| `/new [title]` | Create new session |
| `/config` or `/c` | Open config overlay (provider/model/agent) |
| `/model <model>` | Quick-switch model |
| `/provider <provider>` | Quick-switch provider |
| `/agent <agent>` | Quick-switch agent |
| `/delete` | Delete current session |
| `/clear` | Clear chat display |
| `/help` or `/?` | Show help overlay |
| `/quit` or `/q` | Exit TUI |

All other input is sent as a chat message to the current session.

---

## 6. Component Details

### 6.1 StatusBar

One-line top bar. Shows current state at a glance.

```
otto • anthropic/claude-sonnet-4-20250514 • fix-auth-bug [streaming...]
```

OpenTUI React:
```tsx
<box style={{ width: "100%", height: 1, backgroundColor: "#1a1b26", flexDirection: "row", justifyContent: "space-between", paddingLeft: 1, paddingRight: 1 }}>
  <text fg="#7aa2f7"><b>otto</b></text>
  <text fg="#9ece6a">{provider}/{model}</text>
  <text fg="#a9b1d6">{sessionTitle}</text>
  {isStreaming && <text fg="#f7768e">[streaming...]</text>}
</box>
```

### 6.2 ChatView

Scrollable message area. Uses `<scrollbox>` with `stickyScroll: true, stickyStart: "bottom"`.

Each message is a `<MessageItem>` which renders:
- **User messages**: plain text, dimmed label
- **Assistant messages**: `<markdown>` component with streaming support
- **Tool calls**: `<ToolCallItem>` with collapsible border box
- **Errors**: red text

### 6.3 MessageItem

```tsx
// User message
<box style={{ flexDirection: "column", marginBottom: 1 }}>
  <text fg="#565f89">You</text>
  <text fg="#a9b1d6">{content}</text>
</box>

// Assistant message
<box style={{ flexDirection: "column", marginBottom: 1 }}>
  <text fg="#565f89">Assistant</text>
  <markdown content={content} syntaxStyle={theme} streaming={isStreaming} />
  {parts.filter(isToolCall).map(p => <ToolCallItem key={p.id} part={p} />)}
</box>
```

### 6.4 ToolCallItem

Bordered box showing tool name, args summary, and result status.

```tsx
<box style={{ border: true, borderStyle: "rounded", borderColor: "#414868", marginTop: 1, padding: 1 }}>
  <text fg="#7aa2f7">{toolName}</text>
  <text fg="#565f89">{argsSummary}</text>
  {result && <text fg="#9ece6a">✓ {resultSummary}</text>}
  {hasError && <text fg="#f7768e">✗ {errorMessage}</text>}
</box>
```

For diff results, use OpenTUI's built-in `<diff>` component:
```tsx
<diff diff={diffString} view="unified" filetype={language} syntaxStyle={theme} />
```

### 6.5 ChatInput

Multi-line textarea at the bottom. `Ctrl+Enter` to send (since `Enter` = newline).

```tsx
<box style={{ width: "100%", minHeight: 3, border: true, borderStyle: "rounded", borderColor: isFocused ? "#7aa2f7" : "#414868" }}>
  <textarea
    placeholder="Type a message... (Ctrl+Enter to send, / for commands)"
    onSubmit={handleSend}
    keyBindings={[{ name: "return", ctrl: true, action: "submit" }]}
  />
</box>
```

When input starts with `/`, parse as command instead of sending as message.

### 6.6 SessionsOverlay

Absolute-positioned `<select>` overlay that appears over the chat.

```tsx
<box style={{ position: "absolute", top: 2, left: 4, right: 4, bottom: 4, border: true, borderStyle: "rounded", title: "Sessions", backgroundColor: "#1a1b26", zIndex: 100 }}>
  <select
    options={sessions.map(s => ({ name: s.title || "untitled", description: `${s.provider} • ${timeAgo(s.lastActiveAt)}` }))}
    onItemSelected={handleSelect}
    focused
  />
</box>
```

### 6.7 ConfigOverlay

Stepped select: first pick provider, then model, then agent.

### 6.8 ApprovalOverlay

Shows when `tool.approval.required` SSE event fires. Keyboard-driven: `y/n/a`.

---

## 7. SSE Stream Integration

The TUI reuses the same SSE event protocol as web-sdk. Key events to handle:

| Event | Action |
|---|---|
| `message.created` | Add new message to state |
| `message.part.delta` | Append text delta to current message part |
| `reasoning.delta` | Append reasoning delta (collapsible) |
| `tool.call` | Add ephemeral tool call part |
| `tool.delta` | Update tool call with streaming args |
| `tool.result` | Replace ephemeral with persisted result |
| `tool.approval.required` | Show approval overlay |
| `tool.approval.resolved` | Dismiss approval overlay |
| `message.completed` | Mark message complete, refresh |
| `message.updated` | Update message status |
| `error` | Show error in chat |
| `queue.updated` | Update queue indicator |

### Stream hook sketch

```tsx
function useStream(sessionId: string | null) {
  const [messages, dispatch] = useReducer(messageReducer, []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    const baseUrl = getBaseUrl();

    // Load existing messages
    fetch(`${baseUrl}/v1/sessions/${sessionId}/messages`)
      .then(r => r.json())
      .then(msgs => dispatch({ type: 'LOAD', messages: msgs }));

    // Connect SSE
    const url = `${baseUrl}/v1/sessions/${sessionId}/stream`;
    connectSSE(url, controller.signal, (event) => {
      switch (event.type) {
        case 'message.created':
          dispatch({ type: 'MESSAGE_CREATED', payload: event.payload });
          setIsStreaming(true);
          break;
        case 'message.part.delta':
          dispatch({ type: 'TEXT_DELTA', payload: event.payload });
          break;
        case 'tool.call':
          dispatch({ type: 'TOOL_CALL', payload: event.payload });
          break;
        case 'tool.result':
          dispatch({ type: 'TOOL_RESULT', payload: event.payload });
          break;
        case 'tool.approval.required':
          setPendingApproval(event.payload);
          break;
        case 'message.completed':
          dispatch({ type: 'MESSAGE_COMPLETED', payload: event.payload });
          setIsStreaming(false);
          break;
        // ... etc
      }
    });

    return () => controller.abort();
  }, [sessionId]);

  return { messages, isStreaming, pendingApproval };
}
```

---

## 8. Keyboard Shortcuts

| Key | Context | Action |
|---|---|---|
| `Ctrl+Enter` | Input focused | Send message |
| `Enter` | Input focused | Newline |
| `Escape` | Overlay open | Close overlay |
| `Escape` | Input focused | Blur input |
| `/` | Input empty | Start command |
| `Ctrl+C` | Streaming | Abort current request |
| `Ctrl+C` | Idle | Exit TUI |
| `Ctrl+N` | Global | New session |
| `Ctrl+S` | Global | Open sessions |
| `Ctrl+P` | Global | Open config |
| `y` | Approval overlay | Approve tool call |
| `n` | Approval overlay | Deny tool call |
| `a` | Approval overlay | Always approve this tool |
| `↑/↓` | Select/scrollbox | Navigate |
| `Page Up/Down` | Chat view | Scroll messages |

---

## 9. Theme

Tokyo Night-inspired palette (matches the existing web UI dark theme):

```typescript
export const colors = {
  bg:           "#1a1b26",
  bgDark:       "#16161e",
  bgHighlight:  "#292e42",
  fg:           "#a9b1d6",
  fgDark:       "#565f89",
  blue:         "#7aa2f7",
  green:        "#9ece6a",
  red:          "#f7768e",
  yellow:       "#e0af68",
  purple:       "#bb9af7",
  cyan:         "#7dcfff",
  orange:       "#ff9e64",
  border:       "#414868",
  borderActive: "#7aa2f7",
};
```

Syntax highlighting styles (for `<code>`, `<markdown>`, `<diff>`):

```typescript
export const syntaxStyle = SyntaxStyle.fromStyles({
  keyword:       { fg: RGBA.fromHex("#FF7B72"), bold: true },
  string:        { fg: RGBA.fromHex("#A5D6FF") },
  comment:       { fg: RGBA.fromHex("#8B949E"), italic: true },
  number:        { fg: RGBA.fromHex("#79C0FF") },
  function:      { fg: RGBA.fromHex("#D2A8FF") },
  type:          { fg: RGBA.fromHex("#FFA657") },
  variable:      { fg: RGBA.fromHex("#E6EDF3") },
  operator:      { fg: RGBA.fromHex("#FF7B72") },
  punctuation:   { fg: RGBA.fromHex("#F0F6FC") },
  default:       { fg: RGBA.fromHex("#E6EDF3") },
  // Markdown
  "markup.heading":    { fg: RGBA.fromHex("#58A6FF"), bold: true },
  "markup.heading.1":  { fg: RGBA.fromHex("#00FF88"), bold: true, underline: true },
  "markup.heading.2":  { fg: RGBA.fromHex("#00D7FF"), bold: true },
  "markup.bold":       { fg: RGBA.fromHex("#F0F6FC"), bold: true },
  "markup.italic":     { fg: RGBA.fromHex("#F0F6FC"), italic: true },
  "markup.list":       { fg: RGBA.fromHex("#FF7B72") },
  "markup.quote":      { fg: RGBA.fromHex("#8B949E"), italic: true },
  "markup.raw":        { fg: RGBA.fromHex("#A5D6FF") },
  "markup.link":       { fg: RGBA.fromHex("#58A6FF"), underline: true },
});
```

---

## 10. Phases

### P0 — MVP (ship first)

- [x] Plan doc (this file)
- [ ] Project scaffolding (`apps/tui/`, package.json, tsconfig)
- [ ] Entry point: `createCliRenderer` + `createRoot` + `<App />`
- [ ] StatusBar (static: provider, model, session)
- [ ] ChatView with scrollbox (sticky bottom)
- [ ] MessageItem (user + assistant text)
- [ ] ChatInput (textarea, Ctrl+Enter to send)
- [ ] API integration: create session, send message, load messages
- [ ] SSE streaming: text deltas, message.completed
- [ ] Basic `/quit` command

**Goal**: Type a message, see streamed response with markdown rendering.

### P1 — Sessions & Commands

- [ ] `/sessions` overlay with `<select>`
- [ ] `/new [title]` command
- [ ] `/delete` command
- [ ] Session switching (load messages for selected session)
- [ ] `/config` overlay (provider/model/agent pickers)
- [ ] `/model`, `/provider`, `/agent` quick commands
- [ ] `/help` overlay
- [ ] `/clear` command
- [ ] Keyboard shortcuts (Ctrl+N, Ctrl+S, Ctrl+P)

### P2 — Rich Rendering

- [ ] ToolCallItem with collapsible bordered box
- [ ] Diff rendering via `<diff>` component
- [ ] Code blocks via `<code>` with syntax highlighting
- [ ] Reasoning/thinking sections (collapsible)
- [ ] Tool approval overlay (y/n/a keys)
- [ ] Error display styling
- [ ] Progress/todo updates from agent

### P3 — Polish

- [ ] Ctrl+C to abort streaming request
- [ ] Queue indicator (multiple messages queued)
- [ ] Session title auto-display from server
- [ ] Responsive layout (narrow terminal handling)
- [ ] Theme detection (light/dark via `renderer.themeMode`)
- [ ] Graceful cleanup on exit (`renderer.destroy()`)
- [ ] Token usage in status bar
- [ ] Streaming indicator animation

### P4 — Advanced (future)

- [ ] Vim-mode keybindings for navigation
- [ ] File browser via `/files` command
- [ ] Git status via `/git` command
- [ ] Terminal output rendering
- [ ] Image attachment support
- [ ] Session branching via `/branch`
- [ ] Search through chat history

---

## 11. Dependencies

```json
{
  "name": "@ottocode/tui",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun run index.tsx",
    "build": "bun build index.tsx --outdir dist --target bun"
  },
  "dependencies": {
    "@opentui/core": "latest",
    "@opentui/react": "latest",
    "@ottocode/api": "workspace:*",
    "react": "^19.0.0",
    "eventsource-parser": "^3.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react",
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["index.tsx", "src/**/*.ts", "src/**/*.tsx"]
}
```

---

## 12. API Integration Reference

The TUI connects to the same local server (default `http://localhost:9100`).

### Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/sessions` | List sessions |
| `POST` | `/v1/sessions` | Create session |
| `PATCH` | `/v1/sessions/:id` | Update session |
| `DELETE` | `/v1/sessions/:id` | Delete session |
| `GET` | `/v1/sessions/:id/messages` | Get messages |
| `POST` | `/v1/sessions/:id/messages` | Send message |
| `GET` | `/v1/sessions/:id/stream` | SSE stream |
| `POST` | `/v1/sessions/:id/abort` | Abort streaming |
| `POST` | `/v1/sessions/:id/approval` | Approve/deny tool |
| `GET` | `/v1/config` | Get config (agents, providers, defaults) |
| `GET` | `/v1/config/models` | Get all models |
| `PATCH` | `/v1/config/defaults` | Update defaults |

### SSE Event Types

Full event reference (from `packages/web-sdk/src/hooks/useSessionStream.ts`):

```
message.created       → { id, role, agent, provider, model }
message.part.delta    → { messageId, partId, delta, stepIndex? }
reasoning.delta       → { messageId, partId, delta, stepIndex? }
tool.call             → { messageId, callId, name, args, stepIndex? }
tool.delta            → { callId, channel, name, args, stepIndex? }
tool.result           → { callId, ... }
tool.approval.required → { callId, toolName, args, messageId }
tool.approval.resolved → { callId }
tool.approval.updated  → { callId, args }
message.completed     → { id }
message.updated       → { id, status }
queue.updated         → { currentMessageId, queuedMessages, queueLength }
error                 → { messageId?, error? }
```

---

## 13. OpenTUI Reference

### React Bindings Quick Reference

```tsx
// Entry point
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
```

### JSX Intrinsic Elements

| Element | Maps to | Use for |
|---|---|---|
| `<text>` | `TextRenderable` | Text display |
| `<box>` | `BoxRenderable` | Container/layout |
| `<input>` | `InputRenderable` | Single-line input |
| `<textarea>` | `TextareaRenderable` | Multi-line input |
| `<select>` | `SelectRenderable` | List selection |
| `<tab-select>` | `TabSelectRenderable` | Tab selection |
| `<scrollbox>` | `ScrollBoxRenderable` | Scrollable container |
| `<code>` | `CodeRenderable` | Syntax-highlighted code |
| `<markdown>` | `MarkdownRenderable` | Markdown rendering |
| `<diff>` | `DiffRenderable` | Diff viewer |
| `<slider>` | `SliderRenderable` | Numeric slider |
| `<ascii-font>` | `ASCIIFontRenderable` | ASCII art text |

### Hooks

```tsx
import { useRenderer, useKeyboard, useOnResize, useTerminalDimensions } from "@opentui/react";

// Access renderer
const renderer = useRenderer();

// Keyboard events
useKeyboard((key) => {
  if (key.ctrl && key.name === "n") { /* Ctrl+N */ }
});

// Terminal size
const { width, height } = useTerminalDimensions();
```

### Key Components for TUI

**ScrollBox** — Chat message area:
```tsx
<scrollbox style={{ width: "100%", flexGrow: 1 }} stickyScroll stickyStart="bottom">
  {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
</scrollbox>
```

**Markdown** — Assistant responses (uses `MarkdownRenderable` directly since no JSX yet):
- `content`: markdown string
- `syntaxStyle`: required SyntaxStyle object
- `streaming: true` for live updates
- `conceal: true` to hide markdown markers

**Code** — Code blocks:
- `content`: source code
- `filetype`: language for highlighting
- `syntaxStyle`: theme
- `streaming: true` for incremental content

**Diff** — File changes:
- `diff`: unified diff string
- `view`: `"unified"` or `"split"`
- `filetype`: language
- `showLineNumbers: true`

**Textarea** — Chat input:
- `onSubmit`: fires on `Ctrl+Enter` (with `keyBindings`)
- `placeholder`: hint text
- `keyBindings: [{ name: "return", ctrl: true, action: "submit" }]`
- Note: Construct API not available yet — use `TextareaRenderable` directly

**Select** — Session/config lists:
- `options`: `{ name, description }[]`
- Keyboard: `↑/↓` navigate, `Enter` select, `j/k` also work
- Events: `onItemSelected`, `onSelectionChanged`

### Layout System

OpenTUI uses Yoga (CSS Flexbox):
- `flexDirection`: `"column"` (default) or `"row"`
- `flexGrow: 1` — fill available space
- `width: "100%"`, `height: "50%"` — percentage sizing
- `position: "absolute"` — for overlays
- `gap` — spacing between children
- `padding`, `margin` — standard box model

### Colors

```tsx
// Hex strings work everywhere
<text fg="#00FF00">Green text</text>
<box backgroundColor="#1a1b26" borderColor="#414868" />

// RGBA class for programmatic use
import { RGBA } from "@opentui/core";
const color = RGBA.fromHex("#FF0000");
```

### Lifecycle

- Always call `renderer.destroy()` on exit
- Handle `uncaughtException` and `unhandledRejection`
- OpenTUI handles `SIGINT`, `SIGTERM`, etc. by default
- Use `exitOnCtrlC: false` for custom Ctrl+C handling (abort streaming first)

---

## 14. Dependency Graph Position

```
Level 0    install, api, web-ui
Level 1    sdk
Level 2    database
Level 3    server
Level 4    web-sdk
Level 5    cli
Level 5    tui (NEW — depends on api only, same level concept as cli but lighter)
```

The TUI depends only on `@ottocode/api` (for type-safe HTTP calls) and talks to the running server over HTTP. It does NOT depend on sdk, server, or database directly.

---

## 15. Open Questions

1. **Input mode**: `Ctrl+Enter` to send vs `Enter` to send (with `Shift+Enter` for newline)?
   - Leaning `Ctrl+Enter` since multi-line prompts are common
2. **Startup**: Should `otto tui` be a CLI subcommand, or a standalone `otto-tui` binary?
   - Probably `otto tui` subcommand that starts server if needed + launches TUI
3. **Server discovery**: How to find the running server port?
   - Read from `~/.config/otto/server.json` or accept `--port` flag
4. **Markdown vs Text**: For simple responses, should we use `<text>` or always `<markdown>`?
   - Always `<markdown>` — it handles plain text fine and gives us code blocks for free
5. **Note**: `<textarea>` and `<markdown>` don't have Construct/JSX APIs yet in OpenTUI React — may need to use Renderable API directly or check for updates
