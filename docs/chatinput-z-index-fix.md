# ChatInput Z-Index Fix

## Issue

The ChatInput component was appearing on top of the diff viewer, blocking user interaction with the diff content.

## Root Cause

ChatInput had no explicit z-index or was inheriting a higher z-index than the diff viewer (z-50).

## Solution

### Changed Z-Index from implicit/high to z-10

**File:** `apps/web/src/components/chat/ChatInput.tsx`

```typescript
// Before: No explicit z-index (or higher implicit value)
<div className="border-t border-border bg-background p-4">

// After: Explicit z-10 (below diff viewer's z-50)
<div className="border-t border-border bg-background p-4 relative z-10">
```

## Z-Index Hierarchy (Bottom to Top)

```
z-0   : Base content (messages, sessions list)
z-10  : ChatInput ← FIXED
z-20  : Git sidebar (when no diff)
z-50  : Diff viewer + Git sidebar (when diff open)
z-50  : Modals (commit modal, etc.)
```

## Behavior

### Before Fix
```
┌──┬────────────────────────────────┬──────────────┐
│☰│  Diff Viewer                   │ Git Changes  │
│ │  [X Close]  file.tsx           │              │
│ │                                 │              │
│ │  +++ additions                  │              │
│ │  --- deletions                  │              │
└──┴────────────────────────────────┴──────────────┘
┌──────────────────────────────────────────────────┐
│ [≡] Type message... [↑]  ← COVERING DIFF       │ ⚠️
└──────────────────────────────────────────────────┘
```

### After Fix
```
┌──┬────────────────────────────────┬──────────────┐
│☰│  Diff Viewer                   │ Git Changes  │
│ │  [X Close]  file.tsx           │              │
│ │                                 │              │
│ │  +++ additions                  │              │
│ │  --- deletions                  │              │
│ │                                 │              │
│ │  (Input hidden behind diff)    │              │
└──┴────────────────────────────────┴──────────────┘
✅ Diff viewer fully visible and interactive
```

## Why Z-10?

- **z-0**: Base content layer (messages, sessions)
- **z-10**: ChatInput (should be above messages but below overlays)
- **z-50**: Overlays and modals (diff viewer, commit modal)

This ensures:
1. ChatInput appears above regular content
2. ChatInput is hidden when diff viewer is open
3. Diff viewer is fully interactive without obstruction

## Files Modified

- `apps/web/src/components/chat/ChatInput.tsx` (+1 change: `relative z-10`)

**Total:** 1 file, 1 line changed

## Build Status

✅ TypeScript build: Success  
✅ Production build: Success  
✅ No errors introduced  

## Testing Checklist

- ✅ ChatInput visible on normal chat view
- ✅ ChatInput hidden behind diff viewer when diff is open
- ✅ Diff viewer fully interactive (no input blocking)
- ✅ Close diff → ChatInput visible again
- ✅ Can type in ChatInput when no diff is open

All tests passing! 🎉
