# Research Panel & Session Handoff

## Overview

Two related features for managing context and parallel work in AGI sessions:

1. **Research Panel** - A fully independent side session for parallel research
2. **Session Handoff** - Transfer context to a new session when current one grows too large

---

## Feature 1: Research Panel

### Problem

During a long session, users often need to:
- Look up information without polluting main context
- Research patterns/docs while main session is running
- Use different models for different tasks (fast for lookups, powerful for analysis)
- Build up research findings before injecting them into main session

### Solution

A floating panel that runs a fully independent session alongside the main one.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| Independent model/provider | Use any configured provider and model |
| Parallel execution | Research while main session runs tools |
| Persistent state | Not ephemeral - can revisit research sessions |
| Context injection | Push findings into main session as structured context |
| Minimal overhead | Can use fast/cheap models for quick lookups |

### UI Design

```
┌────────────────────────────────────┐     ┌─────────────────────────────────┐
│  Main Session                      │     │  Research Panel            [×]  │
│  ┌──────────────────────────────┐  │     │  ┌────────────────────────────┐ │
│  │ claude-sonnet / anthropic    │  │     │  │ Provider: [OpenAI    ▼]   │ │
│  │                              │  │     │  │ Model:    [gpt-4o-mini ▼] │ │
│  │ [Working on feature...]      │  │     │  ├────────────────────────────┤ │
│  │                              │  │     │  │                            │ │
│  │                              │  │     │  │ User: "what's the auth     │ │
│  │                              │  │     │  │ pattern in this codebase?" │ │
│  │                              │  │     │  │                            │ │
│  │ <research-context>           │◄─┼─────┼──│ Assistant: "The codebase   │ │
│  │   [Injected findings...]     │  │     │  │ uses JWT tokens with..."   │ │
│  │ </research-context>          │  │     │  │                            │ │
│  │                              │  │     │  │ [Select messages to inject]│ │
│  └──────────────────────────────┘  │     │  └────────────────────────────┘ │
│                                    │     │  [Minimize] [Inject Selected →] │
└────────────────────────────────────┘     └─────────────────────────────────┘
```

### User Interaction

| Action | Trigger |
|--------|---------|
| Open panel | `Cmd+Shift+R` or `/research` command |
| Switch model | Dropdown in panel header |
| Send message | Enter in research input |
| Select messages | Checkbox on messages to inject |
| Inject to main | "Inject" button or `Cmd+Enter` |
| Minimize | Collapse to floating icon |
| Close | X button (session persists, can reopen) |

### Use Cases

1. **Quick Lookups**
   - "What file has the auth middleware?"
   - Use: `gpt-4o-mini` for speed

2. **Deep Research**
   - "Analyze this codebase's architecture patterns"
   - Use: `claude-sonnet` for depth

3. **Documentation**
   - Read external docs, summarize for main session
   - Use: Model with web access if available

4. **Parallel Work**
   - Research continues while main session executes tools
   - No blocking, no context pollution

5. **Model Comparison**
   - Test same prompt on different models
   - Pick best response to inject

---

## Feature 2: Session Handoff

### Problem

Sessions grow large over time:
- Context window fills up
- Token costs increase
- Model performance degrades with too much context
- `/compact` helps but sometimes a fresh start is better

### Solution

Create a new session with intelligent context transfer from the current one.

### Handoff Flow

```
Session A (long, context-heavy)
        │
        ▼  User: /handoff
┌───────────────────────────────────────┐
│ Generate Handoff Summary:             │
│ - Goals achieved                      │
│ - Files created/modified              │
│ - Key decisions made                  │
│ - Current state of work               │
│ - Pending tasks                       │
│ - Critical context & gotchas          │
└───────────────────────────────────────┘
        │
        ▼  Create New Session B
┌───────────────────────────────────────┐
│ System context includes:              │
│ <handoff-context from="session-a">    │
│   [Generated Summary]                 │
│ </handoff-context>                    │
│                                       │
│ User: "Continue working on..."        │
└───────────────────────────────────────┘
```

