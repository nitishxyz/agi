# Package Restructuring Plan

**Date:** 2025-10-07  
**Goal:** Make SDK runtime-agnostic by consolidating packages and removing Bun dependencies

## Overview

Restructure the AGI monorepo to:
1. Keep `database` and `server` as standalone Bun-specific packages
2. Move all other packages into the SDK as internal modules
3. Replace Bun-specific APIs with Node.js equivalents for runtime agnosticism
4. Update all imports across the project

## Current State

### Package Structure
```
packages/
├── auth/           # Authentication & credentials
├── config/         # Configuration management
├── core/           # Core AI functions & tools (HAS BUN DEPS)
├── database/       # SQLite + Drizzle (BUN SPECIFIC)
├── install/        # Installation utilities
├── prompts/        # System prompts
├── providers/      # AI provider catalog
├── sdk/            # Main SDK (re-exports all)
├── server/         # HTTP server (BUN SPECIFIC)
├── types/          # Shared TypeScript types
└── web-ui/         # Web UI components
```

### Bun-Specific Code Locations

**In `core` package:**
- `core/src/tools/builtin/fs/tree.ts` - `spawn from 'bun'`
- `core/src/tools/builtin/fs/ls.ts` - `spawn from 'bun'`
- `core/src/tools/builtin/fs/write.ts` - `$ from 'bun'`
- `core/src/tools/builtin/git.ts` - `$ from 'bun'`
- `core/src/tools/builtin/patch.ts` - `$ from 'bun'`
- `core/src/tools/builtin/ripgrep.ts` - `$ from 'bun'`
- `core/src/tools/builtin/glob.ts` - `$ from 'bun'`
- `core/src/tools/builtin/bash.ts` - `spawn from 'bun'`
- `core/src/tools/loader.ts` - `Glob from 'bun'`

**In `database` package:**
- `database/src/index.ts` - `Database from 'bun:sqlite'` (STAYS BUN-SPECIFIC)

## Target State

### New Package Structure
```
packages/
├── database/       # Bun-specific (SQLite + Drizzle)
├── install/        # Installation utilities
├── sdk/            # Main SDK (runtime-agnostic)
│   ├── src/
│   │   ├── auth/        # Moved from packages/auth
│   │   ├── config/      # Moved from packages/config
│   │   ├── core/        # Moved from packages/core
│   │   ├── prompts/     # Moved from packages/prompts
│   │   ├── providers/   # Moved from packages/providers
│   │   ├── types/       # Moved from packages/types
│   │   └── index.ts     # Main exports
├── server/         # Bun-specific (Hono server)
└── web-ui/         # Web UI components
```

## Implementation Phases

### Phase 1: Replace Bun APIs with Node.js Equivalents

**Bun API → Node.js Replacement:**
- `spawn from 'bun'` → `spawn from 'node:child_process'`
- `$ from 'bun'` → Custom exec wrapper using `node:child_process`
- `Glob from 'bun'` → `fast-glob` npm package

**Files to Update:**
1. Create utility wrapper for shell execution: `core/src/utils/exec.ts`
2. Update all tool files to use Node.js APIs:
   - `core/src/tools/builtin/fs/tree.ts`
   - `core/src/tools/builtin/fs/ls.ts`
   - `core/src/tools/builtin/fs/write.ts`
   - `core/src/tools/builtin/git.ts`
   - `core/src/tools/builtin/patch.ts`
   - `core/src/tools/builtin/ripgrep.ts`
   - `core/src/tools/builtin/glob.ts`
   - `core/src/tools/builtin/bash.ts`
   - `core/src/tools/loader.ts`

**Dependencies to Add:**
```json
{
  "dependencies": {
    "fast-glob": "^3.3.2"
  }
}
```

### Phase 2: Move Packages into SDK

**Migration Steps:**

1. **Move package directories:**
   ```bash
   mv packages/auth packages/sdk/src/auth
   mv packages/config packages/sdk/src/config
   mv packages/core packages/sdk/src/core
   mv packages/prompts packages/sdk/src/prompts
   mv packages/providers packages/sdk/src/providers
   mv packages/types packages/sdk/src/types
   ```

2. **Update internal imports:**
   - Change from `@agi-cli/types` → `../types`
   - Change from `@agi-cli/config` → `../config`
   - etc. (all internal SDK imports use relative paths)

3. **Keep workspace imports for external packages:**
   - `@agi-cli/database` (stays as workspace package)
   - `@agi-cli/server` (stays as workspace package)

### Phase 3: Update SDK Structure

