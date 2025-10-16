# Terminal Feature Implementation Plan

## Overview

Add persistent terminal management to AGI, allowing LLMs to spawn, monitor, and interact with long-running processes (dev servers, watchers, logs) while keeping ephemeral commands in the existing bash tool.

## PTY Implementation

**Library:** Using [`bun-pty`](https://github.com/sursaone/bun-pty) - a cross-platform pseudoterminal library for Bun
- Native Rust-powered PTY implementation via Bun FFI
- Works on macOS, Linux, and Windows
- Simple API compatible with node-pty patterns
- Zero JavaScript dependencies
- Properly handles interactive shells and terminal I/O

## Architecture

### 1. Backend - Terminal Manager (SDK)

**Location:** `packages/sdk/src/terminals/`

```
terminals/
  ├── manager.ts          # TerminalManager class
  ├── terminal.ts         # Terminal class (pty wrapper)
  ├── circular-buffer.ts  # Rolling line buffer (500 lines)
  └── index.ts            # Exports
```

**TerminalManager API:**
```typescript
class TerminalManager {
  create(opts: { command: string, cwd: string, purpose: string }): Terminal
  get(id: string): Terminal | undefined
  list(): Terminal[]
  kill(id: string): Promise<void>
  killAll(): Promise<void>
}

class Terminal {
  id: string
  pid: number
  command: string
  purpose: string
  cwd: string
  status: 'running' | 'exited'
  exitCode?: number
  createdAt: Date
  
  read(lines?: number): string[]  // Read last N lines
  write(input: string): void      // Write to stdin
  kill(signal?: NodeJS.Signals): void
  
  onData: EventEmitter           // For streaming output
  onExit: EventEmitter
}
```

**Storage Strategy:**
- **In-memory only** - no database persistence
- Circular buffer per terminal (500 lines max)
- Auto-cleanup: exited terminals removed after 5 minutes
- Server restart = clean slate

**Cleanup & Lifecycle:**
```typescript
// On terminal exit
pty.onExit(({ exitCode }) => {
  terminal.status = 'exited'
  terminal.exitCode = exitCode
  
  // Keep for 5 min so LLM can read final output
  setTimeout(() => {
    manager.delete(terminal.id)
  }, 5 * 60 * 1000)
})

// On server shutdown
process.on('SIGTERM', async () => {
  await terminalManager.killAll()
  process.exit(0)
})
```

### 2. LLM Tool Interface

**Location:** `packages/sdk/src/tools/terminal.ts`

```typescript
tool('terminal', {
  description: 'Manage persistent terminals for long-running processes',
  
  parameters: z.object({
    operation: z.enum(['start', 'read', 'write', 'list', 'kill']),
    
    // For 'start'
    command: z.string().optional(),
    purpose: z.string().optional(),
    cwd: z.string().optional(),
    
    // For 'read', 'write', 'kill'
    terminalId: z.string().optional(),
    
    // For 'read'
    lines: z.number().default(100).optional(),
    
    // For 'write'
    input: z.string().optional(),
  }),
  
  execute: async ({ operation, ...params }) => {
    switch (operation) {
      case 'start':
        const term = await terminalManager.create({
          command: params.command,
          purpose: params.purpose,
          cwd: params.cwd || process.cwd()
        })
        return {
          terminalId: term.id,
          pid: term.pid,
          purpose: term.purpose,
          message: `Started: ${params.command}`
        }
      
      case 'read':
        const term = terminalManager.get(params.terminalId)
        if (!term) return { error: 'Terminal not found' }
        return {
          output: term.read(params.lines),
          status: term.status,
          exitCode: term.exitCode
        }
      
      case 'write':
        const term = terminalManager.get(params.terminalId)
        if (!term) return { error: 'Terminal not found' }
        term.write(params.input)
        return { success: true }
      
      case 'list':
        return {
          terminals: terminalManager.list().map(t => ({
            id: t.id,
            purpose: t.purpose,
            command: t.command,
            status: t.status,
            pid: t.pid,
            uptime: Date.now() - t.createdAt.getTime()
          }))
        }
      
      case 'kill':
        await terminalManager.kill(params.terminalId)
        return { success: true }
    }
  }
})
```

**Context Injection:**

Add terminal summary to system prompt or context:
```typescript
// In agent loop, inject before each turn
const terminalContext = terminalManager.list().length > 0
  ? `\n\n## Active Terminals (${terminalManager.list().length}):\n` +
    terminalManager.list().map(t => 
      `- [${t.id}] ${t.purpose} (${t.status}, pid: ${t.pid})`
    ).join('\n')
  : ''

// Append to system message or inject as hidden context
```

### 3. Server API Endpoints

**Location:** `packages/server/src/routes/terminals.ts`

```typescript
// GET /api/terminals
app.get('/api/terminals', async (c) => {
  const terminals = terminalManager.list()
  return c.json({ terminals })
})

// POST /api/terminals
app.post('/api/terminals', async (c) => {
  const { command, purpose, cwd } = await c.req.json()
  const term = await terminalManager.create({ command, purpose, cwd })
  return c.json({ terminalId: term.id })
})

// GET /api/terminals/:id
app.get('/api/terminals/:id', async (c) => {
  const id = c.req.param('id')
  const term = terminalManager.get(id)
  if (!term) return c.json({ error: 'Not found' }, 404)
  return c.json({ terminal: term })
})

// GET /api/terminals/:id/output (SSE stream)
app.get('/api/terminals/:id/output', async (c) => {
  const id = c.req.param('id')
  const term = terminalManager.get(id)
  if (!term) return c.json({ error: 'Not found' }, 404)
  
  // SSE stream for real-time output
  return streamSSE(c, async (stream) => {
    term.onData((line) => {
      stream.write({ data: JSON.stringify({ line }) })
    })
  })
})

// POST /api/terminals/:id/input
app.post('/api/terminals/:id/input', async (c) => {
  const id = c.req.param('id')
  const { input } = await c.req.json()
  const term = terminalManager.get(id)
  if (!term) return c.json({ error: 'Not found' }, 404)
  term.write(input)
  return c.json({ success: true })
})

// DELETE /api/terminals/:id
app.delete('/api/terminals/:id', async (c) => {
  const id = c.req.param('id')
  await terminalManager.kill(id)
  return c.json({ success: true })
})
```

### 4. UI Components (Web)

**Location:** `packages/web-sdk/src/components/terminals/`

```
terminals/
  ├── TerminalsSidebar.tsx       # Right sidebar (like GitSidebar)
  ├── TerminalsSidebarToggle.tsx # Toggle button
  ├── TerminalList.tsx           # List of active terminals
  ├── TerminalTab.tsx            # Single terminal viewer (xterm.js)
  └── TerminalPanel.tsx          # Full-screen terminal view (optional)
```

#### TerminalsSidebar Component Structure

**Pattern:** Follow `GitSidebar.tsx` structure

```typescript
export const TerminalsSidebar = memo(function TerminalsSidebar() {
  const isExpanded = useTerminalStore((state) => state.isExpanded)
  const collapseSidebar = useTerminalStore((state) => state.collapseSidebar)
  const { data: terminals, isLoading } = useTerminals()
  const selectedId = useTerminalStore((state) => state.selectedTerminalId)
  
  if (!isExpanded) return null
  
  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span className="font-medium">Terminals</span>
          {terminals?.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({terminals.length})
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={collapseSidebar}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Terminal list or xterm.js viewer */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedId ? (
          <TerminalViewer terminalId={selectedId} />
        ) : (
          <TerminalList terminals={terminals} />
        )}
      </div>
    </div>
  )
})
```

#### Terminal Viewer with xterm.js

**Dependencies to add:**
```json
{
  "@xterm/xterm": "^5.5.0",
  "@xterm/addon-fit": "^0.10.0"
}
```

**TerminalViewer Component:**
```typescript
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export const TerminalViewer = ({ terminalId }: { terminalId: string }) => {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal>()
  
  useEffect(() => {
    if (!termRef.current) return
    
    const xterm = new Terminal({
      theme: { /* match app theme */ },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      convertEol: true
    })
    
    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(termRef.current)
    fitAddon.fit()
    
    // Connect to SSE stream
    const eventSource = new EventSource(
      `/api/terminals/${terminalId}/output`
    )
    eventSource.onmessage = (event) => {
      const { line } = JSON.parse(event.data)
      xterm.write(line + '\r\n')
    }
    
    // Handle input
    xterm.onData((data) => {
      fetch(`/api/terminals/${terminalId}/input`, {
        method: 'POST',
        body: JSON.stringify({ input: data })
      })
    })
    
    xtermRef.current = xterm
    
    return () => {
      eventSource.close()
      xterm.dispose()
    }
  }, [terminalId])
  
  return <div ref={termRef} className="flex-1" />
}
```

#### Zustand Store

**Location:** `packages/web-sdk/src/stores/terminalStore.ts`

```typescript
interface TerminalState {
  isExpanded: boolean
  selectedTerminalId: string | null
  
