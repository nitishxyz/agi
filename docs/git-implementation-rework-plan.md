# Git Implementation Rework Plan

## Executive Summary

This document outlines a comprehensive plan to rework the git integration across the AGI CLI project. The current implementation has several issues:

1. **Path truncation** - File paths are being shortened/truncated in the UI, losing context
2. **Incomplete file tracking** - New/untracked files don't show content or diffs properly
3. **Inconsistent status handling** - Staged, unstaged, and untracked files are not handled uniformly
4. **Missing diff support** - Newly created files don't show their full content as a "diff"

## Current State Analysis

### Components Involved

#### 1. **SDK Tools** (`packages/sdk/src/core/src/tools/builtin/git.ts`)
- **git_status**: Returns porcelain v1 format, limited to 200 lines
- **git_diff**: Shows staged or all changes, limited to 5000 lines
- **git_commit**: Commits with message
- Issues:
  - Uses porcelain format but doesn't expose full file paths
  - No diff content for individual files
  - Doesn't handle new/untracked files in diffs

#### 2. **Server API** (`packages/server/src/routes/git.ts`)
Endpoints:
- `GET /v1/git/status` - Returns structured status with file lists
- `GET /v1/git/diff` - Gets diff for a single file (staged or unstaged)
- `POST /v1/git/stage` - Stage files
- `POST /v1/git/unstage` - Unstage files
- `POST /v1/git/commit` - Commit changes
- `POST /v1/git/generate-commit-message` - AI-generated commit message
- `GET /v1/git/branch` - Branch info
- `POST /v1/git/push` - Push to remote

Issues:
- Diff endpoint only works with `git diff`, which doesn't show content for new files
- File paths in status are relative but not always from git root
- No handling for showing full content of new/untracked files

#### 3. **API Client** (`packages/api/`)
- Generated from OpenAPI spec
- Types: `GitFile`, `GitStatus`, `GitDiff`, `GitBranch`, etc.
- Issues:
  - Schema doesn't distinguish between "diff" and "content" for new files

#### 4. **Web SDK** (`packages/web-sdk/`)
Components:
- `GitSidebar.tsx` - Main git UI
- `GitFileList.tsx` - File list display
- `GitFileItem.tsx` - Individual file item (truncates paths)
- `GitDiffPanel.tsx` - Diff viewer panel (truncates paths)
- `GitDiffViewer.tsx` - Syntax-highlighted diff display

Hooks:
- `useGitStatus()` - Polls status every 5s when expanded
- `useGitDiff()` - Fetches diff for a file
- `useStageFiles()` - Stage mutation
- `useUnstageFiles()` - Unstage mutation
- `useCommitChanges()` - Commit mutation

Issues:
- Path truncation in `GitFileItem.tsx` and `GitDiffPanel.tsx`
- No handling for new files in diff viewer
- Relies on backend to provide diff, which fails for new files

#### 5. **Web App** (`apps/web/`)
- Uses `GitDiffPanel` component
- Integrates with layout and sidebar management

### Key Problems Identified

#### Problem 1: Path Truncation
**Location**: `GitFileItem.tsx` (line 90-104), `GitDiffPanel.tsx` (line 65-84)

```typescript
const formatFilePath = (path: string) => {
  const pathParts = path.split('/');
  // ... truncation logic showing "../dir/file.tsx"
}
```

**Impact**: Users can't see full paths, making it hard to distinguish files with same names in different directories.

#### Problem 2: New Files Have No Diff
**Location**: `packages/server/src/routes/git.ts` (line 331-380)

```typescript
const diffArgs = query.staged
  ? ['diff', '--cached', '--', query.file]
  : ['diff', '--', query.file];
```

**Impact**: For untracked files, `git diff` returns empty. Should use `git show :0:file` or read file content directly.

#### Problem 3: Inconsistent File Status Handling
**Location**: `packages/server/src/routes/git.ts` (line 158-187)

