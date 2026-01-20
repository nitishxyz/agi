# Session Branching (Fork)

## Overview

Create new sessions that inherit the **full history** from a parent session up to a specific message. Unlike handoff (which compresses), branching copies the entire conversation to enable parallel exploration.

---

## Problem

Users often reach a point where they want to:
- Try multiple approaches from the same starting point
- Explore different solutions without losing the original path
- A/B test different models with identical context
- Create "checkpoints" they can branch from later
- Share research context across multiple task sessions

**Handoff solves a different problem** (context too large, need fresh start with summary).

**Branching solves**: "I want to go in multiple directions from here."

---

## Core Concept

```
Session A (original)
│
├── Message 1: User setup
├── Message 2: Assistant research
├── Message 3: User question
├── Message 4: Assistant analysis    ← Branch point
│
├── Message 5: User: "Try approach A"
└── Message 6: Assistant working...

                    ↓ Fork from Message 4

Session B (forked)                    Session C (forked)
│                                     │
├── Message 1: (copied)               ├── Message 1: (copied)
├── Message 2: (copied)               ├── Message 2: (copied)
├── Message 3: (copied)               ├── Message 3: (copied)
├── Message 4: (copied)               ├── Message 4: (copied)
│                                     │
├── Message 5: "Try approach B"       ├── Message 5: "Try approach C"
└── ...continues independently        └── ...continues independently
```

---

## Key Differences from Handoff

| Aspect | Branching | Handoff |
|--------|-----------|---------|
| History | Full copy | Summarized |
| Purpose | Parallel exploration | Fresh start |
| Token usage | Same as original | Reduced |
| Use when | Want to try multiple paths | Context too large |
| Parent state | Continues normally | Archived |

---

## User Experience

### Message Actions (Hover Reveal)

On hovering any assistant message, show actions in **both header and footer**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✦ build · anthropic · claude-opus-4-5 · 12:21 AM              [🔀]  │ ← header: branch icon
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  "Based on my analysis, you could approach this several ways..."    │
│  ...message content continues...                                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [🔀 Branch] [📋 Copy]                                              │ ← footer: actions with labels
└─────────────────────────────────────────────────────────────────────┘
```

**When not hovering** - clean, no actions visible:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✦ build · anthropic · claude-opus-4-5 · 12:21 AM                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  "Based on my analysis, you could approach this several ways..."    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Action placement rationale:**

| Location | Actions | Style | Why |
|----------|---------|-------|-----|
| Header | Branch only | Icon `[🔀]` | Quick access while scrolling long messages |
| Footer | Branch, Copy | Labels `[🔀 Branch] [📋 Copy]` | Discoverable after reading message |

**Notes:**
- Both header and footer appear together on hover
- Header icon is compact (no label) - for quick access
- Footer has labels - for discoverability
- No like/dislike buttons (not needed for dev tool)
- Footer can expand with more actions later (e.g., "Quote in reply")

### Branch Modal

```
┌─────────────────────────────────────────────┐
│  Branch Session                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Creating branch from message #4            │
│  "Based on my analysis, you could..."       │
│                                             │
│  New Session Configuration:                 │
│  ┌─────────────────────────────────────────┐│
│  │ Provider: [Same as parent  ▼]           ││
│  │ Model:    [Same as parent  ▼]           ││
│  │ Agent:    [Same as parent  ▼]           ││
│  └─────────────────────────────────────────┘│
│                                             │
│  □ Switch to new session after creation     │
│                                             │
│  History: 4 messages will be copied         │
│  Est. tokens: ~12,500                       │
│                                             │
│  [Cancel]                    [Create Branch]│
└─────────────────────────────────────────────┘
```

### Quick Branch (Keyboard)

- `Cmd+Shift+B` on selected message → Branch with same config
- Opens new session in new tab/panel

### Session List View

Show branch relationships:

```
┌─────────────────────────────────────┐
│  Sessions                           │
│  ─────────────────────────────────  │
│                                     │
│  ▼ Auth implementation (main)       │
│    ├─ Branch: Try JWT approach      │
│    ├─ Branch: Try session tokens    │
│    └─ Branch: Try OAuth only        │
│                                     │
│  ▼ API refactor (main)              │
│    └─ Branch: GraphQL experiment    │
│                                     │
│  Database migration (no branches)   │
└─────────────────────────────────────┘
```

---

## Technical Implementation

### Schema Changes

**File: `packages/database/src/schema/sessions.ts`**

```typescript
export const sessions = sqliteTable('sessions', {
  // ... existing fields ...
  
  // Branching fields
  parentSessionId: text('parent_session_id').references(() => sessions.id),
  branchPointMessageId: text('branch_point_message_id').references(() => messages.id),
  sessionType: text('session_type').default('main'), // 'main' | 'branch' | 'research'
});
```

**Note**: Messages and message_parts are **copied** to new session, not referenced. This ensures:
- Branches are fully independent
- Deleting parent doesn't affect branches
- Each branch can modify its own history (future: edit messages)

### API Endpoints

**File: `packages/server/src/routes/branch.ts`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/sessions/:id/branch` | POST | Create branch from specific message |
| `/v1/sessions/:id/branches` | GET | List all branches of a session |