  toggleSidebar: () => void
  expandSidebar: () => void
  collapseSidebar: () => void
  selectTerminal: (id: string | null) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isExpanded: false,
  selectedTerminalId: null,
  
  toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
  expandSidebar: () => set({ isExpanded: true }),
  collapseSidebar: () => set({ isExpanded: false, selectedTerminalId: null }),
  selectTerminal: (id) => set({ selectedTerminalId: id }),
}))
```

#### Integration in AppLayout

**Update:** `apps/web/src/components/layout/AppLayout.tsx`

```typescript
// Add after Git sidebar
<div className="hidden md:block">
  <TerminalsSidebarToggle />
  <TerminalsSidebar />
</div>
```

### 5. UI Design Options

**Option A: Sidebar with List + Inline Viewer (Recommended)**
```
┌────────────────────┐
│ Terminals (3)    × │
├────────────────────┤
│ ▶ Dev Server       │ ← Click to expand
│   npm run dev      │
│   Running • 5m     │
│                    │
│ ▼ Build Watcher    │ ← Expanded
│ ┌────────────────┐ │
│ │ [terminal out] │ │ ← xterm.js embedded
│ │ $ bun build    │ │
│ │ Built in 234ms │ │
│ └────────────────┘ │
│                    │
│ ▶ Test Runner      │
└────────────────────┘
```

**Option B: List Only + Full Panel on Click**
```
┌────────────────────┐
│ Terminals (3)    × │
├────────────────────┤
│ [icon] Dev Server  │ ← Click opens panel
│        npm run dev │
│        Running     │
│                    │
│ [icon] Build       │
│        bun build   │
│        Exited (0)  │
└────────────────────┘

