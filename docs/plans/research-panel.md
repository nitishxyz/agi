# Research Panel

## Overview

A dedicated research agent panel in the right sidebar that can query local session history, search codebase, and assist with context gathering—all without polluting the main conversation.

Research sessions are **persisted** and **linked to main sessions**, allowing multiple research threads per session with full history.

---

## Data Model

```
Main Session (id: "session-abc")
  └── Research Session 1 (parentSessionId: "session-abc", sessionType: "research")
  └── Research Session 2 (parentSessionId: "session-abc", sessionType: "research")
  └── Research Session 3 (parentSessionId: "session-abc", sessionType: "research")
```

Uses existing schema fields:
- `parentSessionId` - Links research session to main session
- `sessionType` - Set to `"research"` (vs `"main"`)

---

## UI Location

Lives in the **right sidebar**, same pattern as Git, Session Files, and Terminals:

```
┌────────────────────────────────────┬────────────────────────────────┬────┐
│  Main Chat Area                    │  Research Panel (expanded)     │Tabs│
│                                    │  ┌────────────────────────────┐│ ┌──┐
│                                    │  │ 🔬 Research    [📜][+] [→] ││ │📁│
│                                    │  ├────────────────────────────┤│ │📄│
│                                    │  │ Provider: [Anthropic ▼]   ││ │🖥 │
│                                    │  │ Model: [sonnet ▼]         ││ │🔬│
│                                    │  ├────────────────────────────┤│ │  │
│                                    │  │                            ││ │☀️ │
│                                    │  │ [Chat messages...]         ││ └──┘
│                                    │  │                            ││    │
│                                    │  ├────────────────────────────┤│    │
│                                    │  │ > Ask anything...     [⏎]  ││    │
│                                    │  ├────────────────────────────┤│    │
│                                    │  │ [Inject Here] [→ New Session] │    │
│                                    │  └────────────────────────────┘│    │
└────────────────────────────────────┴────────────────────────────────┴────┘

Header buttons:
[📜] History - show list of research sessions for this main session
[+]  New - create new research session
[→]  Collapse - close panel
```

### History Dropdown (📜 click)

```
┌────────────────────────────────────┐
│ Research Sessions                  │
├────────────────────────────────────┤
│ ● Auth patterns research      12m  │ ← active
│ ○ Database schema questions    2h  │
│ ○ API design exploration       1d  │
└────────────────────────────────────┘
```

Click to switch between research sessions.

---

## Injection Actions

Two ways to use research findings:

### [Inject Here]
Adds a `<research-context>` block to the **current main session**:

```xml
<research-context 
  from="research-session-xyz"
  injected-at="2024-01-15T10:30:00Z">
  
  Summary of auth patterns from previous sessions:
  - JWT tokens with refresh flow
  - Middleware at src/middleware/auth.ts
  ...
  
</research-context>
```

### [→ New Session]
Creates a **new main session** with the context pre-injected as the first system context.

---

## Research Agent

### Toolset

Inherits everything a **plan agent** has, plus database query tools:

| Tool | Description |
|------|-------------|
| `query_sessions` | Search and list sessions from local SQLite |
| `query_messages` | Search messages across sessions |
| `get_session_context` | Get full context/summary for a session |
| `search_history` | Full-text search across all message content |

**Scope**: Current project only (by `projectPath`).

### Database Query Tools

**`query_sessions`**
```typescript
interface QuerySessionsInput {
  limit?: number;           // Default: 20
  offset?: number;
  projectPath?: string;     // Filter by project (auto-set to current)
  agent?: string;           // Filter by agent type
  startDate?: string;       // ISO date string
  endDate?: string;
  orderBy?: 'created_at' | 'last_active_at' | 'total_tokens';
  orderDir?: 'asc' | 'desc';
}

interface QuerySessionsOutput {
  sessions: Array<{
    id: string;
    title: string | null;
    agent: string;
    provider: string;
    model: string;
    createdAt: number;
    lastActiveAt: number | null;
    totalInputTokens: number | null;
    totalOutputTokens: number | null;
    messageCount: number;
  }>;
  total: number;
}
```

