# Git Sidebar Implementation Plan

## Overview
A comprehensive right sidebar for Git integration in the AGI web UI, providing full Git workflow capabilities including:
- View changed files and diffs
- Stage/unstage files
- Generate AI-powered commit messages
- Commit changes
- View git status

This will be the first component of the Right Sidebar system. Future additions will include a "Session Files" tab showing files modified during the current session.

---

## Visual Layout & States

### STATE 1: Collapsed Right Sidebar (Default)
```
┌─────────────────────────────────────────────────────────────────┐
│  Header [Theme] [New Session]                                   │
├──────────┬──────────────────────────────────────┬──────────────┤
│          │                                       │              │
│ Sessions │  Message Thread                       │  [📂]        │ ← Thin vertical
│ List     │                                       │              │    button bar
│          │  [Messages...]                        │  Git         │    (~50px wide)
│ ┌──────┐ │                                       │              │
│ │Active│ │                                       │              │
│ └──────┘ │                                       │              │
│          │                                       │              │
│          │  [Chat Input]                         │              │
│          │                                       │              │
└──────────┴──────────────────────────────────────┴──────────────┘
```

### STATE 2: Expanded - Git File List
```
┌─────────────────────────────────────────────────────────────────┐
│  Header [Theme] [New Session]                                   │
├──────────┬──────────────────────────┬───────────────────────────┤
│          │                           │ ← Back      Git Changes   │ ← Header
│ Sessions │  Message Thread           ├───────────────────────────┤
│ List     │                           │ Staged (2)                │
│          │  [Messages...]            │ ☑ M src/App.tsx    +15 -3│ ← Staged files
│ ┌──────┐ │                           │ ☑ A new-file.ts    +42   │    with checkboxes
│ │Active│ │                           ├───────────────────────────┤
│ └──────┘ │                           │ Changes (3)               │
│          │                           │ ☐ M components/X.tsx +5-2│ ← Unstaged files
│          │  [Chat Input]             │ ☐ D old-file.ts      -28 │    with checkboxes
│          │                           │ ☐ ?? untracked.ts    +10 │
│          │                           ├───────────────────────────┤
│          │                           │ [✨ Generate Commit]      │ ← Actions
│          │                           │ [💾 Commit]               │
└──────────┴──────────────────────────┴───────────────────────────┘
                                                    ↑
                                            (~350-400px width)
```

### STATE 3: Diff View - File Selected
```
┌─────────────────────────────────────────────────────────────────┐
│  Header [Theme] [New Session]                                   │
├───────────────────────────────────────────┬─────────────────────┤
│ [✕ Close]  src/App.tsx                    │ ← Back  Git         │ ← Diff header
├───────────────────────────────────────────┼─────────────────────┤
│                                           │ Staged (2)          │
│  Diff Content Area                        │ ☑ M src/App.tsx ✓   │ ← Current file
│                                           │ ☑ A new-file.ts     │    highlighted
│  @@ -10,6 +10,9 @@                       ├─────────────────────┤
│  + import { useState }                    │ Changes (3)         │
│  + import { useEffect }                   │ ☐ M components/...  │
│                                           │ ☐ D old-file.ts     │
│  - const oldCode = 'something';           │ ☐ ?? untracked.ts   │
│  + const newCode = 'updated';             ├─────────────────────┤
│                                           │ [✨ Generate]       │
│  [More diff content...]                   │ [💾 Commit]         │
│                                           │                     │
└───────────────────────────────────────────┴─────────────────────┘
            ↑                                          ↑
     Covers everything on left              Sidebar stays in place
     (Sessions + Messages BEHIND)            File list visible
```

