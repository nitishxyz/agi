# Git Sidebar - API Response Unwrapping Fix

## Issue

After fixing the 500 error and excessive polling, the git sidebar showed "No changes detected" even though there were modified files in the repository.

## Root Cause

The server API returns responses wrapped in `{ status: 'ok', data: {...} }`, but the frontend API client was directly returning the full response instead of unwrapping it.

**Server Response:**
```json
{
  "status": "ok",
  "data": {
    "branch": "main",
    "ahead": 0,
    "behind": 1,
    "staged": [],
    "unstaged": [...],
    "untracked": [...]
  }
}
```

**Frontend Expected:**
```typescript
{
  branch: "main",
  ahead: 0,
  behind: 1,
  staged: [],
  unstaged: [...],
  untracked: [...]
}
```

## Solution

### 1. Updated API Client to Unwrap Responses

**File:** `apps/web/src/lib/api-client.ts`

Changed all git methods to unwrap the `data` property:

```typescript
// Before
async getGitStatus(): Promise<GitStatusResponse> {
  return this.request<GitStatusResponse>('/v1/git/status');
}

// After
async getGitStatus(): Promise<GitStatusResponse> {
  const response = await this.request<{
    status: string;
    data: GitStatusResponse;
  }>('/v1/git/status');
  return response.data;  // ✅ Unwrap data
}
```

Applied to all git methods:
- `getGitStatus()`
- `getGitDiff()`
- `stageFiles()`
- `unstageFiles()`
- `commitChanges()`
- `getGitBranch()`

### 2. Fixed Type Mismatches

**File:** `apps/web/src/types/api.ts`

Updated types to match actual server responses:

```typescript
// GitStatusResponse
- branch: string | null;       → branch: string;
- upstream: string | null;     → (removed - not in status response)
+ hasChanges: boolean;

// GitDiffResponse
- path: string;                → file: string;
- isBinary: boolean;           → binary: boolean;

// GitFileStatus
- insertions: number;          → insertions?: number;
- deletions: number;           → deletions?: number;

// GitStageResponse/GitUnstageResponse
+ failed: string[];            → (added missing field)

// GitBranchInfo
- branches: string[];          → all: string[];
```

### 3. Updated Components to Handle Optional Fields

**File:** `apps/web/src/components/git/GitFileItem.tsx`

Changed from accessing `file.insertions` directly to checking for undefined:

```typescript
// Before
{(file.insertions > 0 || file.deletions > 0) && (
  // ...stats
)}

// After
{file.insertions !== undefined || file.deletions !== undefined ? (
  <div className="flex items-center gap-2 text-xs flex-shrink-0">
    {file.insertions !== undefined && file.insertions > 0 && (
      <span className="text-green-500">+{file.insertions}</span>
    )}
    {file.deletions !== undefined && file.deletions > 0 && (
      <span className="text-red-500">-{file.deletions}</span>
    )}
  </div>
) : null}
```

**File:** `apps/web/src/components/git/GitDiffViewer.tsx`

Changed property names to match types:
- `diff.isBinary` → `diff.binary`
- `diff.path` → `diff.file`

## Result

✅ Git sidebar now correctly displays all modified files  
✅ File staging/unstaging works  
✅ Diff viewer shows diffs correctly  
✅ Commit functionality works  
✅ All TypeScript types are correct  
✅ Build succeeds with no errors  

## Testing

1. Modified files in the repo are now visible in the git sidebar
2. Can stage/unstage files by clicking checkboxes
3. Can view diffs by clicking on files
4. Can commit staged changes
5. Branch info displays correctly with ahead/behind counts

## Summary of All Fixes

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| 500 Error | Missing `project` param | Made optional with `process.cwd()` default |
| Excessive Polling | Always polling every 3s | Conditional polling only when sidebar expanded |
| No Changes Shown | API response not unwrapped | Unwrap `data` property in API client |
| Type Errors | Types didn't match server | Updated all git-related types to match server response |

All git sidebar features are now fully functional! 🎉
