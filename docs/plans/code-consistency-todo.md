# Code Consistency TODOs

This document tracks remaining code inconsistencies identified during review.

## 1. SDK Console Logging

The SDK has a logger at `packages/sdk/src/core/src/utils/logger.ts` but some files still use `console.*` directly.

### Files Using console.* Directly

| File | Usage | Recommendation |
|------|-------|----------------|
| `providers/src/solforge-client.ts` | `console.log` for payment status | Keep - user-facing payment feedback |
| `skills/loader.ts` | `console.warn/error` when `AGI_DEBUG=1` | Consider using logger.warn/error |
| `core/src/tools/loader.ts` | `console.error` when `AGI_DEBUG_TOOLS=1` | Consider using logger.error |
| `core/src/tools/builtin/edit.ts` | `console.warn` for missing text | Consider using logger.warn |
| `prompts/src/debug.ts` | `console.log` for debug output | Keep - this IS the debug module |

### Recommendations

- **solforge-client.ts**: The console.log calls are intentional for user feedback during payment processing. Could use a callback pattern instead.
- **skills/loader.ts & tools/loader.ts**: These check environment variables before logging. Could be unified with the logger which already checks `isDebugEnabled()`.
- **edit.ts**: Should use logger.warn for consistency.

## 2. Server Git Routes - Missing Logging

Git routes don't use the logger from `@agi-cli/sdk` while other routes do.

### Affected Files

- `packages/server/src/routes/git/status.ts`
- `packages/server/src/routes/git/diff.ts`
- `packages/server/src/routes/git/branch.ts`
- `packages/server/src/routes/git/commit.ts`
- `packages/server/src/routes/git/staging.ts`
- `packages/server/src/routes/git/push.ts`

### Fix Required

Add logging to error paths:

```typescript
import { logger } from '@agi-cli/sdk';

// In catch blocks:
logger.error('Failed to get git status', error);
```

## 3. API Error Response Patterns

Two different error response formats are used:

### Pattern A - Git Routes (Inconsistent)

```typescript
return c.json(
  { status: 'error', error: message, code?: string },
  statusCode
);
```

### Pattern B - Other Routes (Correct)

```typescript
import { serializeError } from '../runtime/errors/api-error.ts';

const errorResponse = serializeError(err);
return c.json(errorResponse, errorResponse.error.status || 500);
```

### Standardized Response Format

All routes should use `serializeError()` which returns:

```typescript
{
  error: {
    message: string;
    type: string;
    status: number;
    code?: string;
    details?: Record<string, unknown>;
    stack?: string; // Only in debug mode
  }
}
```

## 4. Migration Plan

### Phase 1 - Quick Wins (Low Risk)
- [x] Fix `terminals/manager.ts` console.error → logger.error
- [ ] Fix `tools/builtin/edit.ts` console.warn → logger.warn

### Phase 2 - Git Routes (Medium Risk)
- [ ] Add logger import to all git routes
- [ ] Add logger.error calls in catch blocks
- [ ] Update error responses to use serializeError()
- [ ] Test all git endpoints

### Phase 3 - SDK Logging (Low Priority)
- [ ] Evaluate solforge-client.ts logging strategy
- [ ] Unify debug-conditional logging in skills/tools loaders

## Notes

- The logger only outputs when `AGI_DEBUG=1` or `AGI_TRACE=1` for most levels
- Error logging should always happen (logger.error respects this)
- Payment status messages in solforge-client are intentionally user-facing