### STATE 4: Commit Message Modal
```
┌─────────────────────────────────────────────────────────────────┐
│  Header [Theme] [New Session]                                   │
├───────────────────────────────────────────┬─────────────────────┤
│                                           │ ← Back  Git         │
│  ┌─────────────────────────────────────┐ │ Staged (2)          │
│  │  Commit Message                     │ │ ☑ M src/App.tsx     │
│  ├─────────────────────────────────────┤ │ ☑ A new-file.ts     │
│  │                                     │ │                     │
│  │  feat: add user authentication      │ │ [✨ Generate]       │
│  │                                     │ │ [💾 Commit]         │
│  │  - Add login/logout functionality   │ │                     │
│  │  - Integrate JWT tokens             │ │                     │
│  │  - Add user session management      │ │                     │
│  │                                     │ │                     │
│  ├─────────────────────────────────────┤ │                     │
│  │ [Cancel]  [🔄 Regenerate] [Commit] │ │                     │
│  └─────────────────────────────────────┘ │                     │
│                                           │                     │
└───────────────────────────────────────────┴─────────────────────┘
                   ↑
          Centered modal overlay
          AI-generated commit message
```

---

## Component Architecture

### New Components

```
packages/web/src/components/git/
├── GitSidebar.tsx                 // Main sidebar container
├── GitFileList.tsx                // List of changed files (staged + unstaged)
├── GitFileItem.tsx                // Individual file item with checkbox
├── GitDiffViewer.tsx              // Diff visualization panel
├── GitDiffPanel.tsx               // Sliding panel wrapper
├── GitCommitModal.tsx             // Commit message modal
├── GitActions.tsx                 // Action buttons (Generate, Commit)
└── GitStatusBadge.tsx             // Status indicator in collapsed state
```

### Component Specifications

#### GitSidebar.tsx
```typescript
interface GitSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  projectRoot?: string;
}

interface GitSidebarState {
  view: 'list' | 'diff';           // Current view state
  selectedFile: string | null;      // File being viewed in diff
  stagedFiles: Set<string>;         // Tracked staged file paths
  showCommitModal: boolean;
}

// Features:
// - Collapsed state: 50px wide vertical button
// - Expanded state: 350-400px wide
// - Slide-in/out animation (300ms ease-in-out)
// - Header with back button
// - Real-time git status updates (polling every 2s when open)
// - Badge showing count of changes in collapsed state
```

#### GitFileList.tsx
```typescript
interface GitFileListProps {
  stagedFiles: GitFile[];
  unstagedFiles: GitFile[];
  untrackedFiles: GitFile[];
  selectedFile: string | null;
  onFileSelect: (file: GitFile) => void;
  onStageToggle: (file: GitFile) => void;
}

interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  insertions?: number;
  deletions?: number;
  oldPath?: string;              // For renamed files
}

// Visual structure:
// - "Staged (N)" section (collapsible)
// - "Changes (N)" section (unstaged, collapsible)
// - Each file has checkbox for stage/unstage
// - Click file name to view diff
// - Color coding: M=amber, A=green, D=red, R=blue, ??=gray
// - Show +N/-M stats next to each file
```

#### GitFileItem.tsx
```typescript
interface GitFileItemProps {
  file: GitFile;
  isSelected: boolean;
  onSelect: () => void;
  onStageToggle: () => void;
}

// Visual elements:
// - Checkbox (☐/☑) for stage/unstage
// - Status icon (M/A/D/R/??)
// - File path (truncated with tooltip)
// - Stats: +X -Y
// - Hover state with background highlight
// - Selected state with accent border
// - Click anywhere except checkbox to view diff
```

#### GitDiffViewer.tsx
```typescript
interface GitDiffViewerProps {
  file: GitFile;
  diff: string;
  onClose: () => void;
}

// Features:
// - Syntax highlighting based on file extension
// - Line numbers for both old and new
// - +/- indicators with color coding
// - Collapsible hunks (@@ sections)
// - Copy entire diff button
// - Header with file path and close button
// - Supports unified diff format
// - Handles binary files gracefully
```

#### GitCommitModal.tsx
```typescript
interface GitCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagedFiles: GitFile[];
  onCommit: (message: string) => Promise<void>;
  projectRoot: string;
}

interface CommitModalState {
  message: string;
  isGenerating: boolean;
  error: string | null;
}

// Features:
// - Centered modal overlay (backdrop dims content)
// - Multi-line textarea for commit message
// - "Generate" button to create AI commit message
// - "Regenerate" button after generation
// - "Commit" button (disabled if message empty)
// - "Cancel" button
// - Validation: non-empty message required
// - Shows loading state during generation
// - Error handling for failed commits
```

