# Claude Code Tool Mapping - Design Document

## Overview

This document details the architecture for supporting Anthropic Pro/Max OAuth authentication while maintaining compatibility with other providers. The key challenge is that Claude Code requires PascalCase tool names while AGI uses snake_case internally.

> **See also:** [OAuth Validation Findings](./claude-code-oauth-findings.md) - Detailed test results showing what Anthropic actually validates.

## Problem Statement

1. **Tool Name Mismatch**: AGI uses snake_case (`read`, `write`, `bash`), Claude Code requires PascalCase (`Read`, `Write`, `Bash`)
2. **Mid-Session Provider Switching**: Users may switch providers during a session, requiring history transformation
3. **Tool Name Differences**: Some tools have entirely different names (`ripgrep` → `Grep`)

## Key Finding (Validated by Testing)

**Only tool names need to match.** Anthropic validates:
- Tool names must be PascalCase (e.g., `Read`, `Bash`, `Grep`)
- Required headers (`anthropic-beta: claude-code-20250219`, etc.)

**NOT validated:**
- Tool input schemas (AGI's `path` works, not just Claude Code's `file_path`)
- Tool descriptions
- Tool response formats (AGI's `{ok: true, ...}` works fine)

This simplifies implementation significantly - we only need name transformation, not schema changes.

## Design Principles

1. **Canonical Internal Names**: Always use snake_case internally and in the database
2. **Transform at Boundaries**: Only transform tool names when sending to/receiving from Claude Code OAuth
3. **Minimal Client Changes**: Client renderers should work with canonical names; add aliases for edge cases
4. **Backward Compatible**: Existing sessions continue to work

---

## Architecture

### Data Flow

```
                                    ┌─────────────────────┐
                                    │   Tool Registry     │
                                    │   (snake_case)      │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
            ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
            │ OpenAI/Google │          │ Anthropic API │          │ Anthropic     │
            │ (snake_case)  │          │ (snake_case)  │          │ OAuth/Claude  │
            └───────────────┘          └───────────────┘          │ Code          │
                                                                  │ (PascalCase)  │
                                                                  └───────┬───────┘
                                                                          │
                                                                  ┌───────▼───────┐
                                                                  │ Transform     │
                                                                  │ Layer         │
                                                                  └───────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `tool-mapping.ts` | Bidirectional name mapping, transformation functions |
| `provider.ts` | Detect OAuth, transform outgoing requests |
| `adapter.ts` | Transform incoming tool calls, store canonical names |
| `history-builder.ts` | Build history with correct naming for target provider |
| `renderers/index.tsx` | Map incoming names to canonical for rendering |

---

## Tool Name Mapping

### Complete Mapping Table

| AGI Canonical | Claude Code | Notes |
|---------------|-------------|-------|
| `read` | `Read` | File reading |
| `write` | `Write` | File writing |
| `edit` | `Edit` | Text editing |
| `bash` | `Bash` | Shell execution |
| `glob` | `Glob` | File pattern matching |
| `ripgrep` | `Grep` | Content search (name change!) |
| `grep` | `Grep` | Content search |
| `ls` | `LS` | Directory listing (TBD) |
| `tree` | `Tree` | Directory tree (TBD) |
| `apply_patch` | `ApplyPatch` | Patch application (TBD) |
| `git_status` | `GitStatus` | Git status (TBD) |
| `git_diff` | `GitDiff` | Git diff (TBD) |
| `git_commit` | `GitCommit` | Git commit (TBD) |
| `websearch` | `WebSearch` | Web search (TBD) |
| `update_plan` | `TodoWrite` | Plan updates (name change!) |
| `progress_update` | N/A | Internal only, not sent to model |
| `finish` | N/A | Internal only, not sent to model |

**Note**: Items marked TBD need verification against actual Claude Code tool set. Only map tools that Claude Code actually supports.

### Core Tools (Verified)

Based on the test script and Claude Code analysis, these are the core tools:

```typescript
const CLAUDE_CODE_CORE_TOOLS = {
  // File operations
  read: 'Read',
  write: 'Write',
  edit: 'Edit',

  // Search
  glob: 'Glob',
  ripgrep: 'Grep',
  grep: 'Grep',

  // Execution
  bash: 'Bash',

  // Task management
  update_plan: 'TodoWrite',
} as const;
```

---

## Implementation

### 1. Tool Mapping Module

**File**: `packages/server/src/runtime/tool-mapping.ts`

```typescript
/**
 * Tool name mapping for Claude Code compatibility.
 *
 * Claude Code OAuth requires specific PascalCase tool names.
 * This module provides bidirectional mapping between AGI's canonical
 * snake_case names and Claude Code's expected names.
 */

export type ToolNamingConvention = 'canonical' | 'claude-code';

/**
 * Mapping from AGI canonical names to Claude Code names.
 * Only includes tools that have different names or casing.
 */
export const CANONICAL_TO_CLAUDE_CODE: Record<string, string> = {
  // File operations
  read: 'Read',
  write: 'Write',
  edit: 'Edit',

  // Search operations
  glob: 'Glob',
  ripgrep: 'Grep',  // Name change
  grep: 'Grep',

  // Execution
  bash: 'Bash',

  // Task management (name change)
  update_plan: 'TodoWrite',
};

/**
 * Reverse mapping from Claude Code names to canonical.
 * Built from CANONICAL_TO_CLAUDE_CODE, handling many-to-one mappings.
 */
export const CLAUDE_CODE_TO_CANONICAL: Record<string, string> = {
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  Glob: 'glob',
  Grep: 'ripgrep',  // Maps to ripgrep (primary search tool)
  Bash: 'bash',
  TodoWrite: 'update_plan',
};

/**
 * Convert a canonical tool name to Claude Code format.
 */
export function toClaudeCodeName(canonical: string): string {
  if (CANONICAL_TO_CLAUDE_CODE[canonical]) {
    return CANONICAL_TO_CLAUDE_CODE[canonical];
  }
  // Default: convert snake_case to PascalCase
  return canonical
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convert a Claude Code tool name to canonical format.
 */
export function toCanonicalName(claudeCode: string): string {
  if (CLAUDE_CODE_TO_CANONICAL[claudeCode]) {
    return CLAUDE_CODE_TO_CANONICAL[claudeCode];
  }
  // Default: convert PascalCase to snake_case
  return claudeCode
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Check if the current provider/auth combo requires Claude Code naming.
 */
export function requiresClaudeCodeNaming(
  provider: string,
  authType?: string
): boolean {
  return provider === 'anthropic' && authType === 'oauth';
}

/**
 * Transform a tool definition for Claude Code.
 * Returns a new object with the transformed name.
 */
export function transformToolForClaudeCode<T extends { name: string }>(
  tool: T
): T {
  return {
    ...tool,
    name: toClaudeCodeName(tool.name),
  };
}

/**
 * Transform tool call arguments to canonical names.
 * Used when receiving tool calls from Claude Code.
 */
export function normalizeToolCall<T extends { name: string }>(
  call: T,
  fromClaudeCode: boolean
): T {
  if (!fromClaudeCode) return call;
  return {
    ...call,
    name: toCanonicalName(call.name),
  };
}
```

### 2. Provider.ts Modifications

**File**: `packages/server/src/runtime/provider.ts`

Add tool transformation in `customFetch`:

```typescript
// In the customFetch function, after OAuth detection

import {
  toClaudeCodeName,
  CANONICAL_TO_CLAUDE_CODE
} from './tool-mapping.ts';

// Inside customFetch, when handling request body:
if (parsed.tools && Array.isArray(parsed.tools)) {
  parsed.tools = parsed.tools.map((tool: { name: string; [key: string]: unknown }) => ({
    ...tool,
    name: toClaudeCodeName(tool.name),
  }));
}
```

### 3. Adapter.ts Modifications

**File**: `packages/server/src/tools/adapter.ts`

The adapter needs to handle Claude Code tool names when the model calls back:

```typescript
import { toCanonicalName, requiresClaudeCodeNaming } from '../runtime/tool-mapping.ts';

export function adaptTools(
  tools: DiscoveredTool[],
  ctx: ToolAdapterContext,
  provider?: string,
  authType?: string,  // Add auth type parameter
) {
  const isClaudeCode = requiresClaudeCodeNaming(provider ?? '', authType);

  // Create a lookup map from both canonical and Claude Code names
  const toolLookup = new Map<string, DiscoveredTool>();
  for (const tool of tools) {
    toolLookup.set(tool.name, tool);
    if (isClaudeCode) {
      // Also register under Claude Code name for lookup
      toolLookup.set(toClaudeCodeName(tool.name), tool);
    }
  }

  // Rest of adaptation logic...
  // When storing to DB, always use canonical name:
  // toolName: toCanonicalName(name)  // if from Claude Code
}
```

**Alternative approach** - Transform tool names in the toolset output:

```typescript
// At the end of adaptTools, if Claude Code:
if (isClaudeCode) {
  const claudeCodeTools: Record<string, Tool> = {};
  for (const [name, tool] of Object.entries(out)) {
    const ccName = toClaudeCodeName(name);
    claudeCodeTools[ccName] = {
      ...tool,
      // Override execute to normalize names in storage
      async execute(input, options) {
        const result = await tool.execute?.(input, options);
        // Storage already uses ctx which has canonical name
        return result;
      }
    };
  }
  return claudeCodeTools;
}
```

### 4. History Builder Modifications

**File**: `packages/server/src/runtime/history-builder.ts`

```typescript
import {
  toClaudeCodeName,
  requiresClaudeCodeNaming
} from './tool-mapping.ts';

export async function buildHistoryMessages(
  db: Awaited<ReturnType<typeof getDb>>,
  sessionId: string,
  options?: {
    targetProvider?: string;
    targetAuthType?: string;
  }
): Promise<ModelMessage[]> {
  const isClaudeCode = requiresClaudeCodeNaming(
    options?.targetProvider ?? '',
    options?.targetAuthType
  );

  // ... existing code ...

  for (const call of toolCalls) {
    if (call.name === 'finish') continue;

    // Transform name for target provider
    const displayName = isClaudeCode
      ? toClaudeCodeName(call.name)
      : call.name;

    const toolType = `tool-${displayName}` as `tool-${string}`;

    // ... rest of logic ...
  }
}
```

### 5. Client Renderer Modifications

**File**: `packages/web-sdk/src/components/messages/renderers/index.tsx`

```typescript
/**
 * Normalize tool names to canonical form for rendering.
 * Handles both snake_case (canonical) and PascalCase (Claude Code) names.
 */
const TOOL_NAME_ALIASES: Record<string, string> = {
  // Claude Code PascalCase → canonical
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  Bash: 'bash',
  Glob: 'glob',
  Grep: 'ripgrep',
  TodoWrite: 'update_plan',
  // Add more as needed
};

function normalizeToolNameForRendering(name: string): string {
  return TOOL_NAME_ALIASES[name] ?? name;
}

export function ToolResultRenderer({
  toolName,
  contentJson,
  toolDurationMs,
  debug,
}: ToolResultRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize to canonical name for renderer selection
  const normalizedName = normalizeToolNameForRendering(toolName);

  const props = {
    contentJson,
    toolDurationMs: toolDurationMs ?? undefined,
    isExpanded,
    onToggle: () => setIsExpanded(!isExpanded),
  };

  if (debug) {
    return <DebugRenderer {...props} toolName={toolName} />;
  }

  switch (normalizedName) {
    case 'read':
      return <ReadRenderer {...props} />;
    case 'write':
      return <WriteRenderer {...props} />;
    // ... rest of cases using canonical names
  }
}
```

---

## Response Structure Compatibility

### Claude Code Response Format

When Claude Code calls a tool, the response comes back as:

```json
{
  "type": "tool_use",
  "id": "toolu_xxx",
  "name": "Read",  // PascalCase
  "input": {
    "file_path": "/path/to/file"
  }
}
```

The AI SDK handles this and calls our tool's `execute()` function. The key points:

1. **Tool lookup**: SDK looks up tool by name from our provided toolset
2. **Input passing**: Input object is passed as-is to `execute()`
3. **Result handling**: Whatever we return becomes the tool result

### AGI Tool Response Expectations

AGI tools return responses in the `ToolResponse<T>` format:

```typescript
// Success
{ ok: true, path: string, content: string, ... }

// Error
{ ok: false, error: string, errorType?: string, details?: {...} }
```

### Compatibility Matrix

| Aspect | Claude Code | AGI | Compatible? |
|--------|-------------|-----|-------------|
| Tool name in request | PascalCase | snake_case | Yes (with mapping) |
| Tool name in response | PascalCase | snake_case | Yes (with mapping) |
| Input schema | JSON Schema 2020-12 | Zod → JSON Schema | Yes (auto-converted) |
| Response format | String/JSON | ToolResponse<T> | Yes (stringified) |
| Error handling | String message | ToolErrorResponse | Yes (stringified) |

### Schema Conversion Note

AGI uses Zod for tool schemas, which converts to JSON Schema draft-07 by default. Claude Code expects draft/2020-12. The current `customFetch` already handles this:

```typescript
if (tool.input_schema?.$schema) {
  tool.input_schema.$schema = 'https://json-schema.org/draft/2020-12/schema';
}
```

---

## Mid-Session Provider Switching

### Scenario 1: API Key → OAuth (Most Common)

1. User starts session with Anthropic API key
2. Tool calls stored with canonical names: `read`, `bash`, etc.
3. User switches to OAuth
4. History builder transforms names when building for Claude Code
5. New tool calls from Claude Code come back as `Read`, `Bash`
6. Adapter normalizes to canonical before storage
7. Database remains consistent with canonical names

### Scenario 2: OAuth → API Key

1. User starts with OAuth (Claude Code naming)
2. Tool calls stored with canonical names (normalized on receipt)
3. User switches to API key
4. History builder uses canonical names (no transformation needed)
5. Everything works seamlessly

### Scenario 3: Anthropic → Other Provider

1. User starts with Anthropic (any auth)
2. Tool calls stored with canonical names
3. User switches to OpenAI/Google
4. History builder uses canonical names
5. Other providers accept snake_case (standard convention)

### Key Invariant

**The database always contains canonical (snake_case) tool names.**

This is enforced by:
1. `adapter.ts` normalizing incoming tool names before storage
2. History builder reading canonical names and transforming only for output

---

## Tool Response Structure Consolidation

### Current State

Based on analysis, AGI has inconsistent tool response patterns:

| Pattern | Tools | Issues |
|---------|-------|--------|
| `ToolResponse<T>` with `ok` flag | bash, read, write, patch, terminal | Consistent, ideal |
| Inline `error` field | glob, ripgrep, websearch, git_status | No `ok` flag, hard to detect errors |
| Throws Error | edit, grep, git_commit, ls, tree | Breaks consistent handling |
| Plain object | finish, plan | No error handling structure |

### Recommended Unified Structure

```typescript
// packages/sdk/src/core/src/tools/types.ts

export interface ToolSuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

export interface ToolErrorResponse {
  ok: false;
  error: string;
  errorType?: 'validation' | 'not_found' | 'permission' | 'execution' | 'timeout';
  details?: {
    parameter?: string;
    value?: unknown;
    suggestion?: string;
    [key: string]: unknown;
  };
}

export type ToolResponse<T = unknown> = ToolSuccessResponse<T> | ToolErrorResponse;
```

### Migration Priority

1. **High Priority** (used frequently, user-facing):
   - `glob.ts` - Add `ok` flag, use `createToolError()`
   - `ripgrep.ts` - Standardize error handling
   - `edit.ts` - Catch errors, return `ToolErrorResponse`
   - `ls.ts`, `tree.ts` - Wrap in ToolResponse

2. **Medium Priority**:
   - `git.ts` (all operations) - Standardize all three tools
   - `websearch.ts` - Add discriminated union for different response types

3. **Low Priority** (internal/simple):
   - `finish.ts` - Keep simple, no error path
   - `plan.ts` - Add basic `ok` flag

### Benefits of Consolidation

1. **Consistent error detection**: `if (!response.ok)` works everywhere
2. **Type safety**: TypeScript narrows response type based on `ok`
3. **Better error messages**: Structured `details` field for debugging
4. **Client simplicity**: Single pattern for error display

---

## Implementation Plan

### Phase 1: Tool Mapping (Required for OAuth)

1. Create `tool-mapping.ts` with bidirectional mappings
2. Update `provider.ts` to transform outgoing tool names
3. Update `adapter.ts` to normalize incoming tool names
4. Update `history-builder.ts` with naming option
5. Update client `index.tsx` with name aliases

### Phase 2: Testing

1. Test OAuth flow with transformed tools
2. Test mid-session switching (both directions)
3. Test history replay with mixed tool names
4. Verify client rendering for all tools

### Phase 3: Response Structure (Optional Enhancement)

1. Update `glob.ts`, `ripgrep.ts` to use `ToolResponse`
2. Update `edit.ts` to catch errors properly
3. Update git tools for consistency
4. Update remaining tools

### Phase 4: Documentation

1. Update tool authoring guide
2. Document response structure requirements
3. Add migration notes for existing tools

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/server/src/runtime/tool-mapping.ts` | **NEW** - Mapping module |
| `packages/server/src/runtime/provider.ts` | Transform tools in customFetch |
| `packages/server/src/tools/adapter.ts` | Normalize incoming names, pass auth type |
| `packages/server/src/runtime/history-builder.ts` | Accept naming option |
| `packages/server/src/runtime/runner.ts` | Pass auth type to adapter |
| `packages/web-sdk/src/components/messages/renderers/index.tsx` | Add name aliases |

---

## Resolved Questions

1. **Is it a whitelist or naming convention?**
   - **RESOLVED:** It's just PascalCase naming convention, NOT a whitelist
   - Any tool with a PascalCase name is accepted
   - AGI can use ALL its existing tools with OAuth

2. **Should we implement Claude Code-specific tools?**
   - **RESOLVED:** No need - AGI's tools work as-is with PascalCase names
   - Tools like `Task`, `WebFetch`, etc. are Claude Code features, not required for OAuth

3. **How to handle unknown tool names?**
   - Default auto-conversion: snake_case ↔ PascalCase works for any tool
   - No need for explicit mapping of every possible tool

---

## Appendix: AGI Tool Mapping

### Complete AGI Tool List (All Work with OAuth)

Since OAuth only validates PascalCase naming (not a whitelist), ALL AGI tools work:

| AGI Tool | PascalCase Name | Notes |
|----------|-----------------|-------|
| `read` | `Read` | File reading |
| `write` | `Write` | File writing |
| `edit` | `Edit` | Text editing |
| `ls` | `Ls` | Directory listing |
| `tree` | `Tree` | Directory tree |
| `cd` | `Cd` | Change directory |
| `pwd` | `Pwd` | Print working directory |
| `bash` | `Bash` | Shell execution |
| `terminal` | `Terminal` | Terminal sessions |
| `glob` | `Glob` | File pattern matching |
| `ripgrep` | `Grep` | Content search |
| `grep` | `Grep` | Content search |
| `git_status` | `GitStatus` | Git status |
| `git_diff` | `GitDiff` | Git diff |
| `git_commit` | `GitCommit` | Git commit |
| `apply_patch` | `ApplyPatch` | Patch application |
| `update_plan` | `UpdatePlan` | Task planning |
| `progress_update` | `ProgressUpdate` | Progress reporting |
| `finish` | `Finish` | Task completion |
| `websearch` | `WebSearch` | Web search |

### Claude Code-Specific Tools (NOT Required)

These tools exist in Claude Code but are NOT required for OAuth. They're optional features:
- `Task`, `TaskOutput` - Agent spawning (Claude Code feature)
- `WebFetch` - URL fetching with AI (Claude Code feature)
- `AskUserQuestion` - Interactive questions (Claude Code feature)
- `EnterPlanMode`, `ExitPlanMode` - Planning mode (Claude Code feature)
- `NotebookEdit` - Jupyter support (Claude Code feature)
- `Skill` - Plugin system (Claude Code feature)

---

## Implementation Summary

**Completed:**
1. ✅ Created `tool-mapping.ts` - Bidirectional snake_case ↔ PascalCase mapping
2. ✅ Updated `provider.ts` - Transform names in customFetch, added all required headers
3. ✅ Updated `adapter.ts` - Register tools with PascalCase names for OAuth
4. ✅ Updated `runner.ts` - Pass auth type to adapter
5. ✅ Updated client renderers - Added PascalCase → canonical aliases

**Not needed (based on testing):**
- ❌ Implementing Claude Code-specific tools (WebFetch, Task, etc.)
- ❌ Adding new renderers for Claude Code tools
- ❌ Changing tool schemas or descriptions
- ❌ Matching Claude Code's exact tool set