### Request/Response

**Create Branch:**
```typescript
// POST /v1/sessions/:parentId/branch
interface CreateBranchRequest {
  fromMessageId: string;      // Branch point (include this message and all before)
  provider?: string;          // Default: same as parent
  model?: string;             // Default: same as parent
  agent?: string;             // Default: same as parent
  title?: string;             // Default: "Branch of {parent.title}"
  switchTo?: boolean;         // Default: true - navigate to new session
}

interface CreateBranchResponse {
  session: Session;
  parentSessionId: string;
  branchPointMessageId: string;
  copiedMessages: number;
  copiedParts: number;
  estimatedTokens: number;
}
```

**List Branches:**
```typescript
// GET /v1/sessions/:id/branches
interface ListBranchesResponse {
  branches: Array<{
    session: Session;
    branchPointMessageId: string;
    branchPointPreview: string;  // First 100 chars of branch point message
    createdAt: number;
  }>;
}
```

### Branch Creation Logic

**File: `packages/server/src/runtime/branch.ts`**

```typescript
export async function createBranch(
  db: Database,
  parentSessionId: string,
  fromMessageId: string,
  options: {
    provider?: string;
    model?: string;
    agent?: string;
    title?: string;
  }
): Promise<BranchResult> {
  // 1. Get parent session
  const parent = await getSession(db, parentSessionId);
  
  // 2. Get all messages up to and including fromMessageId
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, parentSessionId))
    .orderBy(asc(messagesTable.createdAt));
  
  const branchPointIndex = messages.findIndex(m => m.id === fromMessageId);
  if (branchPointIndex === -1) throw new Error('Branch point message not found');
  
  const messagesToCopy = messages.slice(0, branchPointIndex + 1);
  
  // 3. Create new session
  const newSession = await createSession(db, {
    ...parent,
    ...options,
    parentSessionId,
    branchPointMessageId: fromMessageId,
    sessionType: 'branch',
    title: options.title || `Branch of ${parent.title || 'Untitled'}`,
  });
  
  // 4. Copy messages with new IDs
  const messageIdMap = new Map<string, string>(); // old -> new
  
  for (const msg of messagesToCopy) {
    const newMessageId = crypto.randomUUID();
    messageIdMap.set(msg.id, newMessageId);
    
    await db.insert(messagesTable).values({
      ...msg,
      id: newMessageId,
      sessionId: newSession.id,
    });
    
    // 5. Copy message parts
    const parts = await db
      .select()
      .from(messagePartsTable)
      .where(eq(messagePartsTable.messageId, msg.id));
    
    for (const part of parts) {
      await db.insert(messagePartsTable).values({
        ...part,
        id: crypto.randomUUID(),
        messageId: newMessageId,
      });
    }
  }
  
  return {
    session: newSession,
    copiedMessages: messagesToCopy.length,
    // ...
  };
}
```

### Frontend Components

**New Files:**
```
packages/web-sdk/src/
├── components/branch/
│   ├── BranchModal.tsx           # Configuration modal
│   ├── BranchMenuItem.tsx        # Context menu item for messages
│   └── BranchIndicator.tsx       # Shows branch icon on branched sessions
├── hooks/
│   └── useBranch.ts              # Branch creation + listing
└── (update existing)
    ├── components/messages/
    │   └── MessageActions.tsx    # Add "Branch from here" action
    └── components/sessions/
        └── SessionItem.tsx       # Show branch relationships
```

### Commands

**Update: `packages/web-sdk/src/lib/commands.ts`**

```typescript
{
  id: 'branch',
  label: '/branch',
  description: 'Branch session from current point',
  icon: GitBranch,
},
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+B` | Branch from last message |
| Right-click message → "Branch" | Branch from specific message |