#### GitActions.tsx
```typescript
interface GitActionsProps {
  stagedFilesCount: number;
  onGenerateCommit: () => void;
  onCommit: () => void;
  isLoading: boolean;
}

// Renders:
// - "✨ Generate Commit Message" button
//   - Disabled if no staged files
//   - Opens commit modal with AI-generated message
// - "💾 Commit" button
//   - Disabled if no staged files
//   - Opens commit modal with empty message
// - Shows loading spinner when generating
```

---

## Server API Endpoints

### Git Operations Endpoints

All endpoints are under `/v1/git` namespace and require project root parameter.

#### 1. GET `/v1/git/status`
Get current git status (staged, unstaged, untracked files).

```typescript
// Request
GET /v1/git/status?project=/path/to/project

// Response
{
  "status": "ok",
  "data": {
    "branch": "main",
    "ahead": 2,
    "behind": 0,
    "staged": [
      {
        "path": "src/App.tsx",
        "status": "modified",
        "insertions": 15,
        "deletions": 3
      },
      {
        "path": "new-file.ts",
        "status": "added",
        "insertions": 42,
        "deletions": 0
      }
    ],
    "unstaged": [
      {
        "path": "components/Header.tsx",
        "status": "modified",
        "insertions": 5,
        "deletions": 2
      },
      {
        "path": "old-file.ts",
        "status": "deleted",
        "insertions": 0,
        "deletions": 28
      }
    ],
    "untracked": [
      {
        "path": "temp.ts",
        "status": "untracked"
      }
    ],
    "hasChanges": true
  }
}

// Implementation:
// - Run: git status --porcelain=v1 -z
// - Run: git diff --numstat (for unstaged stats)
// - Run: git diff --cached --numstat (for staged stats)
// - Parse output to GitFile[] format
// - Cache results for 1 second to avoid excessive git calls
```

#### 2. GET `/v1/git/diff`
Get diff for a specific file.

```typescript
// Request
GET /v1/git/diff?project=/path/to/project&file=src/App.tsx&staged=false

// Response
{
  "status": "ok",
  "data": {
    "file": "src/App.tsx",
    "diff": "diff --git a/src/App.tsx b/src/App.tsx\nindex abc123..def456 100644\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -10,6 +10,9 @@\n+import { useState } from 'react';\n+\n-const old = '';\n+const new = '';",
    "insertions": 15,
    "deletions": 3,
    "language": "typescript",
    "binary": false
  }
}

// Implementation:
// - If staged=true: git diff --cached <file>
// - If staged=false: git diff <file>
// - Detect language from file extension
// - Handle binary files (return binary: true, no diff)
// - Return unified diff format
```

#### 3. POST `/v1/git/stage`
Stage one or more files.

```typescript
// Request
POST /v1/git/stage
{
  "project": "/path/to/project",
  "files": ["src/App.tsx", "new-file.ts"]
}

// Response
{
  "status": "ok",
  "data": {
    "staged": ["src/App.tsx", "new-file.ts"],
    "failed": []
  }
}

// Implementation:
// - Run: git add <file1> <file2> ...
// - Return list of successfully staged files
// - Handle errors (file not found, etc.)
```

#### 4. POST `/v1/git/unstage`
Unstage one or more files.

```typescript
// Request
POST /v1/git/unstage
{
  "project": "/path/to/project",
  "files": ["src/App.tsx"]
}

// Response
{
  "status": "ok",
  "data": {
    "unstaged": ["src/App.tsx"],
    "failed": []
  }
}

// Implementation:
// - Run: git restore --staged <file1> <file2> ...
// - Fallback to: git reset HEAD <file> (for older git)
// - Return list of successfully unstaged files
```

#### 5. POST `/v1/git/commit`
Commit staged changes.

