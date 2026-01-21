# Server Package Refactor Plan

This document outlines planned refactoring for `packages/server/src/`.

## Phase 1: Convert Dynamic Imports to Static ✓ (Completed)

Dynamic imports add unnecessary complexity. Convert all to static imports at module top.

---

## Phase 2: Break Up Large Files

Target: Keep files under ~200-250 lines for maintainability.

### Priority 1: Core Runtime Files (>500 lines)

#### `runtime/provider/index.ts` ✓ COMPLETED
Split into 7 modules:
- `index.ts` - Exports, `resolveModel()` dispatcher (~45 lines)
- `anthropic.ts` - Anthropic provider setup with OAuth (~340 lines)
- `openai.ts` - OpenAI provider setup (~26 lines)
- `google.ts` - Google provider setup (~12 lines)
- `openrouter.ts` - OpenRouter provider setup (~11 lines)
- `solforge.ts` - Solforge provider setup (~22 lines)
- `zai.ts` - ZAI provider setup (~53 lines)
- `opencode.ts` - OpenCode provider setup (~61 lines)

#### `runtime/stream/handlers.ts` ✓ COMPLETED
Split into 5 modules:
- `handlers.ts` - Re-exports (~5 lines)
- `types.ts` - Type definitions (~17 lines)
- `step-finish.ts` - `createStepFinishHandler()` (~93 lines)
- `error-handler.ts` - `createErrorHandler()` (~203 lines)
- `abort-handler.ts` - `createAbortHandler()` (~65 lines)
- `finish-handler.ts` - `createFinishHandler()` (~123 lines)

#### `runtime/message/compaction.ts` ✓ COMPLETED
Split into 6 modules:
- `compaction.ts` - Re-exports (~23 lines)
- `compaction-limits.ts` - Token limits, overflow detection (~58 lines)
- `compaction-detect.ts` - Command detection (~19 lines)
- `compaction-context.ts` - Context building (~64 lines)
- `compaction-mark.ts` - Mark compacted parts (~115 lines)
- `compaction-prune.ts` - Auto-prune logic (~75 lines)
- `compaction-auto.ts` - Auto-compaction (~137 lines)

#### `runtime/agent/runner.ts` (659 lines) - HELPER MODULES CREATED
COMPLETED - Refactored to use helper modules:
- `runner-setup.ts` - Config loading, agent resolution, system prompt (~265 lines)
- `runner-reasoning.ts` - Reasoning state management (~108 lines)
- `runner.ts` - Main orchestration (~357 lines, down from 659)

#### `tools/adapter.ts` (606 lines) - DEFERRED
Deferred due to tight coupling and complex state management.
The adapter has significant state sharing between tool execution callbacks.
Consider refactoring in a future iteration with careful state extraction.

### Priority 2: Route & Service Files (300-500 lines) - PENDING

#### `openapi/paths/git.ts` (453 lines)
Split into:
- `git.ts` - Re-exports all git paths
- `git-status.ts` - Status endpoint schema
- `git-diff.ts` - Diff endpoint schema
- `git-commit.ts` - Commit endpoint schema
- `git-staging.ts` - Stage/unstage schemas
- `git-push.ts` - Push endpoint schema

#### `runtime/message/service.ts` (439 lines)
Split into:
- `service.ts` - Main `dispatchAssistantMessage()` (~150 lines)
- `title-generation.ts` - Title generation logic (~100 lines)
- `message-create.ts` - Message/part creation helpers (~100 lines)
- `image-processing.ts` - Image attachment handling (~80 lines)

#### `routes/session-files.ts` (387 lines)
Split into:
- `session-files.ts` - Route registration, list endpoint (~150 lines)
- `session-files-read.ts` - File read endpoint (~100 lines)
- `session-files-write.ts` - File write endpoint (~100 lines)

#### `runtime/ask/service.ts` (369 lines)
Split into:
- `service.ts` - Main `handleAskRequest()` (~150 lines)
- `ask-validation.ts` - Request validation, provider checks (~100 lines)
- `ask-session.ts` - Session creation/lookup (~100 lines)

### Priority 3: Lower Priority (250-350 lines) - PENDING

These can be addressed later:
- `runtime/agent/registry.ts` (333 lines)
- `openapi/schemas.ts` (319 lines)
- `routes/sessions.ts` (303 lines)
- `runtime/session/branch.ts` (277 lines)
- `runtime/message/history-builder.ts` (266 lines)
- `index.ts` (265 lines)

---

## Implementation Status

| Module | Status | Notes |
|--------|--------|-------|
| provider/index.ts | ✅ Complete | 7 modules |
| stream/handlers.ts | ✅ Complete | 5 modules |
| message/compaction.ts | ✅ Complete | 6 modules |
| agent/runner.ts | ✅ Complete | 3 modules, 659→357 lines |
| tools/adapter.ts | ❌ Deferred | Too tightly coupled |

---

## Guidelines for Splitting

1. **One concept per file** - Each file should do one thing well
2. **Keep related code together** - Don't over-split
3. **Minimize circular deps** - Use index.ts to re-export
4. **Preserve public API** - Existing imports should keep working
5. **Add barrel exports** - `index.ts` in each folder re-exports public API

---

## File Size Targets

| Category | Target Lines | Notes |
|----------|--------------|-------|
| Route handlers | 100-200 | One route group per file |
| Service functions | 150-250 | Core business logic |
| Utility modules | 50-100 | Pure functions |
| Type definitions | No limit | Types don't affect runtime |
| Index/barrel files | < 50 | Just re-exports |