```typescript
function parseGitStatus(statusOutput: string) {
  // Parses X Y format but treats untracked differently
  if (x === '?' && y === '?') {
    untracked.push({ path, status: 'untracked', staged: false });
  }
}
```

**Impact**: Untracked files are separated, but should be treated as "addable" with full content viewable.

#### Problem 4: Git Root Path Inconsistency
**Location**: Throughout - git commands use git root but paths returned may be relative

**Impact**: Paths are sometimes relative to cwd, sometimes to git root, causing confusion.

---

## Proposed Solution

### Phase 1: Backend API Improvements

#### 1.1 Enhance `/v1/git/status` Response

**Changes to `packages/server/src/routes/git.ts`:**

```typescript
interface GitFile {
  path: string;              // Full path from git root
  relPath: string;           // Path relative to git root (for display)
  absPath: string;           // Absolute filesystem path
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  insertions?: number;
  deletions?: number;
  oldPath?: string;          // For renames
  isNew: boolean;            // True for untracked or newly added files
}

interface GitStatusResponse {
  branch: string;
  ahead: number;
  behind: number;
  gitRoot: string;           // NEW: Expose git root path
  workingDir: string;        // NEW: Current working directory
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];      // Keep separate for clarity
  hasChanges: boolean;
}
```

**Benefits:**
- Full path information available
- Git root exposed for client-side path manipulation
- Clear indication of new files

#### 1.2 Enhance `/v1/git/diff` Endpoint

**Changes to `packages/server/src/routes/git.ts`:**

```typescript
interface GitDiffResponse {
  file: string;              // Full path from git root
  absPath: string;           // Absolute path
  diff: string;              // Unified diff OR full content for new files
  content?: string;          // NEW: Full file content (for new files)
  isNewFile: boolean;        // NEW: Flag indicating this is a new file
  isBinary: boolean;
  insertions: number;
  deletions: number;
  language: string;
  staged: boolean;           // NEW: Whether showing staged or unstaged version
}
```

**Implementation Logic:**

```typescript
app.get('/v1/git/diff', async (c) => {
  // ... validation ...
  
  const isNewFile = await checkIfNewFile(gitRoot, query.file);
  
  if (isNewFile) {
    // For new files, read content directly
    const fullPath = path.join(gitRoot, query.file);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    return c.json({
      status: 'ok',
      data: {
        file: query.file,
        absPath: fullPath,
        diff: '', // Empty diff
        content: content, // Full content
        isNewFile: true,
        isBinary: false,
        insertions: content.split('\n').length,
        deletions: 0,
        language: inferLanguage(query.file),
        staged: !!query.staged,
      }
    });
  }
  
  // Existing diff logic for modified files...
});

async function checkIfNewFile(gitRoot: string, file: string): Promise<boolean> {
  try {
    // Check if file is in git index or committed
    await execFileAsync('git', ['ls-files', '--error-unmatch', file], { cwd: gitRoot });
    return false; // File exists in git
  } catch {
    return true; // File is new/untracked
  }
}
```

#### 1.3 Add Bulk Diff Endpoint (Optional Enhancement)

**New Endpoint: `POST /v1/git/diff/batch`**

```typescript
interface GitDiffBatchRequest {
  files: Array<{ path: string; staged: boolean }>;
  project?: string;
}

interface GitDiffBatchResponse {
  diffs: GitDiffResponse[];
}
```

**Benefits:**
- Fetch multiple diffs in one request
- Reduce network overhead for status + diff workflows

---

### Phase 2: SDK Tool Updates

#### 2.1 Update `git_status` Tool

**Changes to `packages/sdk/src/core/src/tools/builtin/git.ts`:**

