# Tool Error Handling Analysis

## Overview

This document analyzes how tool calls and their errors are managed across the AGI codebase, from tool execution to LLM presentation.

## Current State

### Tool Execution Flow

1. **Tool Definition** (`packages/sdk/src/core/src/tools/builtin/`)
   - Tools are defined using AI SDK's `tool()` function
   - Each tool has an `execute` function that performs the actual work
   - Tools throw errors directly (e.g., `throw new Error('File not found')`)

2. **Tool Adapter** (`packages/server/src/tools/adapter.ts`)
   - Wraps each tool with execution lifecycle hooks
   - **Success Path:**
     - Result stored in DB as `tool_result` part
     - Published via SSE as `tool.result` event
     - Returned to AI SDK for next turn
   - **Error Path:**
     - Catches execution errors
     - Saves error to DB as `tool_result` with `{ ok: false, error: message, stack }`
     - Publishes via SSE as `tool.result` event with error payload
     - **Re-throws error to AI SDK** so it can handle it

3. **CLI Rendering** (`apps/cli/src/ask/run.ts` & `apps/cli/src/ask/capture.ts`)
   - Receives SSE events and renders to terminal
   - **Error Detection Logic:**
     ```typescript
     const hasErrorResult = Boolean(
       resultObj && (
         Reflect.has(resultObj, 'error') ||
         Reflect.get(resultObject, 'success') === false ||
         Reflect.get(resultObject, 'ok') === false
       )
     ) || Boolean(topLevelError);
     ```
   - Extracts error messages from multiple fields: `error`, `stderr`, `message`, `detail`, `details`, `reason`
   - Special case for bash: only treats as error if `exitCode !== 0`

### Error Handling Inconsistencies

#### 1. **Different Error Return Formats**

**Read Tool** (`packages/sdk/src/core/src/tools/builtin/fs/read.ts:73`)
```typescript
throw new Error(`File not found: ${req}`);
```
- Throws exception directly
- No structured error response

**Write Tool** (`packages/sdk/src/core/src/tools/builtin/fs/write.ts:39`)
```typescript
throw new Error(`Refusing to write outside project root: ${req}. Use a relative path within the project.`);
```
- Throws exception directly
- No structured error response

**Apply Patch Tool** (`packages/sdk/src/core/src/tools/builtin/patch.ts:565`)
```typescript
throw new Error('Only enveloped patch format is supported. Patch must start with "*** Begin Patch"...');
```
- Throws exception directly
- No structured error response

**Bash Tool** (`packages/sdk/src/core/src/tools/builtin/bash.ts:100`)
```typescript
if (exitCode !== 0 && !allowNonZeroExit) {
  const errorMsg = stderr.trim() || stdout.trim() || `Command failed with exit code ${exitCode}`;
  const msg = `${errorMsg}\n\nCommand: ${cmd}\nExit code: ${exitCode}`;
  reject(new Error(msg));
} else {
  resolve({ exitCode: exitCode ?? 0, stdout, stderr });
}
```
- Returns structured result on success: `{ exitCode, stdout, stderr }`
- Throws exception on failure
- CLI handles bash specially by checking `exitCode !== 0`

#### 2. **Parameter Validation**

Most tools rely on Zod schema validation which happens **before** `execute()` is called. However:

- **Missing required params** → Zod validation error (AI SDK handles)
- **Invalid path/values** → Discovered during execution → thrown exception
- **No consistent structure** for validation errors vs execution errors

#### 3. **Error Presentation to LLM**

When a tool throws an error:
1. Adapter catches it
2. Saves to DB: `{ ok: false, error: errorMessage, stack }`
3. Publishes to SSE
4. **Re-throws to AI SDK**

The AI SDK then:
- Receives the error as a tool execution failure
- Includes error in next prompt context
- LLM sees something like: `Tool 'read' failed with error: File not found: nonexistent.txt`

**Problem:** If the read tool errors because of missing file path, the LLM might still try to write to that file because:
- It doesn't see the actual result structure showing the path was invalid
- Error message might be vague ("File not found: undefined")
- No clear indication that the *parameter* was wrong vs file doesn't exist

### Current Error Detection in CLI

From `apps/cli/src/ask/run.ts:419-434`:

```typescript
const hasErrorResult = Boolean(
  resultObject && (
    Reflect.has(resultObject, 'error') ||
    Reflect.get(resultObject, 'success') === false ||
    Reflect.get(resultObject, 'ok') === false
  )
) || Boolean(topLevelError);
```

This checks for:
- `result.error` field
- `result.success === false`
- `result.ok === false`
- Top-level error string from event

### Error Message Extraction

From `apps/cli/src/ask/run.ts:44-61`:

```typescript
function extractToolErrorMessage(
  topLevelError: string | undefined,
  resultObject: Record<string, unknown> | null,
): string | undefined {
  const primary = typeof topLevelError === 'string' ? topLevelError.trim() : '';
  if (primary.length) return primary;
  if (!resultObject) return undefined;
  const keys = ['error', 'stderr', 'message', 'detail', 'details', 'reason'];
  for (const key of keys) {
    const value = resultObject[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length) return trimmed;
    }
  }
  return undefined;
}
```

## Problems Identified

### 1. **Inconsistent Error Responses**
- Most tools throw exceptions
- Bash returns structured result with `exitCode`
- No standard error response shape across tools

### 2. **Poor Parameter Validation Feedback**
- If `path` parameter is missing/invalid, error message may be unclear
- LLM sees "File not found: undefined" instead of "Missing required parameter: path"
- Zod validation errors are generic

