# Apply Patch Fuzzy Matching Implementation

## Overview

Enhanced the `apply_patch` tool to support fuzzy matching with whitespace normalization, making it more robust against tab/space differences while preserving exact matching when possible.

## Problem

The original `apply_patch` tool required **exact character-by-character matches**, including:
- Tabs vs spaces
- Number of spaces/tabs
- Leading/trailing whitespace

This caused patches to fail even when the logical content matched, just with different indentation styles.

## Solution

### 1. Two-Phase Matching Strategy

```typescript
function findSubsequenceWithFuzzy(
  lines: string[],
  pattern: string[],
  startIndex: number,
  useFuzzy: boolean,
): number {
  // Phase 1: Try exact match first (fastest, most reliable)
  const exactMatch = findSubsequence(lines, pattern, startIndex);
  if (exactMatch !== -1) return exactMatch;

  // Phase 2: If fuzzy enabled and exact fails, normalize whitespace
  if (useFuzzy && pattern.length > 0) {
    // Normalize tabs to spaces and trim
    const normalizedLines = lines.map(normalizeWhitespace);
    const normalizedPattern = pattern.map(normalizeWhitespace);
    // ... match normalized versions ...
  }

  return -1;
}
```

### 2. Whitespace Normalization

```typescript
function normalizeWhitespace(line: string): string {
  return line.replace(/\t/g, '  ').trim();
}
```

Converts:
- Tabs → 2 spaces
- Removes leading/trailing whitespace
- Preserves internal whitespace patterns

### 3. New Parameter

Added `fuzzyMatch` parameter (default: `true`):

```typescript
inputSchema: z.object({
  patch: z.string(),
  allowRejects: z.boolean().optional().default(false),
  fuzzyMatch: z.boolean().optional().default(true), // NEW
})
```

### 4. Enhanced Error Messages

When matching fails, provides:
- Expected lines
- Nearby context with line numbers
- Hint about whitespace differences

```
Failed to apply patch hunk in example.ts near context 'function'.
Expected to find:
  const value = 'old';
Nearby context (around line 5):
  5: function test() {
  6:   const value = 'old';
  7:   return value;
Hint: Check for whitespace differences (tabs vs spaces). Try enabling fuzzyMatch option.
```

## Benefits

### ✅ Backward Compatible
- Exact matching tried **first** (same speed as before)
- Fuzzy matching only activates on exact match failure
- Can be disabled with `fuzzyMatch: false`

### ✅ Handles Common Cases
- Tab vs space indentation
- Mixed indentation styles
- Leading/trailing whitespace differences

### ✅ Maintains Safety
- Still verifies logical content matches
- Preserves original file's indentation style in output
- No silent substitutions

### ✅ Better Debugging
- Clear error messages with context
- Shows what was expected vs what was found
- Suggests enabling fuzzy match if disabled

## Usage Examples

### Default (Fuzzy Enabled)

```typescript
// File has tabs:
function test() {
\tconst x = 1;  // \t = tab character
}

// Patch uses spaces (will match with fuzzy):
*** Begin Patch
*** Update File: example.ts
-  const x = 1;
+  const x = 2;
*** End Patch
```

### Strict Mode

```typescript
// Require exact whitespace matching:
apply_patch({
  patch: "...",
  fuzzyMatch: false  // Must match exactly
})
```

## Implementation Details

### Files Modified
- `packages/sdk/src/core/src/tools/builtin/patch.ts`
  - Added `normalizeWhitespace()` helper
  - Added `findSubsequenceWithFuzzy()` function
  - Updated `applyHunksToLines()` signature
  - Updated `applyUpdateOperation()` signature
  - Updated `applyEnvelopedPatch()` signature
  - Enhanced error messages with context
  - Added `fuzzyMatch` parameter to schema

- `packages/sdk/src/core/src/tools/builtin/patch.txt`
  - Documented fuzzy matching feature
  - Updated matching behavior description

### Performance Impact

**Minimal** - only activated on exact match failure:
- Exact match: Same performance as before (O(n*m))
- Fuzzy match: Only runs if exact fails (O(n*m) on normalized strings)

### Edge Cases Handled

1. **Empty patterns**: Returns -1 immediately
2. **File boundaries**: Respects file start/end
3. **Mixed whitespace**: Normalizes consistently
4. **Unicode**: Preserves non-ASCII characters
5. **Newlines**: Not normalized (structural)

## Future Enhancements

Potential improvements not yet implemented:

1. **Configurable normalization levels**
   - Level 1: Tab/space only (current)
   - Level 2: Collapse all whitespace
   - Level 3: Case-insensitive

2. **Similarity scoring**
   - Use Levenshtein distance for ranking matches
   - Accept "close enough" matches above threshold

3. **Auto-detect indentation style**
   - Detect tabs vs spaces from file
   - Auto-convert patch to match file style

4. **Partial line matching**
   - Match on key tokens, ignore whitespace entirely
   - More powerful but riskier

## Testing

Verified scenarios:
- ✅ Exact match still works (no regression)
- ✅ Tab→Space normalization works
- ✅ Space→Tab normalization works
- ✅ TypeScript compilation passes
- ✅ Error messages show helpful context

## Conclusion

The fuzzy matching enhancement makes `apply_patch` significantly more practical for real-world use while maintaining safety through:
1. Exact-first strategy
2. Opt-out capability
3. Preserved file indentation
4. Better error messages

This addresses the whitespace brittleness issue without compromising the tool's reliability.