```typescript
const git_status = tool({
  description: GIT_STATUS_DESCRIPTION,
  inputSchema: z.object({
    detailed: z.boolean().optional().default(false) // Include file-level stats
  }).optional(),
  async execute({ detailed = false }) {
    if (!(await inRepo())) {
      return { error: 'Not a git repository', staged: 0, unstaged: 0, raw: [] };
    }
    
    const gitRoot = await findGitRoot();
    
    // Get porcelain status
    const { stdout } = await execAsync(`git -C "${gitRoot}" status --porcelain=v1`);
    const lines = stdout.split('\n').filter(Boolean);
    
    // Parse into structured format with full paths
    const files = lines.map(line => {
      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();
      const absPath = path.join(gitRoot, filePath);
      
      return {
        path: filePath,        // Relative to git root
        absPath: absPath,      // Absolute path
        x: x,                  // Staged status
        y: y,                  // Unstaged status
        isStaged: x !== ' ' && x !== '?',
        isUnstaged: y !== ' ',
        isUntracked: x === '?' && y === '?',
      };
    });
    
    const staged = files.filter(f => f.isStaged).length;
    const unstaged = files.filter(f => f.isUnstaged || f.isUntracked).length;
    
    if (detailed) {
      // Return full structured data
      return {
        gitRoot,
        staged,
        unstaged,
        files: files.slice(0, 200), // Limit for safety
      };
    }
    
    // Simple format (existing behavior)
    return {
      staged,
      unstaged,
      raw: lines.slice(0, 200),
    };
  },
});
```

#### 2.2 Update `git_diff` Tool

**Changes to `packages/sdk/src/core/src/tools/builtin/git.ts`:**

```typescript
const git_diff = tool({
  description: GIT_DIFF_DESCRIPTION,
  inputSchema: z.object({ 
    all: z.boolean().optional().default(false),
    file: z.string().optional(), // NEW: Specific file
  }),
  async execute({ all, file }: { all?: boolean; file?: string }) {
    if (!(await inRepo())) {
      return { error: 'Not a git repository', all: !!all, patch: '' };
    }
    
    const gitRoot = await findGitRoot();
    
    // If specific file requested
    if (file) {
      const isNew = await checkIfNewFile(gitRoot, file);
      
      if (isNew) {
        // Read full content for new files
        const fullPath = path.join(gitRoot, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        return {
          file,
          isNewFile: true,
          content,
          patch: '', // No diff for new files
        };
      }
      
      // Get diff for existing file
      const cmd = all 
        ? `git -C "${gitRoot}" diff HEAD -- "${file}"`
        : `git -C "${gitRoot}" diff --staged -- "${file}"`;
      const { stdout } = await execAsync(cmd);
      return { file, isNewFile: false, patch: stdout };
    }
    
    // Existing behavior for all files
    const cmd = all
      ? `git -C "${gitRoot}" diff HEAD`
      : `git -C "${gitRoot}" diff --staged`;
    const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    const limited = stdout.split('\n').slice(0, 5000).join('\n');
    return { all: !!all, patch: limited };
  },
});

async function checkIfNewFile(gitRoot: string, file: string): Promise<boolean> {
  try {
    await execAsync(`git -C "${gitRoot}" ls-files --error-unmatch "${file}"`);
    return false;
  } catch {
    return true;
  }
}
```

---

### Phase 3: OpenAPI Schema Updates

#### 3.1 Update `packages/api/openapi.json`

**Update GitFile Schema:**

```json
{
  "GitFile": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Path relative to git root"
      },
      "absPath": {
        "type": "string",
        "description": "Absolute filesystem path"
      },
      "status": {
        "type": "string",
        "enum": ["modified", "added", "deleted", "renamed", "untracked"]
      },
      "staged": {
        "type": "boolean"
      },
      "insertions": {
        "type": "integer"
      },
      "deletions": {
        "type": "integer"
      },
      "oldPath": {
        "type": "string",
        "description": "Original path for renamed files"
      },
      "isNew": {
        "type": "boolean",
        "description": "True for untracked or newly added files"
      }
    },
    "required": ["path", "absPath", "status", "staged", "isNew"]
  }
}
```