When clicked → Opens GitDiffPanel-style overlay with full xterm.js
```

**Option C: Tabs at Top**
```
┌────────────────────┐
│ [Dev] [Build] [×]  │ ← Terminal tabs
├────────────────────┤
│ ┌────────────────┐ │
│ │                │ │
│ │  xterm.js      │ │
│ │  full height   │ │
│ │                │ │
│ └────────────────┘ │
│ [+ New Terminal]   │
└────────────────────┘
```

**Recommendation:** **Option B** - Cleaner, follows existing pattern (Git sidebar → GitDiffPanel)

### 6. User-Created Terminals

**Manual Terminal Creation:**
Users can spawn their own terminals directly from the UI to run commands manually. These terminals live in the same in-memory pool as LLM-created terminals, so LLMs have full context awareness.

**UI Additions:**

```typescript
// In TerminalsSidebar header
<div className="h-14 border-b border-border px-4 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Terminal className="w-4 h-4" />
    <span className="font-medium">Terminals</span>
    {terminals?.length > 0 && (
      <span className="text-xs text-muted-foreground">
        ({terminals.length})
      </span>
    )}
  </div>
  <div className="flex items-center gap-1">
    {/* New terminal button */}
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleNewTerminal}
      title="New terminal"
    >
      <Plus className="w-4 h-4" />
    </Button>
    <Button variant="ghost" size="icon" onClick={collapseSidebar}>
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
</div>
```

**Workflow:**
1. User clicks "+" button in terminal sidebar
2. Opens new terminal viewer with empty shell (bash/zsh)
3. User runs commands manually: `npm run dev`, `git status`, etc.
4. Terminal output captured in circular buffer (same as LLM terminals)
5. LLM can read from these terminals using `terminal read` tool
6. User can reference terminal in messages: "Check the output in terminal X"

**Benefits:**
- **Hybrid workflow:** User runs commands, LLM reads results
- **Context sharing:** LLM sees what user is doing
- **Debugging:** User can inspect server logs, LLM can diagnose
- **Manual override:** User can intervene when LLM gets stuck

**Implementation:**
```typescript
// User-created terminal starts with interactive shell
const handleNewTerminal = async () => {
  const shell = process.env.SHELL || '/bin/bash'
  const term = await terminalManager.create({
    command: shell,
    purpose: 'Manual shell',
    cwd: process.cwd()
  })
  
  // Auto-select and show in viewer
  selectTerminal(term.id)
  expandSidebar()
}
```

**Terminal Metadata Addition:**
```typescript
class Terminal {
  // ... existing fields
  createdBy: 'user' | 'llm'  // Track creator
  title?: string              // User can rename
}
```

**UI Distinction:**
```
┌────────────────────────┐
│ Terminals (3)      [+] │
├────────────────────────┤
│ 🤖 Dev Server          │ ← LLM-created
│    npm run dev         │
│    Running             │
│                        │
│ 👤 My Shell            │ ← User-created
│    bash                │
│    Running             │
│                        │
│ 🤖 Build Watch         │ ← LLM-created
│    bun build --watch   │
│    Running             │
└────────────────────────┘
```

**LLM Context Enhancement:**
```typescript
const terminalContext = terminalManager.list().length > 0
  ? `\n\n## Active Terminals (${terminalManager.list().length}):\n` +
    terminalManager.list().map(t => 
      `- [${t.id}] ${t.purpose} (${t.status}, ${t.createdBy}, pid: ${t.pid})`
    ).join('\n') +
    `\n\nYou can read from any terminal using the 'terminal read' tool, including user-created shells.`
  : ''