### Handoff Options

| Option | Description |
|--------|-------------|
| Same config | Keep provider/model/agent |
| Switch model | Hand off to different model (e.g., Claude → GPT) |
| Switch agent | Hand off to specialized agent |
| Summary only | Minimal context (faster, cheaper) |
| Full context | Include more detail (better continuity) |

### UI for Handoff

```
┌─────────────────────────────────────────────┐
│  Hand Off Session                           │
│  ─────────────────────────────────────────  │
│                                             │
│  Current: claude-sonnet-4 / anthropic       │
│                                             │
│  New Session Configuration:                 │
│  ┌─────────────────────────────────────────┐│
│  │ Provider: [Anthropic        ▼]          ││
│  │ Model:    [claude-sonnet-4  ▼]          ││
│  │ Agent:    [code             ▼]          ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Context Transfer:                          │
│  ○ Summary only (recommended)               │
│  ○ Full context (more tokens)               │
│                                             │
│  [Cancel]                    [Hand Off →]   │
└─────────────────────────────────────────────┘
```

---

## Technical Implementation

### Phase 1: Schema Changes

**File: `packages/database/src/schema/sessions.ts`**

```typescript
export const sessions = sqliteTable('sessions', {
  // ... existing fields ...
  
  // New fields for research/handoff
  parentSessionId: text('parent_session_id').references(() => sessions.id),
  sessionType: text('session_type').default('main'), // 'main' | 'research' | 'handoff'
  handoffSummary: text('handoff_summary'), // Context transferred from parent
  archivedAt: integer('archived_at', { mode: 'number' }), // When session was handed off
});
```

**Migration required** - generate with `bunx drizzle-kit generate`

### Phase 2: API Endpoints

**File: `packages/server/src/routes/research.ts`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/sessions/:id/research` | POST | Create research session linked to parent |
| `/v1/sessions/:id/research` | GET | List research sessions for a parent |
| `/v1/sessions/:id/inject` | POST | Inject context from research → parent |

**File: `packages/server/src/routes/handoff.ts`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/sessions/:id/handoff` | POST | Create new session with context transfer |

### Phase 3: API Request/Response Schemas

**Create Research Session:**
```typescript
// POST /v1/sessions/:parentId/research
interface CreateResearchRequest {
  provider?: string;  // Default: parent's provider
  model?: string;     // Default: fast model for provider
  title?: string;     // Optional label
}

interface CreateResearchResponse {
  session: Session;
  parentSessionId: string;
}
```

**Inject Context:**
```typescript
// POST /v1/sessions/:parentId/inject
interface InjectContextRequest {
  fromSessionId: string;      // Research session ID
  messageIds?: string[];      // Specific messages (default: all assistant messages)
  format: 'summary' | 'full'; // LLM-summarized or raw
  label?: string;             // e.g., "Auth research"
}

interface InjectContextResponse {
  injectedPartId: string;
  tokenEstimate: number;
}
```

**Handoff Session:**
```typescript
// POST /v1/sessions/:id/handoff
interface HandoffRequest {
  provider?: string;
  model?: string;
  agent?: string;
  summaryOnly?: boolean;  // Default: true
}

interface HandoffResponse {
  newSession: Session;
  oldSessionId: string;
  summary: string;
  tokensSaved: number;
}
```

### Phase 4: Frontend Components

**New Files:**
```
packages/web-sdk/src/
├── components/research/
│   ├── ResearchPanel.tsx           # Main floating panel container
│   ├── ResearchHeader.tsx          # Model/provider selector, minimize/close
│   ├── ResearchMessages.tsx        # Message list with selection
│   ├── ResearchInput.tsx           # Chat input
│   └── InjectButton.tsx            # Inject selected messages
├── components/handoff/
│   ├── HandoffModal.tsx            # Configuration modal
│   └── HandoffSummaryPreview.tsx   # Preview generated summary
├── hooks/
│   ├── useResearchSession.ts       # Research session CRUD
│   ├── useResearchStream.ts        # SSE for research session
│   └── useHandoff.ts               # Handoff flow
└── stores/
    └── researchStore.ts            # Panel state (open, minimized, active session)
```

