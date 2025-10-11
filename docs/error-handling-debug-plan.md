# Error Handling & Debugging Consolidation Plan

## Problem Statement

Currently experiencing inconsistent error handling across the stack:

1. **"[object Object]" errors** - Frontend receives objects instead of serialized error messages
2. **Scattered debug logic** - Debug flags rely on environment variables (`AGI_DEBUG`, `DEBUG_AGI`, etc.) spread throughout the codebase
3. **Inconsistent error responses** - Different routes return errors in different formats
4. **No unified debug flag** - Want `--debug` CLI flag instead of relying on env variables
5. **Poor error propagation** - Errors from server/API sometimes lose context when reaching frontend

## Current State Analysis

### Error Handling Locations

**Server Routes** (`packages/server/src/routes/`):
- `ask.ts` - Returns `{ error: err.message }` or `{ error: message }`
- `sessions.ts` - Returns `{ error: message }`
- `config.ts` - Returns `{ error: 'string' }`
- `git.ts` - Returns `{ status: 'error', error: validation.error, code: validation.code }`
- `session-messages.ts` - Returns `{ error: message }`

**Error Handling Utilities**:
- `packages/server/src/runtime/error-handling.ts` - Has `toErrorPayload()` function but not consistently used
- `packages/server/src/runtime/ask-service.ts` - Has `AskServiceError` class and `normalizeAskServiceError()`

**Debug Utilities**:
- `packages/server/src/runtime/debug.ts` - Checks `AGI_DEBUG`, `DEBUG_AGI`, `AGI_DEBUG_TIMING` env vars
- `packages/sdk/src/prompts/src/debug.ts` - Similar debug implementation
- `apps/cli/index.ts` - Checks `DEBUG_AGI` in multiple places

**Frontend Error Handling** (`packages/web-sdk/src/`):
- `lib/api-client.ts` - Uses `String(response.error)` which causes "[object Object]"
- `components/messages/renderers/ErrorRenderer.tsx` - Attempts to parse various error structures

### Root Causes

1. **API Client stringification**: `String(response.error)` converts objects to "[object Object]"
2. **Inconsistent server responses**: Some routes return strings, others return objects
3. **No centralized error serialization**: Errors aren't consistently serialized before sending to frontend
4. **Environment-based debugging**: No CLI flag to enable debug mode at runtime

## Solution Architecture

### 1. Unified Error Response Format

Create a consistent error response structure across all API endpoints:

```typescript
type APIErrorResponse = {
  error: {
    message: string;
    code?: string;
    type?: string;
    status?: number;
    details?: Record<string, unknown>;
    stack?: string; // Only in debug mode
  };
};
```

### 2. Centralized Error Handler Module

**New file**: `packages/server/src/runtime/api-error.ts`

Consolidate all error handling logic:
- Error serialization (objects → JSON-safe format)
- Error response formatting
- Debug-aware error details
- HTTP status code mapping
- Stack trace inclusion (debug mode only)

### 3. Debug System Overhaul

**New file**: `packages/server/src/runtime/logger.ts`

Features:
- Runtime debug flag support (`--debug` CLI argument)
- Centralized logging functions
- Debug levels (error, warn, info, debug, trace)
- Structured logging for easier parsing
- Color-coded output in development
- JSON output in production

### 4. CLI Debug Flag

Update CLI entry point to support `--debug` flag:
- Parse `--debug` from `process.argv`
- Set global debug state
- Pass debug flag to server/runtime

## Implementation Plan

### Phase 1: Create Core Utilities (New Files)

1. **Create `packages/server/src/runtime/logger.ts`**
   - Export `Logger` class with methods: `debug()`, `info()`, `warn()`, `error()`
   - Support `--debug` flag via runtime configuration
   - Replace all `console.log` calls in server
   - Integrate with existing `debug.ts` timing functionality

2. **Create `packages/server/src/runtime/api-error.ts`**
   - Export `APIError` class extending Error
   - Export `serializeError(err: unknown): APIErrorResponse`
   - Export `createErrorResponse(err: unknown, debug: boolean)`
   - Export Hono middleware `errorHandler()`

3. **Create `packages/server/src/runtime/debug-state.ts`**
   - Export singleton for debug state management
   - Export `setDebugEnabled(enabled: boolean)`
   - Export `isDebugEnabled(): boolean`
   - Can be set via env OR runtime flag

### Phase 2: Update Server Routes

Update all route files to use unified error handling:

1. **`routes/ask.ts`**
   - Replace try-catch with `createErrorResponse()`
   - Return properly serialized errors

2. **`routes/sessions.ts`**
   - Use `serializeError()` in catch blocks
   - Consistent error format

3. **`routes/config.ts`**
   - Use `APIError` class for structured errors
   - Consistent status codes

4. **`routes/git.ts`**
   - Remove console.warn, use logger
   - Use unified error format

5. **`routes/session-messages.ts`**
   - Consistent error responses

6. **`routes/session-stream.ts`**
   - Error handling in SSE stream

### Phase 3: Update Server Core

1. **`runtime/ask-service.ts`**
   - Replace `AskServiceError` with `APIError`
   - Use `serializeError()` consistently
   - Remove scattered error handling

2. **`runtime/debug.ts`**
   - Integrate with new `logger.ts`
   - Keep timing functionality
   - Deprecate direct usage