**`query_messages`**
```typescript
interface QueryMessagesInput {
  sessionId?: string;       // Filter by session
  role?: 'user' | 'assistant' | 'system' | 'tool';
  search?: string;          // Full-text search in content
  toolName?: string;        // Filter by tool calls
  limit?: number;           // Default: 50
  offset?: number;
  startDate?: string;
  endDate?: string;
}

interface QueryMessagesOutput {
  messages: Array<{
    id: string;
    sessionId: string;
    sessionTitle: string | null;
    role: string;
    agent: string;
    model: string;
    createdAt: number;
    contentPreview: string;  // First 200 chars
    totalTokens: number | null;
  }>;
  total: number;
}
```

**`get_session_context`**
```typescript
interface GetSessionContextInput {
  sessionId: string;
  includeMessages?: boolean;  // Default: false
  messageLimit?: number;      // Default: 50
}

interface GetSessionContextOutput {
  session: Session;
  contextSummary: string | null;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: number;
  }>;
  stats: {
    totalMessages: number;
    totalToolCalls: number;
    uniqueTools: string[];
    totalTokens: number;
  };
}
```

**`search_history`**
```typescript
interface SearchHistoryInput {
  query: string;            // Search term
  limit?: number;           // Default: 20
}

interface SearchHistoryOutput {
  results: Array<{
    sessionId: string;
    sessionTitle: string | null;
    messageId: string;
    role: string;
    matchedContent: string;  // Snippet with match highlighted
    createdAt: number;
  }>;
  total: number;
}
```

---

## Use Cases

1. **Find Previous Work**: "What did I work on yesterday?"
2. **Locate Past Solution**: "Search for when I fixed the authentication bug"
3. **Prepare Context**: "Summarize our auth discussions so I can start a new session"
4. **Cross-Session Patterns**: "Find all sessions where I used the database tool"
5. **Code Research**: Uses inherited plan agent tools (file search, grep, etc.)

---

## API Endpoints

### Research Session CRUD

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v1/sessions/:id/research` | GET | List research sessions for a main session |
| `POST /v1/sessions/:id/research` | POST | Create new research session linked to main |
| `DELETE /v1/research/:id` | DELETE | Delete a research session |

**List Research Sessions:**
```typescript
// GET /v1/sessions/:parentId/research
interface ListResearchResponse {
  sessions: Array<{
    id: string;
    title: string | null;
    createdAt: number;
    lastActiveAt: number | null;
    messageCount: number;
  }>;
}
```

**Create Research Session:**
```typescript
// POST /v1/sessions/:parentId/research
interface CreateResearchRequest {
  provider?: string;  // Default: from config
  model?: string;     // Default: from config
  title?: string;     // Optional label
}

interface CreateResearchResponse {
  session: Session;
  parentSessionId: string;
}
```

### Context Injection

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/sessions/:id/inject` | POST | Inject context into current main session |
| `POST /v1/research/:id/export` | POST | Create new main session with research context |

**Inject into Current Session:**
```typescript
// POST /v1/sessions/:parentId/inject
interface InjectContextRequest {
  researchSessionId: string;
  messageIds?: string[];      // Specific messages (default: summary of all)
  label?: string;             // e.g., "Auth research"
}

interface InjectContextResponse {
  injectedMessageId: string;
  tokenEstimate: number;
}
```

**Export to New Session:**
```typescript
// POST /v1/research/:researchId/export
interface ExportToSessionRequest {
  provider?: string;
  model?: string;
  agent?: string;
  messageIds?: string[];      // Specific messages to include
}

interface ExportToSessionResponse {
  newSession: Session;
  injectedContext: string;
}
```

### Research Chat (streaming)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/research/:id/chat` | POST | Send message to research session (SSE stream) |

Same pattern as main session chat, but uses research agent with db tools.

---

## Implementation

### Phase 1: Database Tools (~2 days)

