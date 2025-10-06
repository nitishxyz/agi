# Package Dependency Graph

## Current State (with Circular Dependencies)

```mermaid
graph TD
    prompts[prompts<br/>✅ No dependencies]
    
    providers[providers<br/>⚠️ Uses ProviderId type]
    auth[auth<br/>⚠️ Defines ProviderId]
    config[config<br/>⚠️ Uses both]
    
    database[database<br/>✅ Clean]
    core[core<br/>⚠️ Heavy]
    server[server<br/>⚠️ Heavy]
    sdk[sdk<br/>⚠️ Re-exports all]
    cli[cli<br/>✅ Simple]
    web[web<br/>✅ Isolated]
    webui[web-ui<br/>✅ Isolated]
    
    %% Circular dependency triangle
    auth -->|TYPE: ProviderId| providers
    providers -->|TYPE: ProviderId| auth
    config -->|RUNTIME| auth
    config -->|RUNTIME| providers
    auth -->|RUNTIME: paths| config
    
    %% Other dependencies
    database --> config
    core --> auth
    core --> config
    core --> database
    core --> providers
    core --> prompts
    
    server --> auth
    server --> config
    server --> core
    server --> database
    server --> providers
    server --> prompts
    
    sdk --> auth
    sdk --> config
    sdk --> core
    sdk --> database
    sdk --> providers
    sdk --> prompts
    sdk --> server
    
    cli --> sdk
    
    %% Styling
    classDef circular fill:#ff6b6b,stroke:#c92a2a,color:#fff
    classDef clean fill:#51cf66,stroke:#2f9e44,color:#fff
    classDef heavy fill:#ffd43b,stroke:#f59f00,color:#000
    
    class auth,providers,config circular
    class prompts,database,cli,web,webui clean
    class core,server,sdk heavy
```

## Proposed State (After Refactoring)

```mermaid
graph TD
    types[types<br/>✅ Zero dependencies<br/>Single source of truth]
    prompts[prompts<br/>✅ No dependencies]
    
    providers[providers<br/>✅ Clean]
    auth[auth<br/>✅ Clean]
    config[config<br/>✅ Clean]
    
    database[database<br/>✅ Clean]
    core[core<br/>⚠️ Heavy but clear]
    server[server<br/>⚠️ Heavy but clear]
    sdk[sdk<br/>✅ Clean facade]
    cli[cli<br/>✅ Simple]
    web[web<br/>✅ Isolated]
    webui[web-ui<br/>✅ Isolated]
    
    %% All flow from types down
    providers --> types
    auth --> types
    config --> types
    config --> auth
    config --> providers
    
    database --> config
    database --> types
    
    core --> auth
    core --> config
    core --> database
    core --> providers
    core --> prompts
    core --> types
    
    server --> auth
    server --> config
    server --> core
    server --> database
    server --> providers
    server --> prompts
    server --> types
    
    sdk --> auth
    sdk --> config
    sdk --> core
    sdk --> database
    sdk --> providers
    sdk --> prompts
    sdk --> server
    sdk --> types
    
    cli --> sdk
    
    %% Styling
    classDef foundation fill:#4dabf7,stroke:#1971c2,color:#fff
    classDef clean fill:#51cf66,stroke:#2f9e44,color:#fff
    classDef heavy fill:#ffd43b,stroke:#f59f00,color:#000
    
    class types foundation
    class prompts,database,providers,auth,config,cli,web,webui,sdk clean
    class core,server heavy
```

## Dependency Levels

### Level 0: Foundation (No Dependencies)
- **types** - Shared TypeScript types and interfaces
- **prompts** - Static prompt templates

### Level 1: Utilities (Depend on Foundation)
- **providers** - Provider catalog and utilities
- **config** - Configuration management
- **auth** - Authentication and credentials

### Level 2: Infrastructure (Depend on L0 + L1)
- **database** - Database schema and connection

### Level 3: Core Logic (Depend on L0 + L1 + L2)
- **core** - Core AI functionality, tools, streaming

### Level 4: Service Layer (Depend on L0-L3)
- **server** - HTTP API routes and handlers

### Level 5: Public API (Depend on everything)
- **sdk** - Unified SDK re-exporting all functionality

### Level 6: Applications (Depend on SDK)
- **cli** - Command-line interface
- **web** - Web application (separate from SDK)
- **web-ui** - Embeddable UI components

## Import Rules

### ✅ Allowed
- Lower level → Higher level imports
- Type-only imports from same level (with caution)
- External packages (ai, hono, drizzle, etc.)

### ❌ Forbidden
- Higher level → Lower level imports
- Runtime circular dependencies
- Cross-level sibling imports (go through lower level instead)

### Example
```typescript
// ✅ Good: Lower to higher
import { loadConfig } from '@agi-cli/config';  // In core package

// ✅ Good: Type from foundation
import type { ProviderId } from '@agi-cli/types';  // In any package

// ❌ Bad: Circular
import type { ProviderId } from '@agi-cli/auth';  // In providers package

// ❌ Bad: Higher to lower
import { discoverTools } from '@agi-cli/core';  // In config package
```

## Migration Checklist

- [ ] Create `packages/types` package
- [ ] Move `ProviderId` type to types package
- [ ] Move `AuthInfo`, `OAuth` types to types package  
- [ ] Move `AGIConfig`, `ProviderConfig` types to types package
- [ ] Update all imports in auth package
- [ ] Update all imports in providers package
- [ ] Update all imports in config package
- [ ] Update all imports in core package
- [ ] Update all imports in server package
- [ ] Update all imports in sdk package
- [ ] Run full test suite
- [ ] Add madge to CI pipeline
- [ ] Document architecture decisions

## Verification Commands

```bash
# Install madge
bun add -D madge

# Check for circular dependencies
bunx madge --circular --extensions ts packages/

# Generate visual graph
bunx madge --image graph.svg --extensions ts packages/

# List all dependencies
bunx madge --list --extensions ts packages/
```
