# Git Implementation Rework - Executive Summary

## 🎯 Objective

Rework the git integration to provide:
1. **Full file paths** - No truncation in UI
2. **New file content** - Show full content for untracked files
3. **Consistent handling** - Uniform treatment of staged/unstaged/new files
4. **Clean architecture** - Clear separation of concerns

## 🔴 Current Issues

### 1. Path Truncation
```typescript
// Current: "../../dir/file.tsx" - loses context
// Wanted: "packages/web-sdk/src/components/git/file.tsx"
```

### 2. New Files No Diff
```typescript
// Current: git diff returns empty for new files
// Wanted: Show full file content as "new file" view
```

### 3. Inconsistent Status
- Untracked files treated differently
- No clear indication of "new" vs "modified"
- Git root path not exposed

## ✅ Proposed Solution

### Backend Changes

**1. Enhanced `/v1/git/status`**
```typescript
{
  gitRoot: "/path/to/repo",     // NEW
  workingDir: "/path/to/cwd",   // NEW
  staged: [{
    path: "src/file.ts",         // Relative to git root
    absPath: "/full/path",       // NEW
    isNew: false                 // NEW
  }]
}
```

**2. Enhanced `/v1/git/diff`**
```typescript
{
  file: "src/new-file.ts",
  isNewFile: true,               // NEW
  content: "full file content",  // NEW (for new files)
  diff: "",                      // Empty for new files
  staged: false                  // NEW
}
```

### Frontend Changes

**1. Remove Path Truncation**
```typescript
// Before
const displayPath = formatFilePath(file.path); // Truncated

// After  
const displayPath = file.path; // Full path from git root
```

**2. New File Viewer**
```typescript
if (diff.isNewFile && diff.content) {
  return <SyntaxHighlighter>{diff.content}</SyntaxHighlighter>;
}
```

## 📦 Affected Packages

| Package | Changes |
|---------|---------|
| **@agi-cli/server** | Enhanced git routes with full paths & new file content |
| **@agi-cli/sdk** | Updated git tools with `detailed` & `file` params |
| **@agi-cli/api** | Regenerated client from updated OpenAPI schema |
| **@agi-cli/web-sdk** | Remove truncation, new file viewer, updated types |
| **apps/web** | No changes (uses web-sdk components) |

## 🗓️ Implementation Plan

### Phase 1: Backend (Days 1-3)
- ✅ Update server routes
- ✅ Add new file detection
- ✅ Enhance response schemas
- ✅ Add tests

### Phase 2: API & SDK (Days 4-5)
- ✅ Update OpenAPI schema
- ✅ Regenerate API client
- ✅ Update SDK tools
- ✅ Add tests

### Phase 3: UI (Days 6-8)
- ✅ Update types
- ✅ Remove truncation
- ✅ Add new file viewer
- ✅ Better file organization

### Phase 4: Testing (Days 9-10)
- ✅ Integration tests
- ✅ Manual testing
- ✅ Documentation

## 🧪 Testing Strategy

**Unit Tests:**
- Server: Status returns full paths, diff handles new files
- SDK: Tools return enhanced data
- UI: Components show full paths, new file content

**Integration Tests:**
1. New file → Stage → View content → Commit
2. Modified file → View diff → Stage → Commit
3. Mixed changes → Selective staging → Commit

**Manual Tests:**
- All file types display correctly
- Paths are never truncated
- New files show content
- Stage/unstage works

## ⚠️ Breaking Changes

**API Schema:**
- `GitFile` requires `absPath` and `isNew`
- `GitStatus` includes `gitRoot` and `workingDir`
- `GitDiff` includes `isNewFile`, `content`, and `staged`

**Mitigation:**
- Update OpenAPI spec → regenerate client
- Update web-sdk types
- No changes to SDK tool interfaces (backward compatible)

## 📊 Success Metrics

- ✅ Zero path truncation in UI
- ✅ 100% file type coverage (new/modified/deleted/renamed)
- ✅ Test coverage > 80%
- ✅ Zero path-related bugs

## 🚀 Quick Start (For Implementers)

### 1. Server Changes
```bash
cd packages/server
# Edit src/routes/git.ts
# Add checkIfNewFile(), update diff endpoint
bun test
```

### 2. API Changes
```bash
cd packages/api
# Edit openapi.json (GitFile, GitStatus, GitDiff schemas)
bun run generate
```

### 3. Web SDK Changes
```bash
cd packages/web-sdk
# Edit components/git/GitFileItem.tsx (remove truncation)
# Edit components/git/GitDiffViewer.tsx (add new file view)
# Update types/api.ts
bun test
```

### 4. Verify
```bash
# Start server
bun dev

# Test scenarios:
# 1. Create new file → should show in untracked
# 2. Click file → should show full content
# 3. Stage file → should work
# 4. View diff → should show content
```

## 📚 Documentation

- **Full Plan**: `docs/git-implementation-rework-plan.md`
- **API Docs**: Update `docs/api.md` with new schemas
- **Web SDK**: Update `packages/web-sdk/README.md`
- **Migration Guide**: Included in full plan

## 🔗 Related Documents

- [Full Implementation Plan](./git-implementation-rework-plan.md)
- [API Documentation](./api.md)
- [Architecture Overview](./architecture.md)

---

**Status**: 📋 Ready for Implementation  
**Estimated Effort**: 10 days  
**Priority**: High  
**Last Updated**: 2024-01-XX
