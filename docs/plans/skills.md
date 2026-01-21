# Skills Feature Plan

## Overview

Skills are reusable markdown instructions that agents can discover and load on-demand. They extend agent capabilities without modifying core code. This implementation follows the **[Agent Skills Specification](https://agentskills.io)** - an open standard developed by Anthropic and adopted by OpenCode, Claude Code, Codex, Cursor, and 12+ other agents.

## How Skills Work

### Directory Structure

```
my-skill/
├── SKILL.md              # Required: instructions + metadata
├── scripts/              # Optional: executable code
│   └── extract.py
├── references/           # Optional: documentation
│   └── REFERENCE.md
└── assets/               # Optional: templates, resources
    └── template.json
```

### Progressive Disclosure (Token Efficiency)

Skills use a two-phase loading strategy:

1. **Startup (~100 tokens/skill)**: Only `name` and `description` loaded into system prompt
2. **Activation (<5000 tokens recommended)**: Full SKILL.md content loaded when agent decides to use it
3. **On-demand**: Files in `scripts/`, `references/`, `assets/` loaded only when needed

This keeps context usage low until a skill is actually needed.

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Startup: Agent sees skill names + descriptions              │
│                                                             │
│ <available_skills>                                          │
│   <skill>                                                   │
│     <name>git-release</name>                                │
│     <description>Create releases and changelogs</description>│
│   </skill>                                                  │
│ </available_skills>                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Task: User asks to "prepare a release"                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Activation: Agent calls skill({ name: "git-release" })      │
│ → Full SKILL.md content loads into context                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Execution: Agent follows instructions, may read scripts/    │
│ references/ or assets/ as needed                            │
└─────────────────────────────────────────────────────────────┘
```

## SKILL.md Format

```yaml
---
name: git-release
description: Create consistent releases and changelogs from merged PRs
license: MIT
compatibility: Requires git CLI and GitHub access
metadata:
  author: agi-cli
  version: "1.0"
allowed-tools: Bash(git:*) Bash(gh:*)
---

## What I do
- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me
Use this when preparing a tagged release.

## Steps
1. Check current version with `git describe --tags`
2. List PRs since last release
3. Categorize changes (features, fixes, breaking)
4. Draft release notes
5. Suggest version bump based on changes
```

### Frontmatter Fields

| Field | Required | Constraints | Description |
|-------|----------|-------------|-------------|
| `name` | Yes | 1-64 chars, lowercase alphanumeric + hyphens, no start/end hyphen, no `--` | Must match directory name |
| `description` | Yes | 1-1024 chars | Helps agent decide when to use skill |
| `license` | No | - | License identifier or reference to bundled file |
| `compatibility` | No | 1-500 chars | Environment requirements (product, packages, network) |
| `metadata` | No | string→string map | Custom key-value pairs (author, version, etc.) |
| `allowed-tools` | No | space-delimited | Pre-approved tools (experimental) |

### Name Validation Regex
```
^[a-z0-9]+(-[a-z0-9]+)*$
```

## Discovery Paths & Scopes

Following Codex's scope precedence model (higher overrides lower):

| Scope | Location | Use Case |
|-------|----------|----------|
| **CWD** | `$CWD/.agi/skills/` | Skills for current working directory |
| **Parent** | `$CWD/../.agi/skills/` | Skills for parent folder (monorepo modules) |
| **Repo Root** | `$REPO_ROOT/.agi/skills/` | Repository-wide skills |
| **User** | `~/.config/agi/skills/` | Personal skills across all projects |
| **System** | Bundled with AGI | Built-in skills (skill-creator, etc.) |

### Cross-Agent Compatibility

Also scan these paths for compatibility with other agents:

| Agent | Project Path | Global Path |
|-------|--------------|-------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Codex | `.codex/skills/` | `~/.codex/skills/` |

**Discovery algorithm:**
1. Start at current working directory
2. Walk up to git worktree root, collecting skills from `.agi/skills/`, `.claude/skills/`, `.opencode/skills/`
3. Load global skills from `~/.config/agi/skills/`, `~/.claude/skills/`, `~/.config/opencode/skills/`
4. Later paths override earlier (project overrides global, CWD overrides parent)

## CLI: Installing Skills

### `agi skills add` Command

Install skills from GitHub repositories (compatible with `npx add-skill`):

```bash
# GitHub shorthand
agi skills add vercel-labs/agent-skills

# Full URL
agi skills add https://github.com/anthropics/skills

# Direct path to specific skill
agi skills add https://github.com/vercel-labs/agent-skills/tree/main/skills/frontend-design

# Specific skills only
agi skills add vercel-labs/agent-skills --skill frontend-design --skill skill-creator

# Global install
agi skills add anthropics/skills --global

# List available skills in a repo
agi skills add vercel-labs/agent-skills --list
```

### Other CLI Commands

```bash
agi skills list              # List all discovered skills
agi skills show <name>       # Show skill content
agi skills create <name>     # Scaffold new skill (or use built-in $skill-creator)
agi skills validate <path>   # Validate SKILL.md format
```

## Implementation Plan

### Phase 1: Core Skill Loader

**Files to create:**
```
packages/sdk/src/skills/
├── index.ts              # Re-exports
├── loader.ts             # discoverSkills(), loadSkill()
├── parser.ts             # Parse SKILL.md frontmatter + content
├── types.ts              # SkillDefinition, SkillMetadata types
├── validator.ts          # Validate name, description, frontmatter
└── tool.ts               # Built-in "skill" tool
```

**`packages/sdk/src/skills/types.ts`:**
```typescript
export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
}