**Update GitStatus Schema:**

```json
{
  "GitStatus": {
    "type": "object",
    "properties": {
      "branch": { "type": "string" },
      "ahead": { "type": "integer" },
      "behind": { "type": "integer" },
      "gitRoot": {
        "type": "string",
        "description": "Absolute path to git repository root"
      },
      "workingDir": {
        "type": "string",
        "description": "Current working directory"
      },
      "staged": {
        "type": "array",
        "items": { "$ref": "#/components/schemas/GitFile" }
      },
      "unstaged": {
        "type": "array",
        "items": { "$ref": "#/components/schemas/GitFile" }
      },
      "untracked": {
        "type": "array",
        "items": { "$ref": "#/components/schemas/GitFile" }
      },
      "hasChanges": { "type": "boolean" }
    },
    "required": ["branch", "ahead", "behind", "gitRoot", "workingDir", "staged", "unstaged", "untracked", "hasChanges"]
  }
}
```

**Update GitDiff Schema:**

```json
{
  "GitDiff": {
    "type": "object",
    "properties": {
      "file": {
        "type": "string",
        "description": "Path relative to git root"
      },
      "absPath": {
        "type": "string",
        "description": "Absolute filesystem path"
      },
      "diff": {
        "type": "string",
        "description": "Unified diff output (empty for new files)"
      },
      "content": {
        "type": "string",
        "description": "Full file content (only for new files)"
      },
      "isNewFile": {
        "type": "boolean",
        "description": "True if this is a new/untracked file"
      },
      "isBinary": {
        "type": "boolean"
      },
      "insertions": { "type": "integer" },
      "deletions": { "type": "integer" },
      "language": { "type": "string" },
      "staged": {
        "type": "boolean",
        "description": "Whether showing staged or unstaged version"
      }
    },
    "required": ["file", "absPath", "diff", "isNewFile", "isBinary", "insertions", "deletions", "language", "staged"]
  }
}
```

#### 3.2 Regenerate API Client

```bash
cd packages/api
bun run generate
```

---

### Phase 4: Web SDK Updates

#### 4.1 Update Type Definitions

**`packages/web-sdk/src/types/api.ts`:**

```typescript
export interface GitFileStatus {
  path: string;              // Relative to git root
  absPath: string;           // Absolute path
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  insertions?: number;
  deletions?: number;
  oldPath?: string;
  isNew: boolean;
}

export interface GitStatusResponse {
  branch: string;
  ahead: number;
  behind: number;
  gitRoot: string;
  workingDir: string;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
  hasChanges: boolean;
}

export interface GitDiffResponse {
  file: string;
  absPath: string;
  diff: string;
  content?: string;          // For new files
  isNewFile: boolean;
  isBinary: boolean;
  insertions: number;
  deletions: number;
  language: string;
  staged: boolean;
}
```

#### 4.2 Remove Path Truncation

**`packages/web-sdk/src/components/git/GitFileItem.tsx`:**

```typescript
export function GitFileItem({ file, staged }: GitFileItemProps) {
  // ... existing code ...
  
  // REMOVE truncation - show full path
  const displayPath = file.path; // Full path from git root
  
  return (
    <button
      type="button"
      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer group transition-colors w-full text-left"
      onClick={handleClick}
    >
      {/* ... */}
      <span
        className="text-sm text-foreground font-mono"
        title={file.absPath} // Show absolute path on hover
      >
        {displayPath}
      </span>
      {/* ... */}
    </button>
  );
}
```

**`packages/web-sdk/src/components/git/GitDiffPanel.tsx`:**