```

**Example Workflow:**
```
User: [Clicks + button, creates new terminal]
User: [Types in terminal] npm run dev
[Server starts, shows error in terminal]

User: "Can you check why the dev server failed?"

LLM: [Uses terminal list, sees user's terminal]
     [Calls terminal read to get last 50 lines]
     [Diagnoses: "Port 3000 is already in use..."]
```

## Implementation Phases

### Phase 1: Core Backend (SDK + Tool)
- [ ] Create `packages/sdk/src/terminals/` structure
- [ ] Implement `TerminalManager` and `Terminal` classes
- [ ] Add circular buffer implementation
- [ ] Add `createdBy` field to Terminal class
- [ ] Register `terminal` tool in SDK tools registry
- [ ] Add cleanup handlers (SIGTERM, exit events)
- [ ] Test: spawn terminal, read output, kill process

### Phase 2: Server API
- [ ] Create `packages/server/src/routes/terminals.ts`
- [ ] Implement REST endpoints (CRUD)
- [ ] Implement SSE streaming endpoint for output
- [ ] Register routes in server
- [ ] Test: API calls via curl/Postman

### Phase 3: UI Foundation
- [ ] Add xterm.js dependencies
- [ ] Create `packages/web-sdk/src/stores/terminalStore.ts`
- [ ] Create `packages/web-sdk/src/hooks/useTerminals.ts`
- [ ] Create basic `TerminalsSidebar.tsx` component
- [ ] Create `TerminalsSidebarToggle.tsx`
- [ ] Add "New Terminal" button in sidebar header
- [ ] Test: Toggle sidebar, fetch terminals

### Phase 4: Terminal Viewer
- [ ] Implement `TerminalViewer.tsx` with xterm.js
- [ ] Connect SSE stream for real-time output
- [ ] Handle user input (stdin)
- [ ] Add theme matching (light/dark)
- [ ] Test: View running terminal output

### Phase 5: UI Polish & Integration
- [ ] Implement `TerminalList.tsx` component
- [ ] Add terminal item styling (running/exited states)
- [ ] Add visual distinction (icons) for user vs LLM terminals
- [ ] Integrate into `AppLayout.tsx`
- [ ] Add keyboard shortcuts (if needed)
- [ ] Test: Full workflow (create → view → kill)

### Phase 6: LLM Context Injection
- [ ] Add terminal summary to agent context
- [ ] Include `createdBy` info in context
- [ ] Test: LLM awareness of running terminals
- [ ] Test: LLM reading from user-created terminals
- [ ] Optimize: Only inject when terminals exist

### Phase 7: Polish & Edge Cases
- [ ] Handle terminal resize (FitAddon)
- [ ] Add terminal name/rename functionality
- [ ] Add right-click menu (rename, kill, copy output)
- [ ] Add "kill all" button
- [ ] Handle zombie processes gracefully
- [ ] Add error handling for failed spawns
- [ ] Mobile responsiveness (hide on small screens)

## Tool Usage Guidelines for LLM

**When to use `terminal` vs `bash`:**

### Use `terminal` for:
- Dev servers: `npm run dev`, `bun run dev`
- File watchers: `bun test --watch`, `nodemon`
- Build watchers: `bun build --watch`
- Log tailing: `tail -f logs/app.log`
- Background services: `docker compose up`
- Any process that needs to stay alive

### Use `bash` for:
- Status checks: `git status`, `ls`, `ps`
- One-off commands: `mkdir`, `rm`, `curl`
- Quick scripts: `bun run build`, `git commit`
- File operations: `cat`, `grep`, `sed`

**Example LLM workflow:**
```
User: "Start the dev server and watch for errors"

LLM uses:
1. terminal start: { command: "npm run dev", purpose: "dev server" }
   → Returns terminalId: "term-abc123"

2. [Wait for user to report issue]

3. terminal read: { terminalId: "term-abc123", lines: 50 }
   → Reviews last 50 lines for errors

4. [LLM diagnoses issue and fixes code]

5. terminal read: { terminalId: "term-abc123", lines: 20 }
   → Confirms server restarted successfully
```

## Dependencies to Add

```bash
# Backend - PTY library for Bun
cd packages/sdk
bun add bun-pty

# Frontend
bun add --filter @agi-cli/web-sdk @xterm/xterm @xterm/addon-fit
```

## Security Considerations

- **Command validation:** Warn on dangerous commands (rm -rf, etc.)
- **Path restrictions:** Restrict cwd to project directory
- **Resource limits:** Max N terminals per session (e.g., 10)
- **Auto-cleanup:** Kill orphaned processes on server restart
- **No secret exposure:** Don't log env vars or sensitive input

## Testing Checklist

- [ ] Spawn terminal and read output
- [ ] Write to stdin (interactive commands)
- [ ] Kill terminal gracefully
- [ ] Handle crashed processes (exit code)
- [ ] Multiple terminals running simultaneously
- [ ] Circular buffer doesn't grow unbounded
- [ ] Server shutdown kills all terminals
- [ ] SSE stream delivers real-time output
- [ ] UI updates when terminal exits
- [ ] Theme switching (light/dark) in xterm.js

## Future Enhancements (Out of Scope)

- Persistent storage (SQLite) for terminal history
- Terminal recording/playback
- Collaborative terminals (multiple users)
- Terminal sharing via URL
- Custom terminal profiles (saved commands)
- Split panes (multiple terminals in view)

## Questions to Resolve

1. **Sidebar placement:** Right sidebar below Git panel, or separate toggle? → **Below Git, separate section**
2. **Mobile behavior:** Hide completely or show in modal? → **Hide on mobile (like Git sidebar)**
3. **Max terminals:** Hard limit per session? → **10 terminals max**
4. **Buffer size:** 500 lines enough? → **Start with 500, make configurable later**
5. **Terminal naming:** Auto-generate or user-provided? → **Auto from purpose, allow rename**

---

## Summary

This plan implements in-memory persistent terminals for LLM control, following existing patterns (Git sidebar, Zustand stores, SSE streaming). No database overhead, clean lifecycle management, and clear separation from ephemeral bash tool.

**Key trade-offs accepted:**
- No persistence across server restarts (acceptable for dev workflows)
- Limited buffer (500 lines) - enough for debugging, not archival
- In-memory only - simpler, faster, no DB bloat

**Next step:** Review plan, discuss UI approach (Option B recommended), then begin Phase 1 implementation.
