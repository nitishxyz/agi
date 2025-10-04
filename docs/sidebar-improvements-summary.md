# Sidebar Improvements Summary

## Changes Implemented

### 1. ✅ Added Header to Left Sidebar (Sessions)

**Problem:** The sessions sidebar had no header, making it inconsistent with the right sidebar.

**Solution:**
- Added a header with h-14 height (matching git sidebar)
- Added MessageSquare icon and "Sessions" title
- Added collapse button with ChevronLeft icon
- Consistent styling with the right sidebar

**File:** `apps/web/src/components/layout/Sidebar.tsx`

### 2. ✅ Added Collapse Functionality to Left Sidebar

**Problem:** The left sidebar couldn't be collapsed to save screen space.

**Solution:**
- Created new `sidebarStore` using Zustand with persist middleware
- When collapsed: Shows minimal 48px (w-12) sidebar with MessageSquare icon button
- When expanded: Shows full 256px (w-64) sidebar with content
- Persists collapse state across sessions
- Smooth transitions

**Files:**
- `apps/web/src/stores/sidebarStore.ts` (new)
- `apps/web/src/components/layout/Sidebar.tsx` (updated)

### 3. ✅ Moved Stage All Button to CHANGES Section

**Problem:** The "Stage All" button was in the git sidebar header, not contextually next to the files it affects.

**Solution:**
- Removed "Stage All" button from GitSidebar header
- Added "Stage All" button to the CHANGES section header in GitFileList
- Only shows when there are unstaged files
- Uses same CheckSquare icon and styling
- More intuitive placement next to the files being staged

**Files:**
- `apps/web/src/components/git/GitSidebar.tsx` (removed button)
- `apps/web/src/components/git/GitFileList.tsx` (added button)

## UI Layout

### Before
```
┌────────────────────────────────────────────────┐
│  Header                       [Files Toggle]   │
├──────────┬──────────────────────┬──────────────┤
│Sessions  │  Messages            │ Git Changes  │
│(no header│                      │ [Stage All]  │ ← In header
│          │                      ├──────────────┤
│ Session 1│                      │ Staged (2)   │
│ Session 2│                      │ Changes (3)  │
│          │                      │              │
└──────────┴──────────────────────┴──────────────┘
```

### After
```
┌────────────────────────────────────────────────┐
│  Header                       [Files Toggle]   │
├──────────┬──────────────────────┬──────────────┤
│Sessions←│  Messages            │ Git Changes←│ ← Headers aligned
├──────────┤                      ├──────────────┤
│ Session 1│                      │ Staged (2)   │
│ Session 2│                      │ Changes (3)  │
│          │                      │ [Stage All]  │ ← In section
└──────────┴──────────────────────┴──────────────┘
```

### Collapsed Left Sidebar
```
┌────────────────────────────────────────────────┐
│  Header                       [Files Toggle]   │
├──┬─────────────────────────────┬──────────────┤
│☰│←  Messages                   │ Git Changes←│
│ │                              ├──────────────┤
│ │                              │ Staged (2)   │
│ │                              │ Changes (3)  │
│ │                              │ [Stage All]  │
└──┴─────────────────────────────┴──────────────┘
   ↑ 48px collapsed sidebar with icon button
```

## Component Structure

### Sidebar Component
```typescript
// Left sidebar now has three states:
// 1. Hidden (when diff is open)
// 2. Collapsed (w-12, just icon button)
// 3. Expanded (w-64, full content)

interface SidebarProps {
  children: ReactNode;
}

// Uses:
// - gitStore: isDiffOpen → hide completely
// - sidebarStore: isCollapsed → show collapsed or expanded
```

### SidebarStore
```typescript
interface SidebarState {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

// Persists to localStorage: 'sidebar-storage'
// User preference maintained across sessions
```

## Technical Details

### Zustand Persist
- Used Zustand's persist middleware for sidebarStore
- Saves collapse state to localStorage
- Automatically rehydrates on page load
- Key: 'sidebar-storage'

### Height Consistency
- Both sidebars now have h-14 headers
- Aligned with main app header height
- Consistent visual hierarchy

### Icon Usage
- Left sidebar: MessageSquare icon
- Right sidebar: GitBranch icon
- Collapse button: ChevronLeft icon
- Stage button: CheckSquare icon

## Build Status

✅ TypeScript build: Success
✅ Production build: Success (1.4MB bundle)
✅ No new errors introduced
✅ All components properly typed

## Benefits

1. **Visual Consistency**: Both sidebars now have headers of the same height
2. **Screen Space**: Left sidebar can collapse to save space when not needed
3. **Better UX**: Stage All button is more discoverable in the CHANGES section
4. **Persistent State**: Sidebar collapse preference is remembered across sessions
5. **Intuitive Controls**: Stage All button is contextually placed with the files it affects

## Files Modified

### New Files
- `apps/web/src/stores/sidebarStore.ts` (21 lines)

### Modified Files
- `apps/web/src/components/layout/Sidebar.tsx` (+43 lines, -2 lines)
- `apps/web/src/components/git/GitFileList.tsx` (+26 lines, -2 lines)
- `apps/web/src/components/git/GitSidebar.tsx` (+10 lines, -34 lines)

**Total:** 1 new file, 3 modified files, ~100 lines changed

## Future Enhancements

- Add keyboard shortcut to toggle sidebar (e.g., Cmd/Ctrl + B)
- Add resizable sidebar width
- Add session count badge to collapsed sidebar icon
- Add tooltip hints for collapsed state buttons