3. **`index.ts`**
   - Add global error handler middleware
   - Initialize debug state from config

### Phase 4: Update CLI

1. **`apps/cli/index.ts`**
   - Parse `--debug` flag from argv
   - Pass to server initialization
   - Remove `DEBUG_AGI` env checks (keep as fallback)

2. **`apps/cli/src/ask/run.ts`**
   - Update error handling to use new format
   - Better error messages from API

### Phase 5: Update Frontend

1. **`packages/web-sdk/src/lib/api-client.ts`**
   - Update error extraction to handle new format
   - Remove `String(response.error)`
   - Proper error object handling

2. **`packages/web-sdk/src/components/messages/renderers/ErrorRenderer.tsx`**
   - Simplify error parsing (consistent structure now)
   - Better error display

### Phase 6: Testing & Documentation

1. Test error scenarios:
   - Missing credentials
   - Invalid parameters
   - Network errors
   - Timeout errors
   - Provider API errors

2. Update documentation:
   - Error handling guide
   - Debug flag usage
   - API error response format

## File Structure

```
packages/server/src/runtime/
├── api-error.ts        # NEW - Unified error handling
├── logger.ts           # NEW - Centralized logging
├── debug-state.ts      # NEW - Runtime debug state
├── debug.ts            # KEEP - Timing utilities, integrate with logger
├── error-handling.ts   # KEEP - toErrorPayload(), may refactor to use api-error
└── ask-service.ts      # UPDATE - Use new error classes
```

## Migration Strategy

### Backward Compatibility

- Keep existing `toErrorPayload()` function but mark as deprecated
- Keep `AskServiceError` as alias to `APIError`
- Keep environment variable support as fallback
- Gradual migration of console.log calls

### Breaking Changes

None - all changes are internal improvements.

## Implementation Checklist

### Step 1: Core Infrastructure
- [ ] Create `packages/server/src/runtime/logger.ts`
- [ ] Create `packages/server/src/runtime/api-error.ts`
- [ ] Create `packages/server/src/runtime/debug-state.ts`
- [ ] Add tests for new utilities

### Step 2: Server Integration
- [ ] Add global error handler middleware to `packages/server/src/index.ts`
- [ ] Update `runtime/ask-service.ts` to use new error handling
- [ ] Update all route files to use `serializeError()`
- [ ] Replace console.log calls with logger

### Step 3: CLI Integration
- [ ] Add `--debug` flag parsing to `apps/cli/index.ts`
- [ ] Pass debug state to server initialization
- [ ] Update error display in `apps/cli/src/ask/run.ts`

### Step 4: Frontend Updates
- [ ] Fix error extraction in `packages/web-sdk/src/lib/api-client.ts`
- [ ] Simplify `ErrorRenderer.tsx`
- [ ] Test error display in UI

### Step 5: Cleanup
- [ ] Remove duplicate debug implementations
- [ ] Deprecate old error handling functions
- [ ] Update all console.log/error calls
- [ ] Add JSDoc comments

### Step 6: Documentation
- [ ] Update API documentation
- [ ] Add error handling examples
- [ ] Document debug flag usage
- [ ] Add troubleshooting guide

## Example Usage

### Server Side (New Pattern)

```typescript
// packages/server/src/routes/ask.ts
import { logger } from '../runtime/logger';
import { serializeError } from '../runtime/api-error';

app.post('/v1/ask', async (c) => {
  try {
    const result = await handleAskRequest(request);
    return c.json(result, 202);
  } catch (err) {
    logger.error('Ask request failed:', err);
    const errorResponse = serializeError(err);
    return c.json(errorResponse, errorResponse.error.status || 400);
  }
});
```

### CLI Side (New Pattern)

```typescript
// apps/cli/index.ts
const debugEnabled = argv.includes('--debug');
setDebugEnabled(debugEnabled);

// Later in code
logger.debug('Processing request with options:', opts);
```

### Frontend Side (New Pattern)

```typescript
// packages/web-sdk/src/lib/api-client.ts
if (response.error) {
  const errorMsg = typeof response.error === 'string' 
    ? response.error 
    : response.error.message || 'Unknown error';
  throw new Error(errorMsg);
}
```

## Success Criteria

1. ✅ No more "[object Object]" errors in frontend
2. ✅ Consistent error format across all API endpoints
3. ✅ `--debug` flag works to enable debug logging
4. ✅ Environment variables still work as fallback
5. ✅ All console.log calls replaced with logger
6. ✅ Stack traces only shown in debug mode
7. ✅ Error details properly propagated to frontend
8. ✅ Better error messages for users
9. ✅ Easier debugging for developers

## Timeline Estimate

- **Core utilities**: 2-3 hours
- **Server integration**: 3-4 hours
- **CLI integration**: 1-2 hours
- **Frontend updates**: 1-2 hours
- **Testing & cleanup**: 2-3 hours
- **Documentation**: 1-2 hours

**Total**: ~10-16 hours of development time

## Notes

- Keep the existing `error-handling.ts` for now as it has good error extraction logic
- The `toErrorPayload()` function can be integrated into the new `api-error.ts`
- Consider adding Sentry or similar error tracking in the future
- Could extend logger to support log files in addition to console
- Debug flag could be extended to support levels: `--debug=info`, `--debug=trace`, etc.