```typescript
export const GitDiffPanel = memo(function GitDiffPanel() {
  // ... existing code ...
  
  // REMOVE truncation
  const displayPath = selectedFile; // Full path
  
  return (
    <div className="absolute inset-0 bg-background z-50 flex flex-col">
      <div className="h-14 border-b border-border px-4 flex items-center gap-3">
        {/* ... */}
        <span
          className="text-sm font-medium text-foreground font-mono"
          title={diff?.absPath} // Show absolute path on hover
        >
          {displayPath}
        </span>
        {/* ... */}
      </div>
      {/* ... */}
    </div>
  );
});
```

#### 4.3 Update GitDiffViewer for New Files

**`packages/web-sdk/src/components/git/GitDiffViewer.tsx`:**

```typescript
export function GitDiffViewer({ diff }: GitDiffViewerProps) {
  // Handle new files differently
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
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
          }}
        >
          {diff.content}
        </SyntaxHighlighter>
      </div>
    );
  }
  
  // Handle binary files
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
  
  // Existing diff rendering for modified files
  // ... rest of the code ...
}
```

#### 4.4 Update GitFileList for Better Organization

**`packages/web-sdk/src/components/git/GitFileList.tsx`:**

```typescript
export function GitFileList({ status }: GitFileListProps) {
  // Organize files by category
  const stagedFiles = status.staged || [];
  const unstagedFiles = status.unstaged || [];
  const untrackedFiles = status.untracked || [];
  
  return (
    <div className="space-y-4">
      {/* Staged Changes */}
      {stagedFiles.length > 0 && (
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Staged Changes ({stagedFiles.length})
          </div>
          {stagedFiles.map((file) => (
            <GitFileItem key={file.path} file={file} staged={true} />
          ))}
        </div>
      )}
      
      {/* Unstaged Changes */}
      {unstagedFiles.length > 0 && (
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Changes ({unstagedFiles.length})
          </div>
          {unstagedFiles.map((file) => (
            <GitFileItem key={file.path} file={file} staged={false} />
          ))}
        </div>
      )}
      
      {/* Untracked Files */}
      {untrackedFiles.length > 0 && (
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Untracked Files ({untrackedFiles.length})
          </div>
          {untrackedFiles.map((file) => (
            <GitFileItem 
              key={file.path} 
              file={file} 
              staged={false}
              showNewIndicator={true} // New prop
            />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {stagedFiles.length === 0 && unstagedFiles.length === 0 && untrackedFiles.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <p>No changes</p>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 5: Testing & Validation

#### 5.1 Unit Tests

**Test Cases for Server (`packages/server/src/routes/git.test.ts`):**

1. ✅ Status endpoint returns full paths from git root
2. ✅ Status endpoint includes `gitRoot` and `workingDir`
3. ✅ Diff endpoint returns content for new files
4. ✅ Diff endpoint returns diff for modified files
5. ✅ Diff endpoint handles binary files correctly
6. ✅ Stage/unstage works with full paths
7. ✅ Renamed files include `oldPath`

**Test Cases for SDK Tools:**

1. ✅ `git_status` returns full paths
2. ✅ `git_diff` with `file` param returns content for new files
3. ✅ `git_diff` without params returns unified diff

**Test Cases for Web SDK:**

1. ✅ GitFileItem displays full paths without truncation
2. ✅ GitDiffViewer shows content for new files
3. ✅ GitDiffViewer shows diff for modified files
4. ✅ GitDiffPanel displays full path in header

#### 5.2 Integration Tests

**Scenarios:**

1. ✅ Create new file → See in untracked → Stage → View content → Commit
2. ✅ Modify existing file → View diff → Stage → Commit
3. ✅ Delete file → View deletion diff → Stage → Commit
4. ✅ Rename file → See old and new paths → Stage → Commit
5. ✅ Mixed changes (new + modified + deleted) → Stage selectively → Commit

#### 5.3 Manual Testing Checklist

- [ ] Full file paths visible in sidebar
- [ ] New files show full content in diff viewer
- [ ] Modified files show unified diff
- [ ] Deleted files show deletion diff
- [ ] Renamed files show both old and new paths
- [ ] Binary files show appropriate message
- [ ] Stage/unstage works for all file types
- [ ] Commit message generation includes all file types
- [ ] Git sidebar refreshes correctly after operations
- [ ] Keyboard shortcuts work (ESC to close diff)
- [ ] Hover shows absolute paths

---

### Phase 6: Documentation

#### 6.1 Update API Documentation

**`docs/api.md`:**

Add section on Git API endpoints with examples:

```markdown
### Git API

