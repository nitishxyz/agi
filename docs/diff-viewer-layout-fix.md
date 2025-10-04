# Diff Viewer Layout Fix

## Issue

The diff viewer was rendering on top of the left sidebar (sessions), covering it completely. It should only cover the middle content area and automatically collapse the left sidebar.

## Solution

### 1. ✅ **Auto-Collapse Left Sidebar When Diff Opens**

**Problem:**
- Diff viewer was using `position: absolute` on the main content area
- This caused it to overlay both the middle content AND the left sidebar
- User had to manually collapse the sidebar to see content properly

**Solution:**
- Added auto-collapse behavior when diff opens
- Saves the previous collapse state before auto-collapsing
- Restores the original state when diff closes
- User's manual preference is preserved

**Files Modified:**
- `apps/web/src/components/git/GitDiffPanel.tsx` - Added auto-collapse logic
- `apps/web/src/stores/sidebarStore.ts` - Added `wasCollapsedBeforeDiff` state
- `apps/web/src/components/layout/Sidebar.tsx` - Disabled manual toggle during diff

### 2. **Implementation Details**

#### SidebarStore Enhancement
```typescript
interface SidebarState {
  isCollapsed: boolean;
  wasCollapsedBeforeDiff: boolean | null; // NEW: Track state before diff
  // ... other methods
  setWasCollapsedBeforeDiff: (state: boolean | null) => void; // NEW
}

// Persistence: Only persist isCollapsed, not wasCollapsedBeforeDiff
partialize: (state) => ({
  isCollapsed: state.isCollapsed,
})
```

#### GitDiffPanel Auto-Collapse Logic
```typescript
useEffect(() => {
  const { isCollapsed } = useSidebarStore.getState();

  if (isDiffOpen) {
    // Save current state and collapse
    setWasCollapsedBeforeDiff(isCollapsed);
    setCollapsed(true);
  } else if (wasCollapsedBeforeDiff !== null) {
    // Restore previous state when diff closes
    setCollapsed(wasCollapsedBeforeDiff);
    setWasCollapsedBeforeDiff(null);
  }
}, [isDiffOpen, ...]);
```

#### Sidebar Button State
```typescript
<Button
  onClick={toggleCollapse}
  disabled={isDiffOpen} // Prevent manual toggle during diff
>
```

## Behavior

### Before Fix
```
┌──────────┬───────────────────────────┬──────────────┐
│Sessions  │                            │ Git Changes  │
│          │                            │              │
│ Session 1│  [DIFF COVERS EVERYTHING] │ ✓ file.tsx   │
│ Session 2│  [INCLUDING LEFT SIDEBAR] │   other.tsx  │
│          │                            │              │
└──────────┴───────────────────────────┴──────────────┘
           ↑ Left sidebar hidden under diff
```

### After Fix
```
┌──┬────────────────────────────────┬──────────────┐
│☰│  Diff Viewer                   │ Git Changes  │
│ │  [X Close]  file.tsx           │              │
│ │                                 │ ✓ file.tsx   │
│ │  +++ additions                  │   other.tsx  │
│ │  --- deletions                  │              │
│ │                                 │              │
└──┴────────────────────────────────┴──────────────┘
 ↑ Auto-collapsed to icon only
```

### After Closing Diff
```
┌──────────┬───────────────────────────┬──────────────┐
│Sessions ←│  Messages                  │ Git Changes  │
├──────────┤                            │              │
│ Session 1│                            │   file.tsx   │
│ Session 2│                            │   other.tsx  │
│          │                            │              │
└──────────┴───────────────────────────┴──────────────┘
 ↑ Restored to previous state (expanded or collapsed)
```

## User Flow

1. **User has sidebar expanded**
   - Click file in git sidebar → Diff opens
   - Sidebar auto-collapses to icon-only (w-12)
   - Diff covers middle content only
   - Close diff → Sidebar auto-expands back

2. **User has sidebar already collapsed**
   - Click file in git sidebar → Diff opens
   - Sidebar stays collapsed (already was)
   - Diff covers middle content only
   - Close diff → Sidebar stays collapsed (user preference preserved)

3. **Prevents accidental changes**
   - Collapse/expand buttons disabled while diff is open
   - User can't accidentally change sidebar state during diff viewing
   - Original preference is always restored

## Technical Benefits

1. **No Layout Jumping**: Smooth transitions between states
2. **Preserves User Intent**: Remembers if user wanted sidebar collapsed
3. **Better UX**: More screen space for diff viewing
4. **Consistent Behavior**: Predictable state management

## Build Status

✅ **TypeScript build**: Success  
✅ **Production build**: Success  
✅ **No errors**: All components properly typed  

## Files Modified

1. `apps/web/src/components/git/GitDiffPanel.tsx` (+15 lines)
2. `apps/web/src/stores/sidebarStore.ts` (+8 lines)
3. `apps/web/src/components/layout/Sidebar.tsx` (+4 lines)

**Total:** 3 files modified, ~27 lines changed

## Testing Checklist

- ✅ Open diff with sidebar expanded → Auto-collapses
- ✅ Close diff → Sidebar restores to expanded
- ✅ Open diff with sidebar collapsed → Stays collapsed
- ✅ Close diff → Sidebar stays collapsed
- ✅ Collapse button disabled during diff viewing
- ✅ ESC key closes diff and restores sidebar
- ✅ Click X button closes diff and restores sidebar
- ✅ Multiple diff open/close cycles work correctly

All tests passing! 🎉
