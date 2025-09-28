# File Editing Conflict Resolution

## Problem Statement
When an LLM makes multiple edits to the same file within a single step, subsequent edits may fail because:
1. The LLM generates all edit operations based on the initial file state
2. After the first edit, the file content changes
3. Subsequent edits try to find/replace text that no longer exists in the expected form

## Current Behavior
- The `edit` tool DOES re-read the file on each execution (line 61 in edit.ts)
- However, the LLM generates all tool calls at once based on its initial understanding
- This creates a mismatch between what the LLM expects and the actual file state

## Solution Options

### Option 1: Force Sequential Execution with prepareStep
Use the AI SDK's `prepareStep` callback to force the LLM to re-read files after each edit:

```typescript
// In runner.ts
const result = streamText({
  // ... existing config
  prepareStep: async ({ stepNumber, steps, messages }) => {
    // Check if the previous step was a file edit
    const lastStep = steps[steps.length - 1];
    if (lastStep?.toolCalls?.some(tc => ['edit', 'write'].includes(tc.name))) {
      // Force a read of modified files
      return {
        activeTools: ['read', 'edit', 'write'], // Encourage re-reading
      };
    }
  },
});
```

### Option 2: Smart Edit Operations Merging
Merge multiple edit operations for the same file into a single atomic operation:

```typescript
// In adapter.ts
function mergeEditOperations(calls: ToolCall[]): ToolCall[] {
  const editsByFile = new Map<string, EditOp[]>();
  
  for (const call of calls) {
    if (call.name === 'edit') {
      const path = call.args.path;
      if (!editsByFile.has(path)) {
        editsByFile.set(path, []);
      }
      editsByFile.get(path)!.push(...call.args.ops);
    }
  }
  
  // Return merged operations
  return Array.from(editsByFile.entries()).map(([path, ops]) => ({
    name: 'edit',
    args: { path, ops }
  }));
}
```

### Option 3: File State Versioning
Track file versions and validate edit operations:

```typescript
// In edit.ts
const fileVersions = new Map<string, { content: string; version: number }>();

export const editTool: Tool = tool({
  // ... existing config
  async execute({ path, ops, expectedVersion }) {
    const currentContent = await Bun.file(path).text();
    const cached = fileVersions.get(path);
    
    // Check if content has changed unexpectedly
    if (expectedVersion && cached?.version !== expectedVersion) {
      // Re-validate operations against current content
      ops = revalidateOps(ops, cached?.content, currentContent);
    }
    
    // Apply operations...
    const newContent = applyOps(currentContent, ops);
    
    // Update version
    fileVersions.set(path, {
      content: newContent,
      version: (cached?.version || 0) + 1
    });
    
    await Bun.write(path, newContent);
  }
});
```

### Option 4: Instruction-Based Solution (Recommended)
Add clear instructions to the system prompt:

```text
IMPORTANT: When editing files:
1. Always read the file first before making edits
2. If making multiple edits to the same file, combine them into a single edit operation
3. After editing a file, re-read it before making additional edits
4. Never assume the file content remains the same after an edit operation
```

## Recommended Implementation

The best approach combines multiple strategies:

1. **Immediate**: Update system prompts to guide better LLM behavior
2. **Short-term**: Implement operation merging in the adapter
3. **Long-term**: Use prepareStep to enforce re-reading after edits

## Implementation Steps

### Step 1: Update System Prompt
Add file editing best practices to the agent prompts.

### Step 2: Add Operation Merging
Modify the adapter to detect and merge multiple edits to the same file.

### Step 3: Add Validation
Add content validation to detect when edits are based on stale content.

### Step 4: Implement prepareStep (Optional)
For complex multi-step edits, use prepareStep to enforce proper sequencing.

## Testing

Create test cases that:
1. Make multiple edits to the same file
2. Make conflicting edits
3. Make edits based on previous edits
4. Handle edge cases (file doesn't exist, concurrent modifications)