#### GET /v1/git/status

Returns current git repository status with full file information.

**Response:**
\`\`\`json
{
  "status": "ok",
  "data": {
    "branch": "main",
    "gitRoot": "/Users/user/project",
    "workingDir": "/Users/user/project/packages/app",
    "staged": [
      {
        "path": "src/index.ts",
        "absPath": "/Users/user/project/src/index.ts",
        "status": "modified",
        "staged": true,
        "isNew": false,
        "insertions": 10,
        "deletions": 5
      }
    ],
    "untracked": [
      {
        "path": "src/new-file.ts",
        "absPath": "/Users/user/project/src/new-file.ts",
        "status": "untracked",
        "staged": false,
        "isNew": true
      }
    ]
  }
}
\`\`\`

#### GET /v1/git/diff?file=...&staged=true

Returns diff or content for a specific file.

**For modified files:**
\`\`\`json
{
  "status": "ok",
  "data": {
    "file": "src/index.ts",
    "absPath": "/Users/user/project/src/index.ts",
    "diff": "diff --git a/src/index.ts b/src/index.ts\\n...",
    "isNewFile": false,
    "insertions": 10,
    "deletions": 5,
    "language": "typescript"
  }
}
\`\`\`

**For new files:**
\`\`\`json
{
  "status": "ok",
  "data": {
    "file": "src/new-file.ts",
    "absPath": "/Users/user/project/src/new-file.ts",
    "diff": "",
    "content": "// Full file content here\\n...",
    "isNewFile": true,
    "insertions": 20,
    "deletions": 0,
    "language": "typescript"
  }
}
\`\`\`
```

#### 6.2 Update Component Documentation

**`packages/web-sdk/README.md`:**

```markdown
### Git Components

The git integration provides a full-featured git UI with:

- **Full path display** - File paths are shown relative to git root
- **New file support** - Untracked files show their full content
- **Diff visualization** - Syntax-highlighted diffs for all file types
- **Staged/unstaged management** - Easy staging with checkboxes
- **AI commit messages** - Generate conventional commit messages

Components:
- `<GitSidebar />` - Main git interface
- `<GitFileList />` - Organized file list with categories
- `<GitFileItem />` - Individual file with stage/unstage
- `<GitDiffPanel />` - Full-screen diff viewer
- `<GitDiffViewer />` - Syntax-highlighted diff display
```

---

## Implementation Timeline

### Sprint 1: Backend Foundation (Days 1-3)
- ✅ Update server git routes with enhanced responses
- ✅ Add path utilities for git root handling
- ✅ Implement new file content reading
- ✅ Add unit tests for server endpoints

### Sprint 2: API & SDK (Days 4-5)
- ✅ Update OpenAPI schema
- ✅ Regenerate API client
- ✅ Update SDK tools (git_status, git_diff)
- ✅ Add SDK tool tests

### Sprint 3: Web SDK UI (Days 6-8)
- ✅ Update type definitions
- ✅ Remove path truncation
- ✅ Enhance GitDiffViewer for new files
- ✅ Update GitFileList organization
- ✅ Add UI tests

### Sprint 4: Testing & Polish (Days 9-10)
- ✅ Integration tests
- ✅ Manual testing across scenarios
- ✅ Bug fixes
- ✅ Documentation updates

---

## Migration Guide

### For Web App Developers

