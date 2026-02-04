# Customization

[← Back to README](../README.md) • [Docs Index](./index.md)

## Custom Commands

Create reusable commands for common workflows in your project.

### Example: Commit Command

Create `.otto/commands/commit.json`:

```json
{
  "name": "commit",
  "description": "Generate a commit message from staged changes",
  "agent": "commit",
  "interactive": true,
  "promptTemplate": "Generate a commit message for these changes:\n{input}",
  "confirm": {
    "required": true,
    "message": "Proceed with this commit message?"
  }
}
```

Usage:

```bash
otto commit
```

## Custom Tools

Tools must implement the AITool interface and export as default.

### Example: Custom Tool Implementation

Create `.otto/tools/file-size/tool.ts`:

```typescript
import { z } from 'zod';
import type { AITool, ToolContext } from '../../../src/ai/types';

const tool: AITool<{ path: string }, { size: number }> = {
  name: 'file-size',
  description: 'Get file size at a path',
  parameters: z.object({ path: z.string() }),
  async execute({ path }, ctx: ToolContext) {
    const fs = await import('node:fs/promises');
    const stat = await fs.stat(path);
    return { size: stat.size };
  }
};

export default tool;
```
