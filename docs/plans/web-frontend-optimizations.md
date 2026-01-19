# Web Frontend Optimizations Plan

## Current State

### Message Fetching
- **Location:** `packages/web-sdk/src/hooks/useMessages.ts`
- **Problem:** Full refetch on every mutation success
- **Code:**
  ```ts
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }
  ```

### SSE Streaming
- **Location:** `packages/web-sdk/src/hooks/useSessionStream.ts:354`
- **Problem:** After stream ends, full invalidation triggers refetch
- **Code:**
  ```ts
  queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
  ```

### Server Endpoint
- **Location:** `packages/server/src/routes/session-messages.ts`
- **Problem:** No pagination or incremental fetch support
- Always returns all messages for a session

---

## Proposed Optimizations

### 1. Incremental Message Fetching

**Server changes (`session-messages.ts`):**
```ts
// Add query params
const after = c.req.query('after');      // messageId - fetch messages after this
const since = c.req.query('since');      // timestamp - fetch messages since this time
const limit = c.req.query('limit');      // number - max messages to return

// Modify query
let query = db.select().from(messages).where(eq(messages.sessionId, id));

if (after) {
  // Get createdAt of the 'after' message, then filter
  query = query.where(gt(messages.createdAt, afterTimestamp));
}
if (since) {
  query = query.where(gt(messages.createdAt, new Date(since)));
}
if (limit) {
  query = query.limit(parseInt(limit));
}
```

**Client changes (`useMessages.ts`):**
```ts
export function useMessages(sessionId: string | undefined, options?: { after?: string }) {
  return useQuery({
    queryKey: ['messages', sessionId, options?.after],
    queryFn: () => apiClient.getMessages(sessionId, { after: options?.after }),
    enabled: !!sessionId,
  });
}

// New hook for incremental updates
export function useNewMessages(sessionId: string, lastMessageId?: string) {
  return useQuery({
    queryKey: ['messages', sessionId, 'after', lastMessageId],
    queryFn: () => apiClient.getMessages(sessionId, { after: lastMessageId }),
    enabled: !!sessionId && !!lastMessageId,
    refetchInterval: false, // Only refetch on demand
  });
}
```

### 2. SSE Delta Merging (No Refetch)

**Current flow:**
1. SSE streams message deltas
2. Stream ends
3. `invalidateQueries` → full refetch

**Proposed flow:**
1. SSE streams message deltas
2. Merge deltas into local query cache directly
3. No refetch needed

**Implementation (`useSessionStream.ts`):**
```ts
// Instead of invalidating, merge the streamed message into cache
const finalMessage = buildMessageFromDeltas(deltas);
queryClient.setQueryData(['messages', sessionId], (old: Message[]) => {
  // Check if message already exists (update) or is new (append)
  const exists = old.find(m => m.id === finalMessage.id);
  if (exists) {
    return old.map(m => m.id === finalMessage.id ? finalMessage : m);
  }
  return [...old, finalMessage];
});
```

### 3. Optimistic Updates for User Messages

**Current:** Wait for server response before showing user message
**Proposed:** Show immediately, reconcile on server response

```ts
useMutation({
  mutationFn: (data) => apiClient.sendMessage(sessionId, data),
  onMutate: async (newMessage) => {
    await queryClient.cancelQueries({ queryKey: ['messages', sessionId] });
    const previous = queryClient.getQueryData(['messages', sessionId]);
    
    // Optimistically add user message
    queryClient.setQueryData(['messages', sessionId], (old: Message[]) => [
      ...old,
      { id: 'temp-' + Date.now(), role: 'user', content: newMessage.content, ... }
    ]);
    
    return { previous };
  },
  onError: (err, newMessage, context) => {
    // Rollback on error
    queryClient.setQueryData(['messages', sessionId], context.previous);
  },
  onSettled: () => {
    // Reconcile with server (could be incremental fetch)
  },
});
```

### 4. Session List Optimization

**Problem:** `invalidateQueries({ queryKey: ['sessions'] })` refetches all sessions
**Solution:** Update specific session in cache

```ts
// Instead of full invalidation
queryClient.setQueryData(['sessions'], (old: Session[]) => {
  return old.map(s => s.id === sessionId 
    ? { ...s, updatedAt: new Date().toISOString(), messageCount: s.messageCount + 1 }
    : s
  );
});
```

### 5. Pagination for Long Sessions

**Server:** Add cursor-based pagination
```ts
GET /v1/sessions/:id/messages?limit=50&before=<messageId>
```

**Client:** Infinite query with load-more
```ts
useInfiniteQuery({
  queryKey: ['messages', sessionId],
  queryFn: ({ pageParam }) => apiClient.getMessages(sessionId, { before: pageParam, limit: 50 }),
  getNextPageParam: (lastPage) => lastPage[0]?.id, // oldest message ID
  getPreviousPageParam: (firstPage) => firstPage[firstPage.length - 1]?.id,
});
```

---

## Implementation Priority

| # | Task | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 1 | SSE delta merging (no refetch) | High | Medium | Biggest win - eliminates refetch after every response |
| 2 | Incremental fetch (`?after=`) | High | Low | Simple server change, big mobile benefit |
| 3 | Optimistic user messages | Medium | Low | Better perceived performance |
| 4 | Session list cache update | Low | Low | Minor optimization |
| 5 | Pagination | Low | Medium | Only needed for very long sessions |

---

## Files to Modify

### Server
- `packages/server/src/routes/session-messages.ts` - Add `?after=`, `?since=`, `?limit=` params

### Web SDK
- `packages/web-sdk/src/hooks/useMessages.ts` - Incremental fetch, optimistic updates
- `packages/web-sdk/src/hooks/useSessionStream.ts` - Delta merging instead of invalidation
- `packages/web-sdk/src/hooks/useSessions.ts` - Cache updates instead of invalidation
- `packages/web-sdk/src/lib/api-client.ts` - Add query params to `getMessages()`

### Types
- `packages/web-sdk/src/types/api.ts` - Add `GetMessagesOptions` type

---

## API Changes

### GET /v1/sessions/:id/messages

**Current:**
```
GET /v1/sessions/:id/messages
Response: Message[]
```

**Proposed:**
```
GET /v1/sessions/:id/messages?after=<messageId>&since=<isoTimestamp>&limit=<number>
Response: Message[]
```

| Param | Type | Description |
|-------|------|-------------|
| `after` | string | Return messages created after this message ID |
| `since` | string | Return messages created after this ISO timestamp |
| `limit` | number | Max messages to return (default: all) |
| `before` | string | Return messages before this ID (for pagination) |

---

## Migration Path

1. **Phase 1:** Add server params (backward compatible)
2. **Phase 2:** Update web-sdk to use delta merging
3. **Phase 3:** Add incremental fetch for mobile
4. **Phase 4:** Add pagination if needed

No breaking changes - existing clients continue to work.