```typescript
// Request
POST /v1/git/commit
{
  "project": "/path/to/project",
  "message": "feat: add user authentication\n\n- Add login/logout\n- JWT tokens"
}

// Response
{
  "status": "ok",
  "data": {
    "hash": "abc123def",
    "message": "feat: add user authentication...",
    "filesChanged": 2,
    "insertions": 57,
    "deletions": 3
  }
}

// Error Response
{
  "status": "error",
  "error": "No staged changes to commit"
}

// Implementation:
// - Validate: message not empty, has staged changes
// - Run: git commit -m "<message>"
// - Parse output for commit hash and stats
// - Return commit details
```

#### 6. POST `/v1/git/generate-commit-message`
Generate AI-powered commit message based on staged changes.

```typescript
// Request
POST /v1/git/generate-commit-message
{
  "project": "/path/to/project",
  "stagedFiles": [
    {
      "path": "src/App.tsx",
      "status": "modified"
    },
    {
      "path": "new-file.ts",
      "status": "added"
    }
  ]
}

// Response
{
  "status": "ok",
  "data": {
    "message": "feat: add user authentication\n\n- Implement login and logout functionality\n- Add JWT token management\n- Create user session store"
  }
}

// Implementation:
// - Get diffs for all staged files: git diff --cached
// - Call LLM with prompt:
//   "Generate a conventional commit message for these changes.
//    Format: <type>: <description>\n\n<bullet points>
//    Types: feat, fix, docs, style, refactor, test, chore"
// - Use configured model (from session or default)
// - Return generated message
// - Timeout: 30 seconds
```

#### 7. GET `/v1/git/branch`
Get current branch and remote tracking info.

```typescript
// Request
GET /v1/git/branch?project=/path/to/project

// Response
{
  "status": "ok",
  "data": {
    "current": "main",
    "upstream": "origin/main",
    "ahead": 2,
    "behind": 0,
    "all": ["main", "develop", "feature/sidebar"]
  }
}

// Implementation:
// - Run: git branch --show-current
// - Run: git rev-list --left-right --count HEAD...@{u}
// - Run: git branch --list
// - Parse and return branch info
```

---

## State Management

### Zustand Store

```typescript
// packages/web/src/stores/gitStore.ts

interface GitStore {
  // Sidebar state
  isOpen: boolean;
  view: 'list' | 'diff';
  selectedFile: GitFile | null;
  
  // Git data
  status: GitStatus | null;
  isLoading: boolean;
  lastUpdated: number | null;
  
  // Commit modal
  showCommitModal: boolean;
  commitMessage: string;
  isGeneratingCommit: boolean;
  
  // Actions
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  
  setView: (view: 'list' | 'diff') => void;
  selectFile: (file: GitFile | null) => void;
  
  fetchStatus: (projectRoot: string) => Promise<void>;
  stageFile: (projectRoot: string, file: GitFile) => Promise<void>;
  unstageFile: (projectRoot: string, file: GitFile) => Promise<void>;
  stageFiles: (projectRoot: string, files: GitFile[]) => Promise<void>;
  unstageFiles: (projectRoot: string, files: GitFile[]) => Promise<void>;
  
  openCommitModal: () => void;
  closeCommitModal: () => void;
  setCommitMessage: (message: string) => void;
  generateCommitMessage: (projectRoot: string) => Promise<void>;
  commit: (projectRoot: string, message: string) => Promise<void>;
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
  hasChanges: boolean;
}
```

### TanStack Query Hooks