export interface SkillDefinition {
  metadata: SkillMetadata;
  content: string;
  path: string;
  scope: SkillScope;
}

export type SkillScope = 'cwd' | 'parent' | 'repo' | 'user' | 'system';

export interface DiscoveredSkill {
  name: string;
  description: string;
  path: string;
  scope: SkillScope;
}
```

**`packages/sdk/src/skills/validator.ts`:**
```typescript
const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;

export function validateMetadata(meta: unknown, path: string): asserts meta is SkillMetadata {
  if (!meta || typeof meta !== 'object') {
    throw new Error(`Invalid frontmatter in ${path}`);
  }
  
  const m = meta as Record<string, unknown>;
  
  // name validation
  if (typeof m.name !== 'string' || !m.name) {
    throw new Error(`Missing required 'name' field in ${path}`);
  }
  if (m.name.length > MAX_NAME_LENGTH) {
    throw new Error(`Skill name exceeds ${MAX_NAME_LENGTH} chars in ${path}`);
  }
  if (!NAME_REGEX.test(m.name)) {
    throw new Error(`Invalid skill name '${m.name}' - must be lowercase alphanumeric with hyphens`);
  }
  
  // description validation
  if (typeof m.description !== 'string' || !m.description) {
    throw new Error(`Missing required 'description' field in ${path}`);
  }
  if (m.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description exceeds ${MAX_DESCRIPTION_LENGTH} chars in ${path}`);
  }
  
  // optional fields
  if (m.compatibility && typeof m.compatibility === 'string' && m.compatibility.length > MAX_COMPATIBILITY_LENGTH) {
    throw new Error(`Compatibility exceeds ${MAX_COMPATIBILITY_LENGTH} chars in ${path}`);
  }
}
```

**`packages/sdk/src/skills/loader.ts`:**
```typescript
import { join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import fg from 'fast-glob';
import { parseSkillFile } from './parser';
import type { SkillDefinition, DiscoveredSkill, SkillScope } from './types';

const skillCache = new Map<string, SkillDefinition>();

// Paths to scan relative to a directory
const SKILL_DIRS = ['.agi/skills', '.claude/skills', '.opencode/skills', '.codex/skills'];

export async function discoverSkills(cwd: string, repoRoot?: string): Promise<DiscoveredSkill[]> {
  const skills = new Map<string, SkillDefinition>();
  
  // 1. Load global skills (lowest priority)
  const globalDirs = [
    join(process.env.HOME || '', '.config/agi/skills'),
    join(process.env.HOME || '', '.claude/skills'),
    join(process.env.HOME || '', '.config/opencode/skills'),
    join(process.env.HOME || '', '.codex/skills'),
  ];
  for (const dir of globalDirs) {
    await loadSkillsFromDir(dir, 'user', skills);
  }
  
  // 2. Walk from repo root to cwd, collecting skills
  if (repoRoot) {
    await loadSkillsFromDir(join(repoRoot, '.agi/skills'), 'repo', skills);
    // ... other compatible paths
  }
  
  // 3. Load cwd skills (highest priority)
  for (const skillDir of SKILL_DIRS) {
    await loadSkillsFromDir(join(cwd, skillDir), 'cwd', skills);
  }
  
  // Cache for retrieval
  skillCache.clear();
  for (const [name, def] of skills) {
    skillCache.set(name, def);
  }
  
  return Array.from(skills.values()).map(s => ({
    name: s.metadata.name,
    description: s.metadata.description,
    path: s.path,
    scope: s.scope,
  }));
}

export async function loadSkill(name: string): Promise<SkillDefinition | null> {
  return skillCache.get(name) ?? null;
}

async function loadSkillsFromDir(
  dir: string,
  scope: SkillScope,
  skills: Map<string, SkillDefinition>
): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    return;
  }
  
  const pattern = '*/SKILL.md';
  const files = await fg(pattern, { cwd: dir, absolute: true });
  
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const skill = parseSkillFile(content, filePath, scope);
      
      // Validate directory name matches skill name
      const dirName = dirname(filePath).split('/').pop();
      if (dirName !== skill.metadata.name) {
        console.warn(`Skill name '${skill.metadata.name}' doesn't match directory '${dirName}'`);
      }
      
      skills.set(skill.metadata.name, skill);
    } catch (err) {
      if (process.env.AGI_DEBUG === '1') {
        console.error(`Failed to load skill from ${filePath}:`, err);
      }
    }
  }
}
```

**`packages/sdk/src/skills/tool.ts`:**
```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { loadSkill, discoverSkills } from './loader';
import type { DiscoveredSkill } from './types';

