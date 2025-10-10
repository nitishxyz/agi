# Git Rework Implementation Checklist

## 📋 Phase 1: Backend Foundation

### Server Routes (`packages/server/src/routes/git.ts`)

- [ ] **Add helper function**: `checkIfNewFile(gitRoot, file)`
  - Use `git ls-files --error-unmatch <file>` to check if file exists in git
  - Return `true` if file is new/untracked

- [ ] **Update `parseGitStatus()` function**
  - [ ] Calculate absolute paths: `path.join(gitRoot, filePath)`
  - [ ] Add `absPath` field to returned files
  - [ ] Add `isNew` field (true for untracked or newly added)
  - [ ] Keep `oldPath` for renamed files

- [ ] **Update `/v1/git/status` endpoint**
  - [ ] Add `gitRoot` to response
  - [ ] Add `workingDir` (current working directory)
  - [ ] Ensure all files have `absPath` and `isNew`

- [ ] **Update `/v1/git/diff` endpoint**
  - [ ] Add `staged` to response
  - [ ] Add `absPath` to response
  - [ ] Check if file is new with `checkIfNewFile()`
  - [ ] For new files:
    - [ ] Read file content with `fs.readFile()`
    - [ ] Return `content` field
    - [ ] Set `isNewFile: true`
    - [ ] Set `diff: ""`
    - [ ] Set `insertions` to line count
  - [ ] For existing files:
    - [ ] Use existing diff logic
    - [ ] Set `isNewFile: false`
    - [ ] Set `content: undefined`

- [ ] **Add tests** (`packages/server/src/routes/git.test.ts`)
  - [ ] Test status returns full paths
  - [ ] Test status includes gitRoot and workingDir
  - [ ] Test diff returns content for new files
  - [ ] Test diff returns diff for modified files
  - [ ] Test diff handles binary files

---

## 📋 Phase 2: API & SDK

### OpenAPI Schema (`packages/api/openapi.json`)

- [ ] **Update `GitFile` schema**
  ```json
  {
    "path": { "type": "string" },
    "absPath": { "type": "string" },
    "status": { "enum": [...] },
    "staged": { "type": "boolean" },
    "isNew": { "type": "boolean" },
    "oldPath": { "type": "string" }
  }
  ```
  - [ ] Add `absPath` (required)
  - [ ] Add `isNew` (required)
  - [ ] Keep `oldPath` (optional, for renames)

- [ ] **Update `GitStatus` schema**
  ```json
  {
    "gitRoot": { "type": "string" },
    "workingDir": { "type": "string" },
    // ... existing fields
  }
  ```
  - [ ] Add `gitRoot` (required)
  - [ ] Add `workingDir` (required)

- [ ] **Update `GitDiff` schema**
  ```json
  {
    "file": { "type": "string" },
    "absPath": { "type": "string" },
    "diff": { "type": "string" },
    "content": { "type": "string" },
    "isNewFile": { "type": "boolean" },
    "staged": { "type": "boolean" },
    // ... existing fields
  }
  ```
  - [ ] Add `absPath` (required)
  - [ ] Add `content` (optional)
  - [ ] Add `isNewFile` (required)
  - [ ] Add `staged` (required)

- [ ] **Regenerate API client**
  ```bash
  cd packages/api
  bun run generate
  ```

### SDK Tools (`packages/sdk/src/core/src/tools/builtin/git.ts`)

- [ ] **Update `git_status` tool** (optional enhancement)
  - [ ] Add `detailed` parameter
  - [ ] Return structured file data when `detailed: true`
  - [ ] Include gitRoot in response
  - [ ] Keep backward compatibility (default behavior unchanged)

- [ ] **Update `git_diff` tool** (optional enhancement)
  - [ ] Add `file` parameter for single file diffs
  - [ ] Add `checkIfNewFile()` helper
  - [ ] For new files: read content with `fs.readFile()`
  - [ ] For existing files: use git diff
  - [ ] Keep backward compatibility

- [ ] **Add tests** (`packages/sdk/tests/git-tools.test.ts`)
  - [ ] Test git_status returns full paths when detailed
  - [ ] Test git_diff with file param returns content for new files
  - [ ] Test git_diff without params returns unified diff

