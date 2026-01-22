# Plan: Research Context in User Messages

## Problem

Currently, when research context is injected:
1. It creates a **system message** in the database
2. The ChatInput shows it as a card (reads from system messages)
3. When user sends a message, the research context is **NOT included** - the LLM has no knowledge of it
4. `history-builder.ts` completely ignores system messages

## Proposed Solution

Research context should be part of the **user message**, not a system message:
1. Include research context in the user message content (hidden from textarea, shown as card)
2. When displaying user messages, parse `<research-context>` tags and render as cards
3. LLM naturally receives research context as part of user message history

## Benefits

- Research context is contextual to user's question (belongs in user message)
- No system prompt bloat
- Clean separation: UI handles display, server receives full content
- Works with existing history builder (no changes needed for LLM)

---

## Files to Modify

### 1. UI - Input Side

#### `packages/web-sdk/src/stores/researchStore.ts` (NEW FILE)
Create Zustand store to manage pending research contexts:
```typescript
interface ResearchContext {
  id: string;           // Original message ID (for removal)
  sessionId: string;    // Research session ID
  label: string;        // Display label
  content: string;      // Full research context content
}

interface ResearchStore {
  pendingContexts: Map<string, ResearchContext[]>; // keyed by parent session ID
  addContext: (parentSessionId: string, context: ResearchContext) => void;
  removeContext: (parentSessionId: string, contextId: string) => void;
  getContexts: (parentSessionId: string) => ResearchContext[];
  clearContexts: (parentSessionId: string) => void;
  consumeContexts: (parentSessionId: string) => ResearchContext[];
}
```

#### `packages/web-sdk/src/components/chat/ChatInputContainer.tsx`
Changes needed:
- Import and use `useResearchStore` instead of reading from messages
- In `handleSendMessage`:
  - Get pending research contexts from store
  - Prepend research context XML to message content
  - Clear contexts from store after sending
- Remove the `researchContexts` useMemo that reads from messages
- Update `handleResearchContextRemove` to remove from store (not delete message)

#### `packages/web-sdk/src/components/chat/ChatInput.tsx`
No changes needed - already receives `researchContexts` prop and displays cards.

#### `packages/web-sdk/src/hooks/useResearch.ts`
Modify `injectContext` mutation:
- Instead of calling API to create system message
- Add research context to the zustand store
- Return success immediately

### 2. UI - Display Side

#### `packages/web-sdk/src/components/messages/UserMessageGroup.tsx`
Changes needed:
- Parse `<research-context>` tags from message content
- Extract: label, content
- Render research context as a card (similar to ChatInput display)
- Render remaining text content (without the research-context tags)
- Add new component: `ResearchContextCard` or inline

#### `packages/web-sdk/src/lib/parseResearchContext.ts` (NEW FILE)
Utility to parse research context from message content:
```typescript
interface ParsedResearchContext {
  id: string;
  label: string;
  content: string;
}

interface ParseResult {
  researchContexts: ParsedResearchContext[];
  cleanContent: string; // Content with research tags removed
}

export function parseResearchContext(content: string): ParseResult;
```

### 3. Server Side

#### `packages/server/src/routes/research.ts`
Modify inject endpoint (`POST /v1/research/:id/inject`):
- Instead of creating a system message in DB
- Return the formatted research context content to the client
- Let the client store it in zustand and include in next message

Current flow:
```
Client -> POST /inject -> Server creates system message -> Returns messageId
```

New flow:
```
Client -> POST /inject -> Server builds context content -> Returns { content, label }
Client stores in zustand -> User sends message -> Content included in user message
```

### 4. Types

#### `packages/web-sdk/src/types/api.ts`
Add new response type for inject:
```typescript
export interface InjectResearchContextResponse {
  content: string;      // The formatted <research-context>...</research-context>
  label: string;        // Display label
  sessionId: string;    // Research session ID
  tokenEstimate: number;
}
```

---

## Implementation Order

### Phase 1: Create Infrastructure
1. Create `researchStore.ts` zustand store
2. Create `parseResearchContext.ts` utility
3. Update types in `api.ts`

### Phase 2: Modify Server
4. Update `/v1/research/:id/inject` to return content instead of creating message

### Phase 3: Update Input Flow
5. Update `useResearch.ts` to use new inject response and store in zustand
6. Update `ChatInputContainer.tsx` to:
   - Read from zustand store
   - Include context in message when sending
   - Remove old system message reading logic

### Phase 4: Update Display Flow
7. Update `UserMessageGroup.tsx` to:
   - Parse research context from content
   - Render as cards
   - Show clean text content

### Phase 5: Cleanup
8. Remove old system message creation code
9. Migration: Handle existing system messages (optional - they just won't be used)

---

## Message Format

When user sends a message with research context:
```
<research-context from="session-123" label="API Research">
[user]: How do I authenticate?
[assistant]: You can use OAuth or API keys...
</research-context>

My actual question: How do I implement this in my app?
```

The LLM sees the full content including research context.
The UI parses and displays:
- Card: "API Research" (collapsible)
- Text: "My actual question: How do I implement this in my app?"

---

## Edge Cases

1. **Multiple research contexts**: Support array, render multiple cards
2. **Cancel before sending**: Remove from zustand store, nothing sent
3. **Empty message with only research**: Should still be sendable
4. **Existing system messages**: Leave them (they're just ignored)
5. **Large research context**: Already handled by token estimation

---

## Testing Checklist

- [ ] Inject research context shows card in input
- [ ] Remove card before sending removes it
- [ ] Send message includes research context
- [ ] User message displays with research card
- [ ] LLM can reference research context in response
- [ ] Multiple research contexts work
- [ ] Research context persists across input focus/blur
- [ ] Cancel/clear works correctly