let cachedSkillList: DiscoveredSkill[] = [];

export function createSkillTool() {
  return tool({
    description: buildSkillDescription(),
    parameters: z.object({
      name: z.string().describe('Name of the skill to load'),
    }),
    execute: async ({ name }) => {
      const skill = await loadSkill(name);
      if (!skill) {
        return { ok: false, error: `Skill '${name}' not found` };
      }
      return {
        ok: true,
        name: skill.metadata.name,
        description: skill.metadata.description,
        content: skill.content,
        path: skill.path,
      };
    },
  });
}

export async function initializeSkills(cwd: string, repoRoot?: string): Promise<void> {
  cachedSkillList = await discoverSkills(cwd, repoRoot);
}

function buildSkillDescription(): string {
  if (cachedSkillList.length === 0) {
    return 'Load a skill by name. No skills are currently available.';
  }
  
  const skillsXml = cachedSkillList
    .map(s => `<skill><name>${s.name}</name><description>${s.description}</description></skill>`)
    .join('\n');
  
  return `Load a skill by name to get detailed instructions.

<available_skills>
${skillsXml}
</available_skills>

Call this tool with the skill name when you need the full instructions.`;
}
```

### Phase 2: CLI Commands

**`apps/cli/src/commands/skills.ts`:**
```typescript
import { Command } from 'commander';

export const skillsCommand = new Command('skills')
  .description('Manage agent skills');

// agi skills list
skillsCommand
  .command('list')
  .description('List all discovered skills')
  .action(async () => {
    // Implementation
  });

// agi skills add <source>
skillsCommand
  .command('add <source>')
  .description('Install skills from a git repository')
  .option('-g, --global', 'Install to user directory')
  .option('-s, --skill <names...>', 'Install specific skills only')
  .option('-l, --list', 'List available skills without installing')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (source, options) => {
    // Clone repo, find SKILL.md files, copy to target directory
  });

