# Feature Plan: Session Persistence & Unified Model/Provider Selector

## Overview

This feature enhances the web UI to persist agent/provider/model selections in the session table and replaces the separate provider/model dropdowns with a unified searchable selector.

## Goals

1. **Session Persistence**: Store agent, provider, and model selections in the session table so they persist across app restarts
2. **Complete Agent List**: Fix agent discovery to show all available agents including custom ones (e.g., `git` agent from global directory)
3. **Unified Selector**: Replace separate provider/model dropdowns with a single searchable input that shows providers as section headers and models as items
4. **Automatic Updates**: When user switches agent/provider/model in the UI, automatically update the session row in the database

## Current State Analysis

### Database Schema
- `sessions` table already has `agent`, `provider`, and `model` columns (packages/database/src/schema/sessions.ts:6-8)
- These are populated on session creation but never updated after

### Agent Discovery Issue
- `/v1/config/agents` endpoint only reads from `.agi/agents/*.txt` files (packages/server/src/routes/config.ts:185-188)
- Missing: agents from global directory (`~/.agi/agents/`)
- Missing: agents from `agents.json` (global and local)
- The `git` agent is defined in the agent registry but not exposed via the config endpoint

### Current UI Components
- `ConfigModal.tsx`: Modal with 3 separate dropdowns (agent, provider, model)
- `ConfigSelector.tsx`: Inline selector (currently unused)
- `ChatInputContainer.tsx`: Manages agent/provider/model state locally (not persisted)
- State is component-local and lost on page reload

### API Endpoints
- `GET /v1/config`: Returns agents, providers, defaults
- `GET /v1/config/agents`: Returns agent list
- `GET /v1/config/providers/:provider/models`: Returns models for a provider
- `POST /v1/sessions`: Creates session with agent/provider/model
- **Missing**: `PATCH /v1/sessions/:sessionId` to update session preferences

## Implementation Plan

### Phase 1: Backend - Session Update Endpoint

**Files to modify:**
- `packages/server/src/routes/sessions.ts`

**Changes:**
1. Add new endpoint: `PATCH /v1/sessions/:sessionId`
   - Accept body: `{ agent?: string, provider?: string, model?: string }`
   - Validate session exists and belongs to current project
   - Update session row in database
   - Update `lastActiveAt` timestamp
   - Return updated session object

2. Add validation:
   - Agent exists (check against agent registry)
   - Provider is authorized
   - Model is valid for the provider

**Example endpoint:**
```typescript
app.patch('/v1/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { agent, provider, model } = body;
  
  // Validate and update session
  // Return updated session
});
```

### Phase 2: Backend - Fix Agent Discovery

**Files to modify:**
- `packages/server/src/routes/config.ts`

**Changes:**
1. Update `GET /v1/config/agents` to use `loadAgentsConfig()` from agent-registry
2. Merge agents from multiple sources:
   - Built-in agents: `['general', 'build', 'plan']`
   - Agents from `agents.json` (global + local)
   - Custom agent files from `.agi/agents/` (global + local)
3. Return deduplicated list

**Logic:**
```typescript
// Get agents from agents.json
const agentsJson = await loadAgentsConfig(projectRoot);
const jsonAgents = Object.keys(agentsJson);

// Get custom agent files
const localAgentsDir = join(projectRoot, '.agi', 'agents');
const globalAgentsDir = getGlobalAgentsDir();
const localFiles = await readdir(localAgentsDir).catch(() => []);
const globalFiles = await readdir(globalAgentsDir).catch(() => []);

// Merge and deduplicate
const allAgents = Array.from(new Set([
  ...builtInAgents,
  ...jsonAgents,
  ...localFiles.filter(f => f.endsWith('.txt') || f.endsWith('.md')).map(f => f.replace(/\.(txt|md)$/, '')),
  ...globalFiles.filter(f => f.endsWith('.txt') || f.endsWith('.md')).map(f => f.replace(/\.(txt|md)$/, ''))
]));
```

### Phase 3: Backend - Unified Models Endpoint

**Files to modify:**
- `packages/server/src/routes/config.ts`