---

## 📋 Phase 3: Web SDK UI

### Type Definitions (`packages/web-sdk/src/types/api.ts`)

- [ ] **Update `GitFileStatus` interface**
  ```typescript
  export interface GitFileStatus {
    path: string;
    absPath: string;        // NEW
    status: ...;
    staged: boolean;
    isNew: boolean;         // NEW
    oldPath?: string;
    insertions?: number;
    deletions?: number;
  }
  ```

- [ ] **Update `GitStatusResponse` interface**
  ```typescript
  export interface GitStatusResponse {
    branch: string;
    gitRoot: string;        // NEW
    workingDir: string;     // NEW
    // ... rest
  }
  ```

- [ ] **Update `GitDiffResponse` interface**
  ```typescript
  export interface GitDiffResponse {
    file: string;
    absPath: string;        // NEW
    diff: string;
    content?: string;       // NEW
    isNewFile: boolean;     // NEW
    staged: boolean;        // NEW
    // ... rest
  }
  ```

### Components

#### GitFileItem (`packages/web-sdk/src/components/git/GitFileItem.tsx`)

- [ ] **Remove path truncation**
  - [ ] Delete `formatFilePath()` function (lines 90-104)
  - [ ] Use `file.path` directly: `const displayPath = file.path;`
  - [ ] Update title to show `file.absPath` on hover
  - [ ] Remove truncation from className (allow full width)

#### GitDiffPanel (`packages/web-sdk/src/components/git/GitDiffPanel.tsx`)

- [ ] **Remove path truncation**
  - [ ] Delete `formatFilePath()` function (lines 65-84)
  - [ ] Use `selectedFile` directly: `const displayPath = selectedFile;`
  - [ ] Update title to show `diff?.absPath` on hover

#### GitDiffViewer (`packages/web-sdk/src/components/git/GitDiffViewer.tsx`)

- [ ] **Add new file handling**
  ```typescript
  if (diff.isNewFile && diff.content) {
    return (
      <div className="p-4">
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            New file: {diff.insertions} lines
          </p>
        </div>
        <SyntaxHighlighter
          language={diff.language}
          style={vscDarkPlus}
          showLineNumbers
        >
          {diff.content}
        </SyntaxHighlighter>
      </div>
    );
  }
  ```

- [ ] **Add binary file handling** (if not exists)
  ```typescript
  if (diff.isBinary) {
    return (
      <div className="p-4">
        <div className="p-3 bg-muted border border-border rounded">
          <p className="text-sm text-muted-foreground">
            Binary file - cannot display diff
          </p>
        </div>
      </div>
    );
  }
  ```

#### GitFileList (`packages/web-sdk/src/components/git/GitFileList.tsx`)

- [ ] **Improve organization** (optional)
  - [ ] Add section headers: "Staged Changes", "Changes", "Untracked Files"
  - [ ] Show counts in headers
  - [ ] Add empty state message

### API Client (`packages/web-sdk/src/lib/api-client.ts`)

- [ ] **Verify methods match new response types**
  - [ ] `getGitStatus()` returns new `GitStatusResponse`
  - [ ] `getGitDiff()` returns new `GitDiffResponse`
  - [ ] Type assertions updated if needed

- [ ] **Add tests**
  - [ ] Test GitFileItem shows full path
  - [ ] Test GitDiffViewer handles new files
  - [ ] Test GitDiffViewer handles modified files
  - [ ] Test GitDiffViewer handles binary files

---

## 📋 Phase 4: Testing & Validation

### Unit Tests

- [ ] **Server tests** (`packages/server/src/routes/git.test.ts`)
  - [ ] Status endpoint returns full paths from git root
  - [ ] Status endpoint includes gitRoot and workingDir
  - [ ] Diff endpoint returns content for new files
  - [ ] Diff endpoint returns diff for modified files
  - [ ] Diff endpoint handles binary files correctly
  - [ ] Stage/unstage works with full paths
  - [ ] Renamed files include oldPath