// agi skills show <name>
skillsCommand
  .command('show <name>')
  .description('Show skill content')
  .action(async (name) => {
    // Implementation
  });

// agi skills create <name>
skillsCommand
  .command('create <name>')
  .description('Scaffold a new skill')
  .option('-g, --global', 'Create in user directory')
  .action(async (name, options) => {
    // Create skill directory with template SKILL.md
  });

// agi skills validate <path>
skillsCommand
  .command('validate [path]')
  .description('Validate skill format')
  .action(async (path = '.') => {
    // Validate SKILL.md format
  });
```

### Phase 3: Permissions

**Add to config schema:**
```typescript
interface SkillPermissions {
  [pattern: string]: 'allow' | 'deny' | 'ask';
}

interface AGIConfig {
  permissions?: {
    skill?: SkillPermissions;
  };
}
```

**Default permissions in `agi.json`:**
```json
{
  "permissions": {
    "skill": {
      "*": "allow"
    }
  }
}
```

### Phase 4: Built-in Skills

Create bundled skills that ship with AGI:

```
packages/sdk/src/skills/builtin/
├── skill-creator/
│   └── SKILL.md          # Help users create new skills
└── skill-installer/
    └── SKILL.md          # Install skills from repositories
```

**`skill-creator/SKILL.md`:**
```yaml
---
name: skill-creator
description: Create new agent skills with proper structure and frontmatter
---

## What I do
Help you create a new skill by:
1. Asking what capability you want to add
2. Generating a SKILL.md with proper frontmatter
3. Creating optional scripts/, references/, assets/ directories

## Steps
1. Ask user what the skill should do
2. Generate a descriptive name (lowercase, hyphens)
3. Write clear description (helps agents know when to use it)
4. Create step-by-step instructions
5. Add examples if helpful
```

## File Structure After Implementation

```
packages/sdk/src/
├── skills/
│   ├── index.ts
│   ├── loader.ts
│   ├── parser.ts
│   ├── tool.ts
│   ├── types.ts
│   ├── validator.ts
│   └── builtin/
│       ├── skill-creator/SKILL.md
│       └── skill-installer/SKILL.md
└── index.ts              # Re-export skills

apps/cli/src/
└── commands/
    └── skills.ts         # CLI commands
```

## Testing Plan

1. **Unit tests:**
   - `tests/skills-parser.test.ts` - Frontmatter parsing, validation
   - `tests/skills-loader.test.ts` - Discovery from multiple paths, scope precedence
   - `tests/skills-tool.test.ts` - Tool invocation, error handling

2. **Integration tests:**
   - Create temp project with skills in multiple locations
   - Verify scope precedence (CWD overrides repo overrides user)
   - Verify cross-agent path compatibility
   - Test `agi skills add` from GitHub repo

## Compatibility Notes

- **Claude Code**: Full compatibility with `.claude/skills/` paths
- **OpenCode**: Full compatibility with `.opencode/skills/` paths  
- **Codex**: Full compatibility with `.codex/skills/` paths
- **Agent Skills Spec**: Follows agentskills.io specification
- **add-skill CLI**: Compatible with `npx add-skill` installed skills

## Timeline

| Phase | Effort | Description |
|-------|--------|-------------|
| 1 | 2 days | Core loader, parser, validator, tool |
| 2 | 1 day | CLI commands (list, add, show, create, validate) |
| 3 | 0.5 day | Permissions system |
| 4 | 0.5 day | Built-in skills (skill-creator, skill-installer) |

**Total: ~4 days**

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [OpenCode Skills Docs](https://opencode.ai/docs/skills)
- [Codex Skills Docs](https://developers.openai.com/codex/skills)
- [add-skill CLI](https://github.com/vercel-labs/add-skill)
- [Anthropic Skills Repo](https://github.com/anthropics/skills)
- [skills.sh Leaderboard](https://skills.sh)