**Changes:**
1. Add new endpoint: `GET /v1/config/models`
   - Returns all providers with their models in a hierarchical structure
   - Only include authorized providers
   - Format: `{ [provider: string]: { label: string, models: Model[] } }`

**Example response:**
```json
{
  "anthropic": {
    "label": "Anthropic",
    "models": [
      { "id": "claude-3-5-sonnet-20241022", "label": "Claude 3.5 Sonnet" },
      { "id": "claude-3-5-haiku-20241022", "label": "Claude 3.5 Haiku" }
    ]
  },
  "openai": {
    "label": "OpenAI",
    "models": [
      { "id": "gpt-4o", "label": "GPT-4o" },
      { "id": "gpt-4o-mini", "label": "GPT-4o Mini" }
    ]
  }
}
```

### Phase 4: Frontend - API Client Updates

**Files to modify:**
- `packages/web-sdk/src/lib/api-client.ts`
- `packages/web-sdk/src/types/api.ts`

**Changes:**
1. Add `updateSession(sessionId, data)` function
2. Add `getAllModels()` function
3. Add TypeScript types for new endpoints

### Phase 5: Frontend - Session Update Hook

**Files to create:**
- `packages/web-sdk/src/hooks/useSessionUpdate.ts`

**Changes:**
1. Create hook that wraps `useMutation` for session updates
2. Invalidate session queries after successful update
3. Optimistic updates for better UX

**Example:**
```typescript
export function useUpdateSession(sessionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { agent?: string; provider?: string; model?: string }) =>
      apiClient.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions']);
      queryClient.invalidateQueries(['session', sessionId]);
    },
  });
}
```

### Phase 6: Frontend - Unified Model Selector Component

**Files to create:**
- `packages/web-sdk/src/components/chat/UnifiedModelSelector.tsx`

**Component features:**
1. Single search input with dropdown
2. Filter across provider names and model names
3. Render providers as section headers
4. Render models as selectable items under providers
5. Show provider icon/badge before model name
6. Keyboard navigation (arrow keys, enter to select, escape to close)
7. Display current selection in compact format: `provider/model`

**UI structure:**
```
┌─────────────────────────────────────────┐
│ [Search icon] anthropic/claude-3.5-s... │ <- Input showing current selection
└─────────────────────────────────────────┘
         ↓ (when focused/typing)
┌─────────────────────────────────────────┐
│ Type to search...                       │
├─────────────────────────────────────────┤
│ ANTHROPIC                               │ <- Section header
│   • Claude 3.5 Sonnet                   │ <- Selectable model
│   • Claude 3.5 Haiku                    │
├─────────────────────────────────────────┤
│ OPENAI                                  │
│   • GPT-4o                              │
│   • GPT-4o Mini                         │
└─────────────────────────────────────────┘
```

**Implementation notes:**
- Use Radix UI Combobox or similar for accessibility
- Filter logic: match against `provider.toLowerCase()` or `model.label.toLowerCase()`
- When model selected, extract provider from model's parent section
- Update both provider and model in parent component

### Phase 7: Frontend - Update ChatInputContainer

**Files to modify:**
- `packages/web-sdk/src/components/chat/ChatInputContainer.tsx`
- `packages/web-sdk/src/components/chat/ConfigModal.tsx`

**Changes:**
1. Replace `ConfigModal` provider/model dropdowns with `UnifiedModelSelector`
2. Load initial values from session data (via `useSession(sessionId)`)
3. Call `useUpdateSession` whenever agent/provider/model changes
4. Persist changes immediately to session table

**Flow:**
```typescript
const { data: session } = useSession(sessionId);
const updateSession = useUpdateSession(sessionId);

// Initialize from session
useEffect(() => {
  if (session) {
    setAgent(session.agent);
    setProvider(session.provider);
    setModel(session.model);
  }
}, [session]);

// Update session on change
const handleAgentChange = useCallback((value: string) => {
  setAgent(value);
  updateSession.mutate({ agent: value });
}, [updateSession]);

const handleModelChange = useCallback((provider: string, model: string) => {
  setProvider(provider);
  setModel(model);
  updateSession.mutate({ provider, model });
}, [updateSession]);
```

### Phase 8: Frontend - Session Creation with Defaults