```typescript
// packages/web/src/hooks/useGit.ts

export function useGitStatus(projectRoot: string, enabled: boolean) {
  return useQuery({
    queryKey: ['git', 'status', projectRoot],
    queryFn: () => api.git.getStatus(projectRoot),
    refetchInterval: enabled ? 2000 : false,  // Poll every 2s when sidebar open
    enabled,
  });
}

export function useGitDiff(projectRoot: string, file: string, staged: boolean) {
  return useQuery({
    queryKey: ['git', 'diff', projectRoot, file, staged],
    queryFn: () => api.git.getDiff(projectRoot, file, staged),
    enabled: !!file,
  });
}

export function useGitStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectRoot, files }: { projectRoot: string; files: string[] }) =>
      api.git.stage(projectRoot, files),
    onSuccess: (_, { projectRoot }) => {
      queryClient.invalidateQueries(['git', 'status', projectRoot]);
    },
  });
}

export function useGitUnstage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectRoot, files }: { projectRoot: string; files: string[] }) =>
      api.git.unstage(projectRoot, files),
    onSuccess: (_, { projectRoot }) => {
      queryClient.invalidateQueries(['git', 'status', projectRoot]);
    },
  });
}

export function useGitCommit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectRoot, message }: { projectRoot: string; message: string }) =>
      api.git.commit(projectRoot, message),
    onSuccess: (_, { projectRoot }) => {
      queryClient.invalidateQueries(['git', 'status', projectRoot]);
    },
  });
}

export function useGenerateCommitMessage() {
  return useMutation({
    mutationFn: ({ projectRoot, stagedFiles }: { projectRoot: string; stagedFiles: GitFile[] }) =>
      api.git.generateCommitMessage(projectRoot, stagedFiles),
  });
}
```

---

## User Interactions & Behavior

### Opening/Closing Sidebar

1. **Collapsed → Expanded (File List)**
   - Click Git button in collapsed sidebar
   - Sidebar slides in from right (300ms)
   - Fetches git status
   - Shows file list

2. **Expanded → Collapsed**
   - Click "← Back" button in header
   - Sidebar slides out to right (300ms)
   - If diff is open, returns to list first

### Viewing Diffs

1. **File List → Diff View**
   - Click on file name (not checkbox)
   - Diff panel slides in from left (300ms)
   - Covers session list and message thread
   - File list stays visible on right
   - Fetches diff for selected file

2. **Switching Files in Diff View**
   - Click different file in file list
   - Diff content swaps instantly (NO animation)
   - Loading spinner during fetch

3. **Diff View → File List**
   - Click "✕ Close" button
   - Press ESC key
   - Diff panel slides out to left (300ms)
   - Returns to normal view

### Staging/Unstaging Files

1. **Stage a File**
   - Click checkbox next to unstaged file
   - File moves from "Changes" to "Staged" section
   - Smooth animation (300ms)
   - Checkbox becomes checked

2. **Unstage a File**
   - Click checkbox next to staged file
   - File moves from "Staged" to "Changes" section
   - Smooth animation (300ms)
   - Checkbox becomes unchecked

3. **Bulk Actions** (Future)
   - "Stage All" button stages all unstaged files
   - "Unstage All" button unstages all staged files

### Committing Changes

1. **Manual Commit**
   - Click "💾 Commit" button
   - Modal opens with empty textarea
   - User types commit message
   - Click "Commit" button
   - Shows success toast
   - Refreshes git status
   - Closes modal

2. **AI-Generated Commit**
   - Click "✨ Generate Commit Message" button
   - Modal opens with loading state
   - AI generates message (2-5 seconds)
   - Message appears in textarea
   - User can edit if needed
   - Click "🔄 Regenerate" to get new message
   - Click "Commit" to commit
   - Shows success toast
   - Refreshes git status
   - Closes modal

### Error Handling

1. **No Git Repository**
   - Sidebar shows: "Not a git repository"
   - Suggest running `git init`

2. **No Staged Changes**
   - Commit buttons disabled
   - Tooltip: "No staged changes"

3. **Commit Failed**
   - Show error toast with git error message
   - Keep modal open
   - User can fix and retry

4. **Network Error**
   - Show error toast
   - Retry button
   - Sidebar stays open

---

## Styling & Animations

### Color Scheme (Dark Mode)

