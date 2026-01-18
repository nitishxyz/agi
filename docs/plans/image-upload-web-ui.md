# Image Upload for Web UI

## Overview

Add image attachment support to the web chat interface with drag & drop, paste, and file picker functionality.

## UX Design

### Page-Wide Drag & Drop

When dragging files anywhere on the page, a full-screen overlay appears:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ┌─────────────────────┐                      │
│                    │      📷             │                      │
│                    │  Drop images here   │                      │
│                    │  PNG, JPEG, GIF...  │                      │
│                    └─────────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Input Layout (No Separator)

Images appear inside the input container, seamlessly above the textarea:

```
┌─────────────────────────────────────────────────┐
│ ⋮  [🖼️×] [🖼️×] [🖼️×]                            │  ← thumbnails
│    Type a message...                        [↑] │  ← textarea
└─────────────────────────────────────────────────┘
```

- Thumbnails: 48x48px, rounded-lg corners
- X button: appears on hover, top-right of thumbnail
- Drag anywhere on page to trigger overlay

### Constraints

| Limit | Value |
|-------|-------|
| Max images per message | 5 |
| Max file size | 5MB |
| Supported formats | PNG, JPEG, GIF, WebP |

### Interactions

- **Drag & Drop**: Drag files onto input area, blue overlay appears
- **Paste**: Ctrl/Cmd+V with image in clipboard
- **Click**: Optional image button (or click on empty preview area)
- **Remove**: Hover thumbnail → click X

## Implementation

### New Files

#### `packages/web-sdk/src/hooks/useImageUpload.ts`

```typescript
export interface ImageAttachment {
  id: string;
  file: File;
  preview: string;  // data URL for display
  data: string;     // base64 for API
  mediaType: string;
}

export function useImageUpload(maxImages = 5, maxSizeMB = 5) {
  // State: images, isDragging
  // Methods: addImages, removeImage, clearImages
  // Handlers: handleDragEnter, handleDragLeave, handleDragOver, handleDrop, handlePaste
}
```

### Modified Files

#### 1. `packages/web-sdk/src/types/api.ts`

```typescript
// Add to SendMessageRequest
export interface SendMessageRequest {
  content: string;
  images?: Array<{ data: string; mediaType: string }>;
  // ... existing fields
}
```

#### 2. `packages/web-sdk/src/components/chat/ChatInput.tsx`

- Accept `images`, `onImageRemove`, drag event handlers as props
- Render image preview row above textarea (no separator)
- Add drag overlay
- Add paste handler to textarea

#### 3. `packages/web-sdk/src/components/chat/ChatInputContainer.tsx`

- Use `useImageUpload` hook
- Pass images and handlers to `ChatInput`
- Include images in `sendMessage.mutateAsync()` call
- Clear images after send

#### 4. `packages/web-sdk/src/components/messages/UserMessageGroup.tsx`

- Render image parts from `message.parts`
- Display as thumbnails that can expand on click

#### 5. `packages/server/src/routes/session-messages.ts`

- Accept `images` array in request body
- Pass to message service

#### 6. `packages/server/src/runtime/message-service.ts`

- Insert image parts into `message_parts` table
- Type: 'image', content: JSON with data + mediaType

#### 7. `packages/server/src/runtime/history-builder.ts`

- Parse image parts from user messages
- Convert to AI SDK ImagePart format

## File Changes Summary

| File | Action |
|------|--------|
| `packages/web-sdk/src/hooks/useImageUpload.ts` | CREATE |
| `packages/web-sdk/src/hooks/index.ts` | MODIFY (export) |
| `packages/web-sdk/src/types/api.ts` | MODIFY |
| `packages/web-sdk/src/components/chat/ChatInput.tsx` | MODIFY |
| `packages/web-sdk/src/components/chat/ChatInputContainer.tsx` | MODIFY |
| `packages/web-sdk/src/components/messages/UserMessageGroup.tsx` | MODIFY |
| `packages/server/src/routes/session-messages.ts` | MODIFY |
| `packages/server/src/runtime/message-service.ts` | MODIFY |
| `packages/server/src/runtime/history-builder.ts` | MODIFY |

## Testing

1. Drag & drop single image
2. Drag & drop multiple images
3. Paste image from clipboard
4. Remove image before sending
5. Send message with images
6. Verify images appear in message thread
7. Verify images sent to LLM correctly
8. Test file size limit (reject >5MB)
9. Test max images limit (reject >5)
10. Test invalid file types (reject non-images)