**Files to modify:**
- `apps/web/src/components/sessions/SessionsLayout.tsx`

**Changes:**
1. Load config defaults before creating session
2. Pass defaults to `createSession` mutation
3. Ensure new sessions use config defaults, not hardcoded 'general'

**Updated code:**
```typescript
const { data: config } = useConfig();

const handleNewSession = useCallback(async () => {
  try {
    const session = await createSession.mutateAsync({
      agent: config?.defaults.agent || 'general',
      provider: config?.defaults.provider,
      model: config?.defaults.model,
    });
    // ... navigate to session
  } catch (error) {
    console.error('Failed to create session:', error);
  }
}, [createSession, config]);
```

### Phase 9: Testing & Edge Cases

**Test scenarios:**
1. Create new session → verify defaults are used
2. Switch agent in UI → verify session row updated
3. Switch model in UI → verify both provider and model updated
4. Reload page → verify selections persist
5. Search in unified selector → verify filtering works
6. Keyboard navigation in selector → verify accessibility
7. Invalid model for provider → verify validation
8. Unauthorized provider → verify error handling
9. Custom agent from global directory → verify appears in list
10. Agent from agents.json → verify appears in list

## Database Migration

**Not required** - existing schema already supports this feature. The `agent`, `provider`, and `model` columns exist and are not null.

## API Changes Summary

### New Endpoints
- `PATCH /v1/sessions/:sessionId` - Update session preferences
- `GET /v1/config/models` - Get all models grouped by provider

### Modified Endpoints
- `GET /v1/config/agents` - Now returns agents from all sources (json + files + global)

## UI/UX Considerations

1. **Immediate feedback**: Show loading state when updating session
2. **Error handling**: Display toast/notification on update failure
3. **Optimistic updates**: Update UI before server responds for better perceived performance
4. **Search UX**: Highlight matching text in search results
5. **Mobile-friendly**: Ensure unified selector works on small screens
6. **Default state**: Show config defaults when creating new session
7. **Migration**: Existing sessions keep their current values

## Open Questions & Decisions

1. **Q**: Should we update the session on every keystroke in the search box or only on selection?
   **A**: Only on selection (when user picks a model)

2. **Q**: Should we debounce the session update API calls?
   **A**: Yes, debounce by 500ms to avoid excessive API calls if user rapidly changes settings

3. **Q**: What happens if session update fails?
   **A**: Show error toast, revert UI to previous value, allow retry

4. **Q**: Should agent changes also automatically select a preferred provider/model for that agent?
   **A**: Yes, if agent has provider/model specified in agents.json, use those. Otherwise keep current selection.

## Success Criteria

- [ ] Agent list includes all agents (built-in, json-defined, global directory, local directory)
- [ ] `git` agent appears in the web UI agent list
- [ ] Unified model selector replaces separate provider/model dropdowns
- [ ] Search/filter works across providers and models
- [ ] Selecting a model automatically updates both provider and model
- [ ] Session table updates when user changes agent/provider/model in UI
- [ ] Selections persist across page reloads
- [ ] New sessions use config defaults
- [ ] Message sending uses currently selected (and persisted) session preferences
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Accessible keyboard navigation in unified selector

## Timeline Estimate

- Phase 1 (Session update endpoint): 2-3 hours
- Phase 2 (Fix agent discovery): 2-3 hours
- Phase 3 (Unified models endpoint): 1-2 hours
- Phase 4 (API client): 1 hour
- Phase 5 (Session update hook): 1 hour
- Phase 6 (Unified selector component): 4-6 hours
- Phase 7 (Update ChatInputContainer): 2-3 hours
- Phase 8 (Session creation): 1 hour
- Phase 9 (Testing): 3-4 hours

**Total**: ~18-25 hours

## References

- Session schema: `packages/database/src/schema/sessions.ts`
- Agent registry: `packages/server/src/runtime/agent-registry.ts`
- Config routes: `packages/server/src/routes/config.ts`
- Session routes: `packages/server/src/routes/sessions.ts`
- Chat input: `packages/web-sdk/src/components/chat/ChatInputContainer.tsx`
- Config modal: `packages/web-sdk/src/components/chat/ConfigModal.tsx`
