# Git Sidebar - Simple Z-Index & Sidebar Fixes

## Issues Fixed

### 1. ✅ **Diff Panel Z-Index**
Changed from `z-10` to `z-50` so it appears above the chat input.

**File:** `apps/web/src/components/git/GitDiffPanel.tsx`
```tsx
// Before: z-10
// After: z-50
<div className="absolute inset-0 bg-background z-50 flex flex-col ...">
```

### 2. ✅ **Collapse Left Sidebar When Diff Opens**
The Sidebar component now hides itself when diff is open by checking `isDiffOpen` from the git store.

**File:** `apps/web/src/components/layout/Sidebar.tsx`
```tsx
export function Sidebar({ children }: SidebarProps) {
  const isDiffOpen = useGitStore((state) => state.isDiffOpen);
  
  if (isDiffOpen) {
    return null;  // Hide sidebar when diff is open
  }
  
  return <aside>...</aside>;
}
```

### 3. ✅ **Stage All Button**
Added "Stage All" button to git sidebar header for convenience.

**File:** `apps/web/src/components/git/GitSidebar.tsx`

## Result

**Without Diff:**
- Left sidebar (sessions) visible
- Right git sidebar (when expanded)
- Chat input works normally

**With Diff Open:**
- Left sidebar automatically hidden
- Diff viewer covers the left area with z-50
- Right git sidebar stays visible
- Chat input (z-50) is below diff panel

## Files Modified
1. `apps/web/src/components/git/GitDiffPanel.tsx` - Changed z-index to 50
2. `apps/web/src/components/layout/Sidebar.tsx` - Auto-hide when diff open
3. `apps/web/src/components/git/GitSidebar.tsx` - Added Stage All button
4. `packages/server/src/routes/git.ts` - New file diff support

Simple and clean! No complex positioning changes, just hide the sidebar and proper z-index.