### Phase 5: Commands

**Update: `packages/web-sdk/src/lib/commands.ts`**

```typescript
{
  id: 'research',
  label: '/research',
  description: 'Open research panel',
  icon: Search,
},
{
  id: 'handoff',
  label: '/handoff',
  description: 'Hand off context to new session',
  icon: ArrowRightCircle,
},
```

### Phase 6: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+R` | Toggle research panel |
| `Cmd+Shift+H` | Open handoff modal |
| `Cmd+Enter` (in research) | Inject selected to main |
| `Escape` (in research) | Minimize panel |

---

## Context Injection Format

When research findings are injected, they appear as a special message part:

```xml
<research-context 
  label="Auth patterns" 
  from="research-abc123"
  injected-at="2024-01-15T10:30:00Z">
  
  The codebase uses JWT-based authentication with the following pattern:
  
  1. Middleware at `src/middleware/auth.ts` validates tokens
  2. Tokens are issued by `src/routes/auth/login.ts`
  3. Refresh logic in `src/routes/auth/refresh.ts`
  
  Key files:
  - `packages/server/src/middleware/auth.ts`
  - `packages/database/src/schema/users.ts`
  
</research-context>
```

This format:
- Clearly marks injected context
- Includes provenance (which research session)
- Can be collapsed/expanded in UI
- Models understand it's reference material, not conversation

---

## Handoff Summary Format

Generated by LLM, stored in `handoff_summary`:

```xml
<handoff-context 
  from="session-xyz"
  created-at="2024-01-15T10:30:00Z"
  tokens-original="45000"
  tokens-summary="2500">

## Goals
- Implement user authentication system
- Add OAuth2 support for Google/GitHub

## Completed
- [x] JWT token generation and validation
- [x] Login/logout endpoints
- [x] Basic middleware

## In Progress
- [ ] OAuth2 integration (started Google, ~60% done)

## Files Modified
- `packages/server/src/routes/auth/` (created)
- `packages/database/src/schema/users.ts` (added oauth fields)
- `packages/server/src/middleware/auth.ts` (created)

## Key Decisions
- Using `jose` library for JWT (not jsonwebtoken) - better TypeScript support
- Storing refresh tokens in database, not cookies
- OAuth state stored in Redis for CSRF protection

## Gotchas
- Google OAuth requires verified domain for production
- Rate limiting not yet implemented on auth endpoints

## Next Steps
1. Complete Google OAuth callback handler
2. Add GitHub OAuth provider
3. Implement rate limiting

</handoff-context>
```

---

## Implementation Order

### MVP (Phase 1-2): ~3-4 days
1. Schema migration for `parentSessionId`, `sessionType`
2. Research session creation endpoint
3. Basic ResearchPanel UI (reuse existing message components)
4. `/research` command

### Full Research Panel (Phase 3): ~2-3 days
5. Model/provider selector in panel
6. Message selection UI
7. Context injection endpoint
8. Inject button + formatting

### Handoff (Phase 4): ~2-3 days
9. Handoff summary generation (extend compaction logic)
10. Handoff endpoint
11. HandoffModal UI
12. `/handoff` command

### Polish (Phase 5): ~1-2 days
13. Keyboard shortcuts
14. Panel minimize/restore
15. Research session history
16. Tests

---

## Open Questions

1. **Research session limits**: Max concurrent research sessions per main session?
2. **Injection editing**: Can users edit injected context before sending?
3. **Research tools**: Should research sessions have access to same tools as main?
4. **Handoff chain**: Allow viewing full handoff history? (A → B → C)
5. **Auto-handoff**: Suggest handoff when context gets too large?

---

## Success Metrics

- Reduced context window usage in main sessions
- Faster research workflows (parallel execution)
- Higher quality injected context (curated vs automatic)
- User adoption of `/research` and `/handoff` commands
