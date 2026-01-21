# Skills Feature Plan

## Overview

Skills are reusable markdown instructions that agents can discover and load on-demand. They extend agent capabilities without modifying core code.

## How Skills Work

```
.agi/skills/
├── git-release/
│   └── SKILL.md          # Instructions for creating releases
├── pr-review/
│   └── SKILL.md          # PR review guidelines
│   └── checklist.md      # Supporting file
└── api-conventions/
    └── SKILL.md          # API design patterns
```

**Flow:**
1. Agent sees skill names + descriptions in system prompt
2. Agent decides when a skill is relevant
3. Agent calls `skill({ name: "git-release" })` tool
4. Full skill content loads into context
5. Agent follows the instructions

## SKILL.md Format

```yaml
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
---

## What I do
- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me
Use this when preparing a tagged release.
```

**Frontmatter fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Lowercase alphanumeric with hyphens, max 64 chars |
| `description` | Yes | 1-1024 chars, helps agent decide when to use |
| `license` | No | License identifier |
| `disable-model-invocation` | No | If true, only user can invoke via `/name` |
| `allowed-tools` | No | Restrict tools when skill is active |

## Discovery Paths

Search order (later overrides earlier):
1. `~/.config/agi/skills/<name>/SKILL.md` (global)
2. `.agi/skills/<name>/SKILL.md` (project)
3. Walk up from cwd to git root for nested `.agi/skills/`

## Implementation Plan

### Phase 1: Core Skill Loader

**Files to create:**
```
packages/sdk/src/core/src/skills/
├── index.ts              # Re-exports
├── loader.ts             # discoverSkills() function
├── parser.ts             # Parse SKILL.md frontmatter + content
├── types.ts              # SkillDefinition, SkillMetadata types
└── tool.ts               # Built-in "skill" tool
```

**`packages/sdk/src/core/src/skills/types.ts`:**
```typescript
export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  disableModelInvocation?: boolean;
  allowedTools?: string[];
}

export interface SkillDefinition {
  metadata: SkillMetadata;
  content: string;
  path: string;
  source: 'global' | 'project';
}

export interface DiscoveredSkill {
  name: string;
  description: string;
  path: string;
}
```

**`packages/sdk/src/core/src/skills/parser.ts`:**
```typescript
import { parse as parseYaml } from 'yaml';
import type { SkillDefinition, SkillMetadata } from './types';

export function parseSkillFile(content: string, path: string, source: 'global' | 'project'): SkillDefinition {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    throw new Error(`Invalid SKILL.md format: missing frontmatter in ${path}`);
  }
  
  const [, yamlStr, body] = frontmatterMatch;
  const metadata = parseYaml(yamlStr) as SkillMetadata;
  
  validateMetadata(metadata, path);
  
  return {
    metadata,
    content: body.trim(),
    path,
    source,
  };
}

function validateMetadata(meta: SkillMetadata, path: string): void {
  if (!meta.name || typeof meta.name !== 'string') {
    throw new Error(`Skill at ${path} missing required 'name' field`);
  }
  if (!meta.description || typeof meta.description !== 'string') {
    throw new Error(`Skill at ${path} missing required 'description' field`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.name)) {
    throw new Error(`Invalid skill name '${meta.name}' - must be lowercase alphanumeric with hyphens`);
  }
  if (meta.name.length > 64) {
    throw new Error(`Skill name too long: ${meta.name.length} > 64`);
  }
  if (meta.description.length > 1024) {
    throw new Error(`Skill description too long: ${meta.description.length} > 1024`);
  }
}
```