### 3. **Missing Context in Errors**
- Errors don't include which parameters were invalid
- No distinction between:
  - Validation error (bad input)
  - Execution error (file doesn't exist)
  - Permission error (can't access file)

### 4. **Duplicate Error Handling Logic**
- `extractToolErrorMessage` duplicated in `run.ts` and `capture.ts`
- Error detection logic duplicated
- Bash special-casing repeated

### 5. **Error Payload Inconsistency**
The adapter creates:
```typescript
const errorResult = {
  ok: false,
  error: errorMessage,
  stack: errorStack,
};
```

But tools themselves just throw errors, so the adapter has to catch and normalize.

## Recommendations

### 1. **Standardize Error Response Format**

Define a standard error response type:

```typescript
export type ToolErrorResponse = {
  ok: false;
  error: string;
  errorType: 'validation' | 'not_found' | 'permission' | 'execution' | 'timeout';
  details?: {
    parameter?: string;
    value?: unknown;
    constraint?: string;
    [key: string]: unknown;
  };
};

export type ToolSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ToolResponse<T> = ToolSuccessResponse<T> | ToolErrorResponse;
```

### 2. **Update All Tools to Use Consistent Error Format**

Instead of throwing, tools should catch and return structured errors:

```typescript
// Before
throw new Error(`File not found: ${req}`);

// After
return {
  ok: false,
  error: `File not found: ${req}`,
  errorType: 'not_found',
  details: { parameter: 'path', value: req },
};
```

### 3. **Improve Parameter Validation**

Add custom Zod refinements with clear error messages:

```typescript
path: z.string()
  .min(1, 'File path cannot be empty')
  .describe('File path. Relative to project root by default; absolute paths allowed.')
  .refine(val => val.trim().length > 0, {
    message: 'File path cannot be only whitespace',
  })
```

### 4. **Consolidate Error Detection Logic**

Create shared utility in `packages/sdk/src/core/src/tools/`:

```typescript
export function isToolError(result: unknown): result is ToolErrorResponse {
  if (!result || typeof result !== 'object') return false;
  const obj = result as Record<string, unknown>;
  return (
    obj.ok === false ||
    'error' in obj ||
    obj.success === false
  );
}

export function extractToolError(
  result: unknown,
  topLevelError?: string,
): string | undefined {
  if (topLevelError?.trim()) return topLevelError.trim();
  if (!isToolError(result)) return undefined;
  // Extract from standardized fields
  return result.error || 'Tool execution failed';
}
```

### 5. **Improve Error Presentation to LLM**

Ensure error messages are clear and actionable:

```typescript
// Instead of: "File not found: undefined"
// Return: "Missing required parameter 'path'. Please provide a file path to read."

// Instead of: "Command failed with exit code 1"
// Return: "Command failed with exit code 1. stderr: Permission denied"
```

### 6. **Add Error Recovery Hints**

Include suggestions in error responses:

```typescript
return {
  ok: false,
  error: 'File not found: nonexistent.txt',
  errorType: 'not_found',
  details: {
    parameter: 'path',
    value: 'nonexistent.txt',
    suggestion: 'Use the ls or tree tool to find available files',
  },
};
```

## Implementation Priority

1. **High Priority:**
   - Consolidate error detection logic (create shared utilities)
   - Fix read tool to validate path parameter clearly
   - Update adapter to handle both throws and error responses

2. **Medium Priority:**
   - Standardize error response format across all tools
   - Add better parameter validation with custom messages
   - Update CLI rendering to use new error format

3. **Low Priority:**
   - Add error recovery hints
   - Create error type taxonomy
   - Add error telemetry/logging

## Example: Read Tool Improvement

### Before
```typescript
async execute({ path, startLine, endLine }) {
  const req = expandTilde(path);
  const abs = isAbsoluteLike(req) ? req : resolveSafePath(projectRoot, req);
  
  try {
    let content = await readFile(abs, 'utf-8');
    // ... rest of implementation
  } catch (_error: unknown) {
    throw new Error(`File not found: ${req}`);
  }
}
```

### After
```typescript
async execute({ path, startLine, endLine }) {
  // Validate path parameter
  if (!path || path.trim().length === 0) {
    return {
      ok: false,
      error: 'Missing required parameter: path',
      errorType: 'validation',
      details: {
        parameter: 'path',
        value: path,
        suggestion: 'Provide a file path to read',
      },
    };
  }

  const req = expandTilde(path);
  const abs = isAbsoluteLike(req) ? req : resolveSafePath(projectRoot, req);
  
  try {
    let content = await readFile(abs, 'utf-8');
    // ... rest of implementation
    return { ok: true, data: { path: req, content, size: content.length } };
  } catch (error: unknown) {
    const isEnoent = error && typeof error === 'object' && 
                     'code' in error && error.code === 'ENOENT';
    return {
      ok: false,
      error: isEnoent 
        ? `File not found: ${req}` 
        : `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      errorType: isEnoent ? 'not_found' : 'execution',
      details: {
        parameter: 'path',
        value: req,
        suggestion: isEnoent ? 'Use ls or tree to find available files' : undefined,
      },
    };
  }
}
```

## Conclusion

The current error handling is **inconsistent** across tools:
- Most tools throw exceptions
- Error messages lack context
- Parameter validation errors are unclear
- No standard format for error responses
- Duplicate error handling logic in CLI

**Root cause of "LLM tries to write after failed read":**
- Unclear error messages (e.g., "File not found: undefined")
- No distinction between missing parameter vs file doesn't exist
- LLM doesn't get structured feedback about what went wrong

**Solution:** Standardize error responses, improve validation messages, and consolidate error handling utilities.