**Before:**
```typescript
// Paths were truncated
<GitFileItem file={{ path: "../dir/file.tsx" }} />

// New files had no diff
<GitDiffViewer diff={{ diff: "" }} /> // Empty!
```

**After:**
```typescript
// Full paths shown
<GitFileItem file={{ 
  path: "packages/app/src/components/file.tsx",
  absPath: "/Users/user/project/packages/app/src/components/file.tsx",
  isNew: false
}} />

// New files show content
<GitDiffViewer diff={{
  isNewFile: true,
  content: "// Full file content",
  diff: "",
  insertions: 20
}} />
```

### For API Consumers

**Breaking Changes:**

1. `GitFile` now requires `absPath` and `isNew` fields
2. `GitStatus` now includes `gitRoot` and `workingDir` fields
3. `GitDiff` now includes `isNewFile`, `content`, and `staged` fields

**Migration:**
```typescript
// Old
const { path } = gitFile;

// New
const { path, absPath, isNew } = gitFile;
console.log(`${path} -> ${absPath}`);
```

### For SDK Users

**No breaking changes** - Existing tool usage continues to work. Enhanced features are opt-in via new parameters.

---

## Success Metrics

- ✅ No path truncation in UI
- ✅ 100% of file types (new, modified, deleted, renamed) show appropriate content/diff
- ✅ All git operations (stage, unstage, commit) work with full paths
- ✅ Test coverage > 80% for git-related code
- ✅ Zero path-related bugs in production

---

## Risks & Mitigations

### Risk 1: Performance Impact
**Risk:** Reading full file content for many new files could be slow

**Mitigation:**
- Lazy-load file content (only when viewing diff)
- Implement file size limits (e.g., max 1MB)
- Use streaming for large files

### Risk 2: Path Confusion
**Risk:** Different path formats (relative vs absolute) could confuse users

**Mitigation:**
- Consistent use of relative paths for display
- Absolute paths only in tooltips/debugging
- Clear documentation

### Risk 3: Breaking Changes
**Risk:** API schema changes could break existing integrations

**Mitigation:**
- Version the API (keep v1 endpoints, add v2)
- Provide migration guide
- Gradual rollout with feature flags

---

## Open Questions

1. **Q:** Should we cache file content for new files to avoid repeated reads?
   **A:** Yes, implement client-side caching with react-query (already in place)

2. **Q:** How to handle very large new files (e.g., generated files, lock files)?
   **A:** Implement size limits and truncation with warning message

3. **Q:** Should we support viewing historical diffs (e.g., vs specific commits)?
   **A:** Future enhancement - out of scope for this rework

4. **Q:** Should paths be relative to git root or current working directory?
   **A:** Git root for consistency, with workingDir context available

---

## Appendix

### A. Git Porcelain Format Reference

```
XY path
where X = staged status, Y = unstaged status

Status codes:
' ' = unmodified
M = modified
A = added
D = deleted
R = renamed
C = copied
U = updated but unmerged
? = untracked
! = ignored
```

### B. Relevant Files

**Backend:**
- `packages/server/src/routes/git.ts` - Git API routes
- `packages/sdk/src/core/src/tools/builtin/git.ts` - SDK tools

**Frontend:**
- `packages/web-sdk/src/components/git/` - Git UI components
- `packages/web-sdk/src/hooks/useGit.ts` - Git hooks
- `packages/web-sdk/src/stores/gitStore.ts` - Git state management

**API:**
- `packages/api/openapi.json` - OpenAPI specification
- `packages/api/src/generated/` - Generated client code

**Web App:**
- `apps/web/src/components/layout/AppLayout.tsx` - Integration point

### C. Related Issues

- Path truncation (current issue)
- New files no diff (current issue)
- Binary file handling (enhancement)
- Large file performance (future)
- Multi-repo support (future)

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-XX  
**Author:** AGI Development Team  
**Status:** 📋 READY FOR REVIEW