**`packages/sdk/src/core/src/skills/loader.ts`:**
```typescript
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import fg from 'fast-glob';
import { parseSkillFile } from './parser';
import type { SkillDefinition, DiscoveredSkill } from './types';
import { getGlobalConfigDir } from '../../../config/src/paths';

const skillCache = new Map<string, SkillDefinition>();

export async function discoverSkills(projectRoot: string): Promise<DiscoveredSkill[]> {
  const skills = new Map<string, SkillDefinition>();
  
  // 1. Load global skills
  const globalDir = join(getGlobalConfigDir(), 'skills');
  await loadSkillsFromDir(globalDir, 'global', skills);
  
  // 2. Load project skills (override global)
  const projectDir = join(projectRoot, '.agi', 'skills');
  await loadSkillsFromDir(projectDir, 'project', skills);
  
  // Cache for later retrieval
  skillCache.clear();
  for (const [name, def] of skills) {
    skillCache.set(name, def);
  }
  
  return Array.from(skills.values()).map(s => ({
    name: s.metadata.name,
    description: s.metadata.description,
    path: s.path,
  }));
}

export async function loadSkill(name: string): Promise<SkillDefinition | null> {
  return skillCache.get(name) ?? null;
}

async function loadSkillsFromDir(
  dir: string,
  source: 'global' | 'project',
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
      const skill = parseSkillFile(content, filePath, source);
      skills.set(skill.metadata.name, skill);
    } catch (err) {
      if (process.env.AGI_DEBUG === '1') {
        console.error(`Failed to load skill from ${filePath}:`, err);
      }
    }
  }
}
```

**`packages/sdk/src/core/src/skills/tool.ts`:**
```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { loadSkill, discoverSkills } from './loader';
import type { DiscoveredSkill } from './types';

let cachedSkillList: DiscoveredSkill[] = [];

export function buildSkillTool(projectRoot: string) {
  return {
    name: 'skill',
    tool: tool({
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
          content: skill.content,
        };
      },
    }),
  };
}

export async function initializeSkillTool(projectRoot: string): Promise<void> {
  cachedSkillList = await discoverSkills(projectRoot);
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

### Phase 2: Integration with Tool Loader

**Modify `packages/sdk/src/core/src/tools/loader.ts`:**

```typescript
// Add import
import { buildSkillTool, initializeSkillTool } from '../skills/tool';

// In discoverProjectTools(), after other tools:
export async function discoverProjectTools(
  projectRoot: string,
  globalConfigDir?: string,
): Promise<DiscoveredTool[]> {
  // ... existing code ...
  
  // Initialize and add skill tool
  await initializeSkillTool(projectRoot);
  const skillTool = buildSkillTool(projectRoot);
  tools.set(skillTool.name, skillTool.tool);
  
  // ... rest of function ...
}
```

### Phase 3: Permissions

**Add to config schema:**
```typescript
interface SkillPermissions {
  [pattern: string]: 'allow' | 'deny' | 'ask';
}

interface AGIConfig {
  // ... existing fields ...
  permissions?: {
    skill?: SkillPermissions;
  };
}
```

**Default permissions:**
```json
{
  "permissions": {
    "skill": {
      "*": "allow"
    }
  }
}
```

### Phase 4: CLI Commands

**Add `agi skills` command:**
```
agi skills list              # List all discovered skills
agi skills show <name>       # Show skill content
agi skills create <name>     # Scaffold new skill
```

## File Structure After Implementation

```
packages/sdk/src/
├── core/src/
│   ├── skills/
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   ├── parser.ts
│   │   ├── tool.ts
│   │   └── types.ts
│   ├── tools/
│   │   └── loader.ts       # Modified to include skill tool
│   └── index.ts            # Add skill exports
└── index.ts                # Re-export from core

apps/cli/src/
└── skills.ts               # CLI commands
```

## Testing Plan

1. **Unit tests:**
   - `tests/skills-parser.test.ts` - Frontmatter parsing
   - `tests/skills-loader.test.ts` - Discovery from paths
   - `tests/skills-tool.test.ts` - Tool invocation

2. **Integration tests:**
   - Create temp project with skills
   - Verify discovery order (project overrides global)
   - Verify skill tool appears in tool list

## Migration Notes

- Compatible with Claude Code's `.claude/skills/` path
- Also supports `.agi/skills/` for AGI-specific skills
- Same YAML frontmatter format as OpenCode

## Timeline

| Phase | Effort | Description |
|-------|--------|-------------|
| 1 | 2 days | Core loader + parser + tool |
| 2 | 0.5 day | Integration with existing loader |
| 3 | 1 day | Permissions system |
| 4 | 0.5 day | CLI commands |

**Total: ~4 days**