---

## Session Relationships

### Data Model

```
sessions
├── id: "session-main-1"
├── parentSessionId: null
├── branchPointMessageId: null
├── sessionType: "main"
└── title: "Auth implementation"

sessions
├── id: "session-branch-1"
├── parentSessionId: "session-main-1"
├── branchPointMessageId: "msg-4"
├── sessionType: "branch"
└── title: "Branch: JWT approach"

sessions
├── id: "session-branch-2"
├── parentSessionId: "session-main-1"
├── branchPointMessageId: "msg-4"
├── sessionType: "branch"
└── title: "Branch: Session tokens"
```

### Query Patterns

```typescript
// Get all branches of a session
const branches = await db
  .select()
  .from(sessions)
  .where(eq(sessions.parentSessionId, parentId));

// Get branch tree (recursive for nested branches)
const getBranchTree = async (sessionId: string): Promise<BranchNode> => {
  const session = await getSession(sessionId);
  const children = await db
    .select()
    .from(sessions)
    .where(eq(sessions.parentSessionId, sessionId));
  
  return {
    session,
    branches: await Promise.all(children.map(c => getBranchTree(c.id))),
  };
};
```

---

## UI States

### Message Hover Actions (Component Structure)

```tsx
// AssistantMessageGroup.tsx
<div onMouseEnter={showActions} onMouseLeave={hideActions}>
  {/* Header with hover action */}
  <MessageHeader>
    <AgentBadge />
    <span>{provider} · {model} · {time}</span>
    {isHovered && (
      <HeaderActions>
        <BranchIconButton onClick={() => openBranchModal(message.id)} />
      </HeaderActions>
    )}
  </MessageHeader>
  
  {/* Message content */}
  <MessageContent parts={message.parts} />
  
  {/* Footer with hover actions */}
  {isHovered && (
    <MessageFooter>
      <BranchButton label="Branch" onClick={() => openBranchModal(message.id)} />
      <CopyButton label="Copy" onClick={() => copyMessage(message)} />
    </MessageFooter>
  )}
</div>
```

### Session Header (for branches)

```
┌─────────────────────────────────────────────────────────┐
│ 🔀 Branch: JWT approach                                 │
│ ↳ from "Auth implementation" at message #4              │
│   claude-sonnet-4 / anthropic                           │
└─────────────────────────────────────────────────────────┘
```

### Session List Grouping

Option 1: Tree view (nested)
```
▼ Auth implementation
  ├─ JWT approach
  ├─ Session tokens  
  └─ OAuth only
```

Option 2: Flat with indicator
```
Auth implementation
🔀 JWT approach (from Auth implementation)
🔀 Session tokens (from Auth implementation)
```

---

## Implementation Order

### Phase 1: Core (MVP) - ~2 days
1. Schema: Add `parentSessionId`, `branchPointMessageId`, `sessionType`
2. API: `POST /v1/sessions/:id/branch`
3. Backend: `createBranch()` function with message copying
4. Basic modal UI

### Phase 2: UX - ~2 days
5. Message hover "Branch" action
6. `/branch` command
7. Session list shows branch relationships
8. Branch indicator in session header

### Phase 3: Polish - ~1 day
9. Keyboard shortcut `Cmd+Shift+B`
10. Branch tree view in session list
11. "View parent" / "View branches" navigation

---

## Edge Cases

### Large Sessions
- Copying 100+ messages could be slow
- Solution: Show progress indicator, run in background
- Consider: Lazy copy (copy on first access) - more complex

### Branch of Branch
- Supported: Branch from any session including branches
- Tree can go multiple levels deep
- UI should show full lineage: A → B → C

### Deleted Parent
- Branches remain independent (full copy)
- Show "(parent deleted)" in UI
- No functional impact

### Concurrent Edits
- Parent continues independently after branch
- No sync between parent and branch
- This is intentional - they're independent explorations

---

## Future Enhancements

1. **Merge branches**: Combine findings from multiple branches back
2. **Diff view**: Compare two branches side-by-side
3. **Branch labels/tags**: Categorize branches (experiment, backup, etc.)
4. **Auto-branch on model switch**: Offer to branch when changing models mid-session
5. **Branch templates**: Pre-configured branch setups for common workflows

---

## Success Metrics

- Branches created per session
- Branch depth (how many levels deep do users go)
- Time between branch creation and meaningful divergence
- User retention in branched sessions vs. creating new sessions manually