**Location: `packages/sdk/src/tools/database/`**
```
packages/sdk/src/tools/database/
├── index.ts
├── query-sessions.ts
├── query-messages.ts
├── get-session-context.ts
└── search-history.ts
```

Each tool:
- Uses drizzle to query `.agi/agi.db`
- Auto-scopes to current project via `projectPath`
- Returns structured data with pagination

### Phase 2: Research Agent (~1 day)

**File: `packages/sdk/src/agents/research.ts`**

```typescript
import { planAgent } from './plan.ts';
import { dbTools } from '../tools/database/index.ts';

export const researchAgent = {
  ...planAgent,
  name: 'research',
  description: 'Research agent with session history access',
  tools: [...planAgent.tools, ...dbTools],
  systemPrompt: `You are a research assistant with access to session history...`,
};
```

### Phase 3: API Endpoints (~1-2 days)

**Files:**
- `packages/server/src/routes/research.ts` - CRUD + chat
- Update `packages/server/src/routes/sessions.ts` - inject endpoint

### Phase 4: Frontend Components (~3-4 days)

**New files in `packages/web-sdk/src/`:**

```
components/research/
├── ResearchSidebar.tsx           # Panel container
├── ResearchSidebarToggle.tsx     # Tab button
├── ResearchHeader.tsx            # Provider/model selector, history, new
├── ResearchHistoryDropdown.tsx   # List of research sessions
├── ResearchMessages.tsx          # Message list
├── ResearchInput.tsx             # Chat input
└── ResearchActions.tsx           # Inject Here / New Session buttons

stores/
└── researchStore.ts
    - isExpanded: boolean
    - activeResearchSessionId: string | null
    - toggleSidebar()
    - collapseSidebar()
    - expandSidebar()
    - selectResearchSession(id)

hooks/
├── useResearchSessions.ts        # List research sessions for main
├── useCreateResearchSession.ts
├── useResearchChat.ts            # Stream messages
├── useInjectContext.ts
└── useExportToSession.ts
```

### Phase 5: Wire into AppLayout (~0.5 day)

**Update: `apps/web/src/components/layout/AppLayout.tsx`**

```diff
+ import { ResearchSidebar, ResearchSidebarToggle } from '@agi-cli/web-sdk/components';

  {/* Panels */}
  <GitSidebar />
  <SessionFilesSidebar sessionId={sessionId} />
  <TerminalsSidebar />
+ <ResearchSidebar parentSessionId={sessionId} />

  {/* Tab buttons */}
  <GitSidebarToggle />
  <SessionFilesSidebarToggle sessionId={sessionId} />
  <TerminalsSidebarToggle />
+ <ResearchSidebarToggle />
```

### Phase 6: Polish (~1 day)

- Keyboard shortcut: `Cmd+Shift+R` to toggle
- Loading states
- Empty states
- Error handling

---

## Schema

**No changes needed.** Existing fields support the model:

```typescript
// sessions table already has:
parentSessionId: text('parent_session_id'),
sessionType: text('session_type').default('main'), // 'main' | 'research'
```

Query research sessions:
```sql
SELECT * FROM sessions 
WHERE parent_session_id = :mainSessionId 
AND session_type = 'research'
ORDER BY last_active_at DESC;
```

---

## Future Enhancements

1. **Global scope** - Search across all projects
2. **FTS optimization** - SQLite full-text search for `search_history`
3. **Context editing** - Edit injected context before sending
4. **Research templates** - Common research prompts

---

## Implementation Order

| Phase | Effort | Description |
|-------|--------|-------------|
| 1. Database tools | ~2 days | Query tools with drizzle |
| 2. Research agent | ~1 day | Extend plan agent |
| 3. API endpoints | ~1-2 days | CRUD, chat, inject, export |
| 4. Frontend components | ~3-4 days | Sidebar, history, messages, actions |
| 5. Wire into AppLayout | ~0.5 day | Add to right sidebar |
| 6. Polish | ~1 day | Shortcuts, states, errors |

**Total: ~8-10 days**