**Update `packages/sdk/package.json`:**
- Remove workspace dependencies for moved packages
- Keep only `@agi-cli/database` if needed (optional, for types only)
- Add Node.js dependencies (child_process, fs, path are built-in)
- Add `fast-glob` dependency

**Update `packages/sdk/src/index.ts`:**
- Change imports from `@agi-cli/xxx` to relative imports
- Remove server and database exports
- Keep clean public API

**New SDK exports structure:**
```typescript
// From internal modules (relative imports)
export * from './types';
export * from './providers';
export * from './auth';
export * from './config';
export * from './prompts';
export * from './core';

// Database and Server are now external packages
// Users import them directly:
// import { getDb } from '@agi-cli/database';
// import { createApp } from '@agi-cli/server';
```

### Phase 4: Update Dependent Packages

**Update `packages/server/`:**
- Change `@agi-cli/auth` → `@agi-cli/sdk`
- Change `@agi-cli/config` → `@agi-cli/sdk`
- Change `@agi-cli/core` → `@agi-cli/sdk`
- Change `@agi-cli/prompts` → `@agi-cli/sdk`
- Change `@agi-cli/providers` → `@agi-cli/sdk`
- Keep `@agi-cli/database` as is

**Update `packages/database/`:**
- Change `@agi-cli/config` → `@agi-cli/sdk`

**Update `apps/cli/`:**
- Update imports to use `@agi-cli/sdk` instead of individual packages
- Keep `@agi-cli/database` and `@agi-cli/server` as separate

### Phase 5: Cleanup

1. **Remove old package.json files:**
   - Delete `packages/sdk/src/auth/package.json`
   - Delete `packages/sdk/src/config/package.json`
   - Delete `packages/sdk/src/core/package.json`
   - Delete `packages/sdk/src/prompts/package.json`
   - Delete `packages/sdk/src/providers/package.json`
   - Delete `packages/sdk/src/types/package.json`

2. **Update workspace root `package.json`:**
   - Remove deleted packages from workspace
   - Keep only: sdk, database, server, install, web-ui

3. **Update documentation:**
   - `docs/architecture.md`
   - `docs/sdk-architecture.md`
   - `docs/dependency-graph.md`
   - `AGENTS.md`
   - Root `README.md`

4. **Update lockfile:**
   ```bash
   bun install
   ```

## Migration Checklist

- [ ] Phase 1: Replace Bun APIs with Node.js equivalents
  - [ ] Add fast-glob dependency to core
  - [ ] Create exec utility wrapper
  - [ ] Update all tool files
  - [ ] Test tools still work
  
- [ ] Phase 2: Move packages into SDK
  - [ ] Move auth → sdk/src/auth
  - [ ] Move config → sdk/src/config
  - [ ] Move core → sdk/src/core
  - [ ] Move prompts → sdk/src/prompts
  - [ ] Move providers → sdk/src/providers
  - [ ] Move types → sdk/src/types
  - [ ] Update internal imports to relative paths
  
- [ ] Phase 3: Update SDK structure
  - [ ] Update sdk/package.json dependencies
  - [ ] Update sdk/src/index.ts exports
  - [ ] Remove database & server exports
  
- [ ] Phase 4: Update dependent packages
  - [ ] Update server package imports
  - [ ] Update database package imports
  - [ ] Update CLI app imports
  
- [ ] Phase 5: Cleanup
  - [ ] Remove old package.json files
  - [ ] Update workspace configuration
  - [ ] Update documentation
  - [ ] Run bun install
  - [ ] Test everything

## Benefits

1. **Runtime Agnostic SDK:** Can run on Node.js, Deno, or any JS runtime
2. **Simpler Structure:** Fewer top-level packages to manage
3. **Clear Separation:** Bun-specific (database, server) vs runtime-agnostic (sdk)
4. **Better DX:** Single import point for core functionality
5. **Easier Maintenance:** Related code lives together

## Risks & Mitigation

**Risk:** Breaking changes for external consumers  
**Mitigation:** Version bump to 0.2.0, clear migration guide

**Risk:** Import path changes break existing code  
**Mitigation:** Update all internal code in same PR, test thoroughly

**Risk:** Performance differences between Bun and Node APIs  
**Mitigation:** Benchmark critical paths, optimize if needed

## Testing Strategy

1. **Unit Tests:** Run all existing tests after each phase
2. **Integration Tests:** Test CLI commands end-to-end
3. **Type Checking:** Ensure no TypeScript errors
4. **Manual Testing:** Test server, database, and core functionality

## Rollback Plan

If critical issues arise:
1. Revert the restructuring commit
2. Or: Keep old packages temporarily with deprecation warnings
3. Provide compatibility layer for gradual migration