```css
/* Status colors */
--git-modified: #f59e0b;      /* amber-500 */
--git-added: #10b981;         /* emerald-500 */
--git-deleted: #ef4444;       /* red-500 */
--git-renamed: #3b82f6;       /* blue-500 */
--git-untracked: #71717a;     /* zinc-500 */

/* Diff colors */
--diff-addition-bg: rgba(16, 185, 129, 0.15);
--diff-addition-fg: #10b981;
--diff-deletion-bg: rgba(239, 68, 68, 0.15);
--diff-deletion-fg: #ef4444;
--diff-line-number: #71717a;
--diff-hunk-header-bg: rgba(59, 130, 246, 0.1);

/* Sidebar */
--sidebar-bg: #18181b;         /* zinc-900 */
--sidebar-border: #27272a;     /* zinc-800 */
--sidebar-hover: #27272a;
--sidebar-selected: rgba(59, 130, 246, 0.1);
```

### Animations

```css
/* Sidebar slide in/out */
.git-sidebar {
  transition: transform 300ms ease-in-out, opacity 300ms ease-in-out;
}

.git-sidebar.collapsed {
  transform: translateX(100%);
  opacity: 0;
}

.git-sidebar.expanded {
  transform: translateX(0);
  opacity: 1;
}

/* Diff panel slide in/out */
.git-diff-panel {
  transition: transform 300ms ease-in-out;
}

.git-diff-panel.closed {
  transform: translateX(-100%);
}

.git-diff-panel.open {
  transform: translateX(0);
}

/* File item move between staged/unstaged */
.git-file-item {
  transition: all 300ms ease-in-out;
}

/* Checkbox animation */
.git-checkbox {
  transition: background 150ms ease-in-out, border 150ms ease-in-out;
}

/* Modal backdrop */
.commit-modal-backdrop {
  animation: fadeIn 200ms ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Modal content */
.commit-modal-content {
  animation: slideUp 250ms ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### Responsive Behavior

```css
/* Desktop (>= 1024px) */
@media (min-width: 1024px) {
  .git-sidebar.expanded {
    width: 380px;
  }
  
  .git-diff-panel {
    width: calc(100% - 380px);
  }
}