- [ ] **SDK tests** (`packages/sdk/tests/git-tools.test.ts`)
  - [ ] git_status returns full paths when detailed
  - [ ] git_diff with file param returns content for new files
  - [ ] git_diff without params returns unified diff

- [ ] **Web SDK tests**
  - [ ] GitFileItem displays full paths without truncation
  - [ ] GitDiffViewer shows content for new files
  - [ ] GitDiffViewer shows diff for modified files
  - [ ] GitDiffPanel displays full path in header

### Integration Tests

- [ ] **Scenario 1: New File Workflow**
  1. Create new file in git repo
  2. Check it appears in untracked section
  3. Click to view - should show full content
  4. Stage file - should work
  5. View diff - should still show content
  6. Commit - should succeed

- [ ] **Scenario 2: Modified File Workflow**
  1. Modify existing file
  2. Check it appears in unstaged section
  3. Click to view - should show diff
  4. Stage file - should work
  5. Commit - should succeed

- [ ] **Scenario 3: Deleted File Workflow**
  1. Delete file
  2. Check it appears in unstaged section
  3. Click to view - should show deletion diff
  4. Stage file - should work
  5. Commit - should succeed

- [ ] **Scenario 4: Renamed File Workflow**
  1. Rename file
  2. Check it appears with both old and new paths
  3. Stage file - should work
  4. Commit - should succeed

- [ ] **Scenario 5: Mixed Changes**
  1. Create new file, modify existing, delete another
  2. All appear in correct sections
  3. Stage selectively
  4. View diffs for each type
  5. Commit - should succeed

### Manual Testing Checklist

- [ ] Full file paths visible in sidebar (no truncation)
- [ ] New files show full content in diff viewer
- [ ] Modified files show unified diff
- [ ] Deleted files show deletion diff
- [ ] Renamed files show both old and new paths
- [ ] Binary files show appropriate message
- [ ] Stage/unstage works for all file types
- [ ] Commit message generation includes all file types
- [ ] Git sidebar refreshes correctly after operations
- [ ] Keyboard shortcuts work (ESC to close diff)
- [ ] Hover shows absolute paths in tooltips
- [ ] Long paths don't break layout (use truncate-text CSS if needed)
- [ ] Performance is acceptable with many files

---

## 📋 Phase 5: Documentation

- [ ] **Update API docs** (`docs/api.md`)
  - [ ] Add Git API section
  - [ ] Document `/v1/git/status` with new schema
  - [ ] Document `/v1/git/diff` with new schema
  - [ ] Include example requests/responses

- [ ] **Update Web SDK README** (`packages/web-sdk/README.md`)
  - [ ] Document git components
  - [ ] Show usage examples
  - [ ] Note path handling behavior

- [ ] **Update main README** (if needed)
  - [ ] Mention improved git integration
  - [ ] Link to detailed docs

- [ ] **Add migration guide** (included in plan doc)
  - [ ] Breaking changes section
  - [ ] Before/after examples
  - [ ] Update steps for consumers

---

## 📋 Final Verification

- [ ] **All tests passing**
  ```bash
  bun test
  ```

- [ ] **Build successful**
  ```bash
  bun run build
  ```

- [ ] **Linting clean**
  ```bash
  bun run lint
  ```

- [ ] **Type checking**
  ```bash
  bun run typecheck
  ```

- [ ] **Manual smoke test**
  - Start dev server
  - Test all git workflows
  - Verify UI behaves correctly

- [ ] **Code review**
  - Get review from team
  - Address feedback
  - Update docs if needed

- [ ] **Merge to main**
  - Squash commits or keep history clean
  - Update version numbers if needed
  - Deploy to staging/production

---

## ✅ Completion Criteria

- ✅ Zero path truncation in UI
- ✅ New files show full content
- ✅ All file types (new/modified/deleted/renamed) work correctly
- ✅ All tests passing (>80% coverage)
- ✅ Documentation updated
- ✅ No regressions in existing functionality
- ✅ Code reviewed and approved

---

**Total Estimated Time**: 10 days  
**Priority**: High  
**Status**: Ready to Start
