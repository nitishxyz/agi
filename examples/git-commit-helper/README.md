# Git Commit Helper Example

Automatically generate conventional commit messages by analyzing git diffs with AI.

## What It Does

This example demonstrates:
- Git integration (reading diffs)
- Structured output with `generateObject`
- Zod schema validation
- Conventional commit format

## Prerequisites

- Bun (or Node.js 18+)
- Git repository with changes
- API key for an AI provider

## Setup

```bash
cd examples/git-commit-helper
bun install
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

Make some changes in a git repo, then run:

```bash
# From the git repo directory
bun run /path/to/examples/git-commit-helper/index.ts

# Or install globally (from this example directory)
bun link
git-commit-helper
```

The script will:
1. Read your staged changes (or all changes if nothing is staged)
2. Analyze the diff with AI
3. Suggest a conventional commit message
4. Optionally create the commit

## Example Output

```
🔍 Analyzing git diff...

📝 Suggested commit message:

feat(auth): add OAuth2 support for GitHub

- Implement OAuth2 flow with PKCE
- Add GitHub provider configuration
- Update authentication middleware

Breaking changes: None

Would you like to create this commit? (y/n)
```

## Key Concepts

### 1. Structured Output with Zod

```typescript
import { generateObject } from '@ottocode/sdk';
import { z } from 'zod';

const CommitMessageSchema = z.object({
  type: z.enum(['feat', 'fix', 'docs', 'refactor', 'test', 'chore']),
  scope: z.string().optional(),
  subject: z.string(),
  body: z.string().optional(),
  breaking: z.boolean()
});

const result = await generateObject({
  model,
  schema: CommitMessageSchema,
  prompt: `Analyze this git diff and suggest a commit message: ${diff}`
});

console.log(result.object);
// { type: 'feat', scope: 'auth', subject: '...', ... }
```

### 2. Git Integration

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get staged changes
const { stdout: diff } = await execAsync('git diff --staged');

// Or all changes
const { stdout: allDiff } = await execAsync('git diff HEAD');
```

### 3. Conventional Commits Format

The example generates commits following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Customization

### Add More Commit Types

```typescript
const CommitMessageSchema = z.object({
  type: z.enum([
    'feat', 'fix', 'docs', 'style', 'refactor',
    'perf', 'test', 'build', 'ci', 'chore', 'revert'
  ]),
  // ... rest of schema
});
```

### Custom Prompt

```typescript
const prompt = `
Analyze this git diff and generate a commit message.

Rules:
- Use conventional commit format
- Keep subject line under 50 characters
- Explain WHY, not just WHAT
- Mention breaking changes if any

Diff:
${diff}
`;
```

### Interactive Mode

```typescript
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const answer = await new Promise<string>(resolve => {
  rl.question('Create this commit? (y/n) ', resolve);
});

if (answer.toLowerCase() === 'y') {
  await execAsync(`git commit -m "${commitMessage}"`);
}
```

## Integration with Git Hooks

Create `.git/hooks/prepare-commit-msg`:

```bash
#!/bin/sh
# Auto-generate commit message suggestion

# Run the commit helper and save output
SUGGESTION=$(bun run /path/to/git-commit-helper/index.ts --dry-run)

# Prepend to commit message file
echo "$SUGGESTION" > "$1.tmp"
cat "$1" >> "$1.tmp"
mv "$1.tmp" "$1"
```

## Next Steps

- Combine with [Code Review Tool](../code-review-tool/) for pre-commit checks
- Add commit message linting
- Integrate with CI/CD pipelines
- Create custom git aliases