/* Tablet (768px - 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .git-sidebar.expanded {
    width: 320px;
  }
  
  .git-diff-panel {
    width: calc(100% - 320px);
  }
}

/* Mobile (<768px) */
@media (max-width: 767px) {
  /* Git sidebar takes full width when expanded */
  .git-sidebar.expanded {
    width: 100%;
    position: fixed;
    z-index: 100;
  }
  
  /* Diff panel takes full screen */
  .git-diff-panel {
    width: 100%;
    position: fixed;
    z-index: 101;
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

#### Server Implementation (Days 1-3)
- [ ] Create `/v1/git` router in Hono
- [ ] Implement `GET /v1/git/status` endpoint
  - Parse `git status --porcelain`
  - Parse `git diff --numstat` for stats
  - Return structured GitStatus
- [ ] Implement `GET /v1/git/diff` endpoint
  - Support staged and unstaged diffs
  - Detect file language
  - Handle binary files
- [ ] Add tests for git endpoints
- [ ] Add error handling for non-git repos

#### Frontend Foundation (Days 4-5)
- [ ] Create git store with Zustand
- [ ] Create TanStack Query hooks
- [ ] Add git API client in `packages/web/src/lib/api.ts`
- [ ] Create basic `GitSidebar.tsx` component structure
- [ ] Add sidebar toggle button to Header
- [ ] Implement collapsed/expanded states

### Phase 2: File List & Staging (Week 2)

#### File List UI (Days 1-3)
- [ ] Create `GitFileList.tsx` component
  - Staged section
  - Unstaged section
  - Untracked section
  - Collapsible sections
- [ ] Create `GitFileItem.tsx` component
  - Status icon with color coding
  - Checkbox for staging
  - File path display
  - Stats (+X -Y)
  - Hover and selected states
- [ ] Implement file selection logic
- [ ] Polish animations and transitions

#### Staging Operations (Days 4-5)
- [ ] Implement `POST /v1/git/stage` endpoint
- [ ] Implement `POST /v1/git/unstage` endpoint
- [ ] Wire up checkbox actions
- [ ] Add optimistic updates
- [ ] Handle errors gracefully
- [ ] Add loading states

### Phase 3: Diff Viewer (Week 3)

#### Diff UI (Days 1-4)
- [ ] Create `GitDiffViewer.tsx` component
  - Parse unified diff format
  - Line numbers
  - +/- indicators
  - Syntax highlighting (using existing highlighter)
  - Collapsible hunks
- [ ] Create `GitDiffPanel.tsx` wrapper
  - Sliding panel animation
  - Close button
  - ESC key handler
- [ ] Implement file switching in diff view
- [ ] Handle edge cases (empty diffs, binary files)

#### Integration (Day 5)
- [ ] Connect diff viewer to file list
- [ ] Manage view state (list vs diff)
- [ ] Optimize diff fetching (caching)
- [ ] Polish animations

### Phase 4: Commit Functionality (Week 4)

#### Commit Modal (Days 1-2)
- [ ] Create `GitCommitModal.tsx` component
  - Modal overlay with backdrop
  - Commit message textarea
  - Action buttons
  - Validation
- [ ] Implement `POST /v1/git/commit` endpoint
- [ ] Wire up manual commit flow
- [ ] Add success/error toasts
- [ ] Refresh git status after commit

#### AI Commit Message (Days 3-4)
- [ ] Implement `POST /v1/git/generate-commit-message` endpoint
  - Get staged diffs
  - Craft LLM prompt
  - Call configured model
  - Parse response
- [ ] Add "Generate" button to modal
- [ ] Show loading state during generation
- [ ] Add "Regenerate" button
- [ ] Handle errors and timeouts

#### Actions Component (Day 5)
- [ ] Create `GitActions.tsx` component
- [ ] Wire up "Generate Commit" button
- [ ] Wire up "Commit" button
- [ ] Add button states (disabled, loading)
- [ ] Polish UI

### Phase 5: Polish & Testing (Week 5)

#### Polish (Days 1-2)
- [ ] Add empty states
  - No git repository
  - No changes
  - All changes staged
- [ ] Add status badge in collapsed state
- [ ] Improve responsive behavior
- [ ] Add keyboard shortcuts (future: Cmd+K for commit)
- [ ] Improve accessibility (ARIA labels)
- [ ] Add tooltips where helpful

#### Testing (Days 3-4)
- [ ] Unit tests for git utilities
- [ ] Component tests for UI
- [ ] Integration tests for API
- [ ] E2E tests for full workflow
- [ ] Test error scenarios
- [ ] Test edge cases (large diffs, many files)

#### Documentation (Day 5)
- [ ] Update README with git sidebar docs
- [ ] Add inline code comments
- [ ] Update webapp-plan.md
- [ ] Create user guide
- [ ] Screen recording demo

---

## Future Enhancements (Post-MVP)

### Phase 6: Advanced Git Features

1. **Branch Management**
   - View all branches
   - Switch branches
   - Create new branch
   - Delete branch
   - Merge branches

2. **Commit History**
   - View commit log
   - View commit details
   - Diff between commits
   - Revert commits
   - Cherry-pick commits

3. **Remote Operations**
   - Pull from remote
   - Push to remote
   - Fetch updates
   - View remote branches
   - Conflict resolution UI

4. **Stash Management**
   - Stash changes
   - View stash list
   - Apply stash
   - Drop stash

5. **Advanced Staging**
   - Stage hunks (partial staging)
   - Stage lines
   - Interactive staging

6. **Git Blame**
   - View file blame
   - Navigate blame history
   - Jump to commit

### Phase 7: Session Files Tab

Once the Git tab is working, add a second tab for "Session Files":

- Files read/written during current session
- Independent from git status
- Filter by operation (read, write, modify)
- Show file access timeline
- Click to view file content or diff
- Helps track AI's file interactions

**Implementation:**
- Add `session_files` table (as described in earlier analysis)
- Track file operations in tool adapter
- Create `SessionFilesSidebar.tsx` component
- Add tab switcher: "Git" | "Session Files"
- API: `GET /v1/sessions/:id/files`

---

## Technical Considerations

### Performance

1. **Git Status Polling**
   - Only poll when sidebar is open
   - Cache results for 1 second
   - Debounce rapid file changes
   - Stop polling when sidebar closed

2. **Diff Loading**
   - Lazy load diffs (fetch on demand)
   - Cache diffs per file
   - Truncate very large diffs (>10K lines)
   - Show "View Full Diff" button for truncated

3. **Large Repositories**
   - Limit file list to 100 files
   - Show "X more files" if truncated
   - Virtualize file list for >50 files
   - Optimize git commands (--no-color, --no-pager)

### Security

1. **Path Validation**
   - Validate project root is within allowed directories
   - Prevent path traversal attacks
   - Sanitize file paths in git commands

2. **Command Injection**
   - Use execFile instead of exec
   - Escape all user inputs
   - Whitelist allowed git operations

3. **Rate Limiting**
   - Limit commit message generation (1 req/10s)
   - Limit git operations (10 req/s)
   - Return 429 if exceeded

### Error Handling

1. **Git Not Installed**
   - Detect git availability on startup
   - Show helpful error message
   - Provide installation link

2. **Not a Git Repo**
   - Detect early and show appropriate UI
   - Suggest `git init` command
   - Don't show sidebar button if no git

3. **Merge Conflicts**
   - Detect conflicted files
   - Mark in file list
   - Show conflict markers in diff
   - Provide resolution helpers (future)

4. **Detached HEAD**
   - Show warning badge
   - Explain state
   - Suggest actions

### Accessibility

1. **Keyboard Navigation**
   - Tab through file list
   - Space to toggle checkbox
   - Enter to view diff
   - ESC to close diff/modal
   - Arrow keys in modal textarea

2. **Screen Readers**
   - ARIA labels for all interactive elements
   - ARIA live regions for status updates
   - Semantic HTML structure
   - Focus management in modals

3. **High Contrast**
   - Sufficient color contrast (WCAG AA)
   - Not relying solely on color for status
   - Visible focus indicators

---

## Success Metrics

1. **Performance**
   - Git status loads in <500ms
   - Diff loads in <300ms
   - Sidebar animations are smooth (60fps)
   - No blocking operations

2. **Usability**
   - Users can view git status without leaving UI
   - Users can stage/unstage files with one click
   - Users can commit with AI-generated messages
   - Workflow is faster than CLI

3. **Reliability**
   - Git operations succeed >99% of time
   - Errors are handled gracefully
   - No data loss scenarios
   - State stays consistent

4. **Adoption**
   - 70%+ of users open git sidebar
   - 50%+ use AI commit generation
   - Positive user feedback
   - Reduced context switching

---

## Open Questions

1. **Commit Message Format**
   - Should we enforce conventional commits?
   - Allow custom templates?
   - Validate message format?

2. **Partial Staging**
   - Should MVP support staging hunks/lines?
   - Or defer to Phase 6?

3. **Push/Pull**
   - Include in MVP or Phase 6?
   - Auto-push after commit?

4. **Multi-Repo**
   - Support multiple projects?
   - Switch between repos?

5. **Git Config**
   - Read user.name and user.email?
   - Allow configuring from UI?

6. **Diff Truncation**
   - What's the max diff size to show?
   - Truncate at 1000 lines? 10K lines?

---

## Dependencies

### Backend
- `git` CLI (required)
- Existing Hono server infrastructure
- LLM provider (for commit message generation)

### Frontend
- React 18+
- Zustand (state management)
- TanStack Query (data fetching)
- Existing syntax highlighter
- Lucide React (icons)

### Development
- TypeScript 5+
- Vitest (testing)
- Playwright (E2E testing)

---

## Conclusion

This Git sidebar will transform the AGI web UI into a comprehensive development environment by:
1. Eliminating context switching between UI and terminal
2. Leveraging AI for better commit messages
3. Providing visual git status at a glance
4. Streamlining the commit workflow

The implementation is structured in clear phases, allowing for iterative development and early user feedback. The foundation is solid for future enhancements like branch management, commit history, and advanced git operations.

Once the Git tab is stable, we'll add the Session Files tab to complement it, providing full visibility into both git changes and AI-driven file modifications.
