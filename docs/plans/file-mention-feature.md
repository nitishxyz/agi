# File Mention Feature - Implementation Plan

**Status:** Planning Complete  
**Target:** Web App with Full-Stack Integration  
**Created:** 2025-10-13

---

## 📋 Overview

Add `@` mention functionality to the web app's chat input, allowing users to reference files from the project directory with fuzzy search, keyboard navigation, and autocomplete.

### User Experience Flow

1. User types `@` in chat input → file picker popup appears
2. User types after `@` → fuzzy search filters files in real-time
3. Up/Down arrow keys navigate filtered results
4. Enter key selects file and completes path after `@`
5. Escape or click outside dismisses popup
6. Support multiple file mentions in one message

---

## 🎯 Requirements

### Functional Requirements

- **Trigger:** `@` character detection in chat input
- **Search:** Client-side fuzzy matching using existing `fuse.js` dependency
- **Navigation:** Keyboard controls (Up/Down/Enter/Escape)
- **Selection:** Replace `@query` with complete file path
- **Performance:** Handle 1000+ files smoothly
- **UX:** Responsive design (desktop + mobile)

### Non-Functional Requirements

- Files cached for 1 minute (React Query)
- Fuzzy search threshold: 0.4 (balanced sensitivity)
- Max 10 results displayed (scrollable)
- Popup positioned relative to cursor
- Accessibility: ARIA labels + keyboard-first

---

## 🏗️ Architecture

### Layer 1: Server API (`packages/server`)

#### New Route: `GET /v1/files`

**File:** `packages/server/src/routes/files.ts`

**Functionality:**
- Traverse project directory recursively
- Exclude common patterns (node_modules, .git, dist, build, etc.)
- Return relative paths from project root
- Respect .gitignore patterns (optional)

**Query Parameters:**
```typescript
{
  project?: string;  // Project root override (default: cwd)
  maxDepth?: number; // Directory traversal depth (default: 10)
  limit?: number;    // Max files to return (default: 1000)
}
```

**Response Schema:**
```typescript
{
  files: string[];      // Sorted array of relative paths
  truncated: boolean;   // True if result was limited
}
```

**Implementation Notes:**
- Use Node.js `fs.readdir` with recursive option
- Apply exclusion patterns similar to CLI glob tool
- Sort paths alphabetically
- Consider using existing tool utilities from CLI

**Exclusion Patterns:**
```typescript
const EXCLUDED_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  '.cache',
  '.DS_Store',
  '*.log',
  'bun.lockb',
  '.env',
  '.env.local',
];
```

**Integration Point:**
- Register in `packages/server/src/index.ts`:
  ```typescript
  import { registerFilesRoutes } from './routes/files.ts';
  registerFilesRoutes(app);
  ```

---

### Layer 2: OpenAPI Spec (`packages/server/src/openapi/`)

The OpenAPI spec now uses a **modular structure** with separate path files:

#### Directory Structure
```
packages/server/src/openapi/
├── spec.ts           # Main spec aggregator
├── helpers.ts        # Shared helpers (projectQueryParam, etc.)
├── schemas.ts        # Component schemas
└── paths/            # Path definitions by feature
    ├── ask.ts
    ├── config.ts
    ├── git.ts
    ├── messages.ts
    ├── sessions.ts
    ├── stream.ts
    └── files.ts      # NEW - Add this file
```

#### Step 1: Create Path Definition

**File:** `packages/server/src/openapi/paths/files.ts`

```typescript
import { projectQueryParam } from '../helpers';

export const filesPaths = {
  '/v1/files': {
    get: {
      tags: ['files'],
      operationId: 'listFiles',
      summary: 'List project files',
      description: 'Returns list of files in the project directory, excluding common build artifacts and dependencies',
      parameters: [
        projectQueryParam(),
        {
          in: 'query',
          name: 'maxDepth',
          required: false,
          schema: { type: 'integer', default: 10 },
          description: 'Maximum directory depth to traverse'
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', default: 1000 },
          description: 'Maximum number of files to return'
        }
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  files: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  truncated: { type: 'boolean' }
                },
                required: ['files', 'truncated']
              }
            }
          }
        }
      }
    }
  }
} as const;
```

#### Step 2: Import in Main Spec

**File:** `packages/server/src/openapi/spec.ts`

Add import at top:
```typescript
import { filesPaths } from './paths/files';
```

Add 'files' tag to tags array:
```typescript
tags: [
  { name: 'sessions' },
  { name: 'messages' },
  { name: 'stream' },
  { name: 'ask' },
  { name: 'config' },
  { name: 'git' },
  { name: 'files' }, // NEW
],
```

Add to paths spread:
```typescript
paths: {
  ...askPaths,
  ...sessionsPaths,
  ...messagesPaths,
  ...streamPaths,
  ...configPaths,
  ...gitPaths,
  ...filesPaths, // NEW
},
```

---

### Layer 3: API SDK Generation (`packages/api`)

#### Regeneration Workflow

1. Update OpenAPI spec in `packages/server/src/openapi/paths/files.ts`
2. Import in `packages/server/src/openapi/spec.ts`
3. Run: `bun run packages/api/generate.ts`
4. SDK auto-generates in `packages/api/src/generated/sdk.gen.ts`

**Generated Function Signature:**
```typescript
// Auto-generated in packages/api/src/generated/sdk.gen.ts
export function listFiles(
  options?: {
    query?: { 
      project?: string; 
      maxDepth?: number; 
      limit?: number; 
    }
  }
): Promise<{
  data?: { files: string[]; truncated: boolean };
  error?: ApiError;
}>
```

**No Manual Changes Required** - fully generated from OpenAPI spec.

---

### Layer 4: React Hook (`packages/web-sdk/src/hooks`)

#### New Hook: `useFiles`

**File:** `packages/web-sdk/src/hooks/useFiles.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { listFiles } from '@agi-cli/api';

export function useFiles() {
  return useQuery({
    queryKey: ['files'],
    queryFn: async () => {
      const { data, error } = await listFiles();
      if (error) throw error;
      return data!.files;
    },
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
}
```

**Export in:** `packages/web-sdk/src/hooks/index.ts`
```typescript
export { useFiles } from './useFiles';
```

---

### Layer 5: UI Components (`packages/web-sdk/src/components/chat`)

#### Component 1: FileMentionPopup

**File:** `packages/web-sdk/src/components/chat/FileMentionPopup.tsx`

**Props:**
```typescript
interface FileMentionPopupProps {
  files: string[];               // All available files
  query: string;                 // Current search query
  selectedIndex: number;         // Currently selected index
  onSelect: (file: string) => void;
  onClose: () => void;
  position: { top: number; left: number }; // Popup position
}
```

**Features:**
- Uses existing `fuse.js` for fuzzy search (already installed)
- Displays max 10 results (scrollable)
- Highlights matched characters
- Mobile responsive (full-width on small screens)
- Keyboard accessible (ARIA)

**Fuzzy Search Configuration:**
```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(files, {
  threshold: 0.4,        // Balanced sensitivity
  distance: 100,         // Max distance between matched chars
  ignoreLocation: true,  // Match anywhere in string
  includeMatches: true,  // For highlighting
});
```

**Styling:**
- Position: absolute (anchored to cursor)
- Max height: 300px (scrollable)
- Dark/light theme support
- Tailwind classes (follow existing patterns)

**Implementation Pattern:**
```typescript
export function FileMentionPopup({
  files,
  query,
  selectedIndex,
  onSelect,
  onClose,
  position,
}: FileMentionPopupProps) {
  const fuse = useMemo(
    () => new Fuse(files, {
      threshold: 0.4,
      distance: 100,
      ignoreLocation: true,
      includeMatches: true,
    }),
    [files],
  );

  const results = useMemo(() => {
    if (!query) return files.slice(0, 10).map(path => ({ item: path }));
    return fuse.search(query).slice(0, 10);
  }, [fuse, query, files]);

  useEffect(() => {
    const element = document.getElementById(`file-item-${selectedIndex}`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      className="absolute bg-card border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto z-50"
      style={{ top: position.top, left: position.left }}
    >
      {results.map((result, index) => (
        <button
          key={result.item}
          id={`file-item-${index}`}
          onClick={() => onSelect(result.item)}
          className={`w-full text-left px-3 py-2 hover:bg-accent ${
            index === selectedIndex ? 'bg-accent' : ''
          }`}
        >
          <span className="font-mono text-sm">{result.item}</span>
        </button>
      ))}
    </div>
  );
}
```

---

#### Component 2: Enhanced ChatInput

**File:** `packages/web-sdk/src/components/chat/ChatInput.tsx` (modify existing)

**State Additions:**
```typescript
const [showFileMention, setShowFileMention] = useState(false);
const [mentionQuery, setMentionQuery] = useState('');
const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
const [mentionCursorPosition, setMentionCursorPosition] = useState({ top: 0, left: 0 });

const { data: files = [], isLoading: filesLoading } = useFiles();
```

**Core Logic:**

1. **Detect `@` trigger:**
```typescript
const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
  const value = e.target.value;
  setMessage(value);

  const cursorPos = e.target.selectionStart;
  const textBeforeCursor = value.slice(0, cursorPos);
  const match = textBeforeCursor.match(/@(\S*)$/);

  if (match) {
    setShowFileMention(true);
    setMentionQuery(match[1]);
    setMentionSelectedIndex(0);
    updateMentionPosition(e.target, cursorPos);
  } else {
    setShowFileMention(false);
  }
}, []);
```

2. **Keyboard navigation:**
```typescript
const handleKeyDown = useCallback(
  (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showFileMention) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => 
          Math.min(prev + 1, filteredFiles.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredFiles.length > 0) {
        e.preventDefault();
        handleFileSelect(filteredFiles[mentionSelectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowFileMention(false);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const newPlanMode = !isPlanMode;
      setIsPlanMode(newPlanMode);
      onPlanModeToggle?.(newPlanMode);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  },
  [showFileMention, filteredFiles, mentionSelectedIndex, isPlanMode, onPlanModeToggle, handleSend],
);
```

3. **File selection:**
```typescript
const handleFileSelect = useCallback((filePath: string) => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const value = textarea.value;
  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = value.slice(0, cursorPos);
  
  const match = textBeforeCursor.match(/@(\S*)$/);
  if (!match) return;

  const atPos = cursorPos - match[0].length;
  const newValue = 
    value.slice(0, atPos) + 
    `@${filePath} ` + 
    value.slice(cursorPos);

  setMessage(newValue);
  setShowFileMention(false);

  setTimeout(() => {
    const newCursorPos = atPos + filePath.length + 2;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  }, 0);
}, []);
```

4. **Position calculation:**
```typescript
function updateMentionPosition(
  textarea: HTMLTextAreaElement,
  cursorPos: number
) {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.font = computed.font;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.width = computed.width;
  
  mirror.textContent = textarea.value.substring(0, cursorPos);
  const caretSpan = document.createElement('span');
  caretSpan.textContent = '|';
  mirror.appendChild(caretSpan);
  
  document.body.appendChild(mirror);
  
  const rect = textarea.getBoundingClientRect();
  const caretRect = caretSpan.getBoundingClientRect();
  
  setMentionCursorPosition({
    top: caretRect.top - rect.top + 30,
    left: caretRect.left - rect.left,
  });
  
  document.body.removeChild(mirror);
}
```

**Render Addition:**
```typescript
return (
  <div className="absolute bottom-0 left-0 right-0 ...">
    <div className="max-w-3xl mx-auto ...">
      {/* Existing input UI */}
      
      {/* File mention popup */}
      {showFileMention && !filesLoading && (
        <FileMentionPopup
          files={files}
          query={mentionQuery}
          selectedIndex={mentionSelectedIndex}
          onSelect={handleFileSelect}
          onClose={() => setShowFileMention(false)}
          position={mentionCursorPosition}
        />
      )}
    </div>
  </div>
);
```

---

## 📊 Data Flow

```
User types @ in ChatInput
    ↓
ChatInput.handleChange detects @ trigger
    ↓
useFiles hook fetches files (cached 1 min)
    ↓
API: GET /v1/files
    ↓
Server traverses project directory
    ↓
Returns sorted file list
    ↓
ChatInput shows FileMentionPopup
    ↓
User types "src/c" after @
    ↓
Fuse.js filters files client-side
    ↓
Popup shows top 10 matches
    ↓
User navigates with arrow keys
    ↓
User presses Enter
    ↓
ChatInput.handleFileSelect replaces @query
    ↓
Popup closes, cursor positioned after file path
```

---

## 🧪 Implementation Checklist

### Phase 1: Backend (Server + API)
- [ ] Create `packages/server/src/routes/files.ts`
  - [ ] Implement directory traversal with exclusions
  - [ ] Add query parameter handling (project, maxDepth, limit)
  - [ ] Export `registerFilesRoutes(app)` function
  - [ ] Test with curl/Postman
- [ ] Create `packages/server/src/openapi/paths/files.ts`
  - [ ] Define filesPaths export with /v1/files endpoint
  - [ ] Use projectQueryParam() helper
  - [ ] Define request/response schemas
- [ ] Update `packages/server/src/openapi/spec.ts`
  - [ ] Import filesPaths from './paths/files'
  - [ ] Add 'files' tag to tags array
  - [ ] Spread filesPaths in paths object
- [ ] Register route in `packages/server/src/index.ts`
  - [ ] Import and call `registerFilesRoutes(app)`
- [ ] Generate API SDK
  - [ ] Run `bun run packages/api/generate.ts`
  - [ ] Verify `listFiles` function in generated SDK
  - [ ] Test generated types

### Phase 2: React Hook
- [ ] Create `packages/web-sdk/src/hooks/useFiles.ts`
  - [ ] Implement useQuery with React Query
  - [ ] Add 1-minute cache (staleTime: 60000)
  - [ ] Handle errors gracefully
- [ ] Export in `packages/web-sdk/src/hooks/index.ts`
- [ ] Test hook in isolation

### Phase 3: FileMentionPopup Component
- [ ] Create `packages/web-sdk/src/components/chat/FileMentionPopup.tsx`
  - [ ] Implement fuzzy search with Fuse.js (already installed)
  - [ ] Add keyboard navigation (scroll into view)
  - [ ] Style with Tailwind (dark/light themes)
  - [ ] Add match highlighting
  - [ ] Handle empty states
- [ ] Test component in Storybook/isolation

### Phase 4: ChatInput Integration
- [ ] Modify `packages/web-sdk/src/components/chat/ChatInput.tsx`
  - [ ] Add state for mention popup
  - [ ] Import and use `useFiles` hook
  - [ ] Implement @ detection in handleChange
  - [ ] Add keyboard navigation (prioritize over existing handlers)
  - [ ] Implement file selection logic
  - [ ] Calculate popup position (mirror div technique)
  - [ ] Integrate FileMentionPopup render
- [ ] Handle edge cases:
  - [ ] Multiple @ symbols in message
  - [ ] @ at start/middle/end of line
  - [ ] Backspace over file mention
  - [ ] Escape to cancel
  - [ ] Click outside to close

### Phase 5: Testing & Polish
- [ ] Test on desktop (Chrome, Firefox, Safari)
- [ ] Test on mobile (iOS Safari, Chrome Android)
- [ ] Test with 1000+ files (performance)
- [ ] Test keyboard navigation flow
- [ ] Test accessibility (screen readers, ARIA)
- [ ] Test dark/light themes
- [ ] Add loading states
- [ ] Add error states (API failures)

---

## 🎨 Design Specifications

### Popup Styling
- **Background:** `bg-card` (theme-aware)
- **Border:** `border border-border` (1px solid)
- **Shadow:** `shadow-lg` (elevated)
- **Border Radius:** `rounded-lg` (8px)
- **Max Height:** `max-h-[300px]` (300px with scroll)
- **Width:** Match input width on desktop, full-width on mobile (<640px)
- **Z-Index:** `z-50` (above input, below modals)

### File Item
- **Height:** `py-2` (min 44px for touch)
- **Padding:** `px-3 py-2`
- **Font:** `font-mono text-sm` (code style)
- **Hover:** `hover:bg-accent`
- **Selected:** `bg-accent`
- **Color:** `text-foreground` (theme-aware)

### Position
- **Desktop:** Below cursor, left-aligned
- **Mobile:** Full-width, bottom of viewport
- **Offset:** 30px below cursor line

### Responsive Breakpoints
```typescript
className={`
  md:absolute md:w-auto
  fixed bottom-0 left-0 right-0 md:relative
`}
```

---

## 🚀 Future Enhancements (Out of Scope)

- File icons by extension (React, TS, etc.)
- Recently mentioned files at top
- Support for `@folder/` to list folder contents
- File preview on hover
- Git status indicators (modified, staged)
- Line number support (`@file.ts:123`)
- Image thumbnails for image files
- Syntax highlighting in preview

---

## 📚 Dependencies

### Existing (Already Installed)
- `fuse.js@^7.1.0` - Fuzzy search (already in project)
- `@tanstack/react-query` - Data fetching (already in web-sdk)
- `lucide-react` - Icons (already in web-sdk)

### New Dependencies
- **None** - Feature uses existing dependencies

---

## 🔍 Reference Implementations

### Similar Patterns in Codebase
- **Select Components:** `UnifiedModelSelector`, `UnifiedAgentSelector` use fuzzy search
- **Keyboard Navigation:** Existing in config modal
- **Popup Positioning:** See dropdown patterns in web-sdk

### File Traversal Reference
- CLI glob tool pattern (apps/cli/src/ask/run.ts)
- Exclusion patterns used in tree command

---

## 📝 Notes

- **Performance:** Client-side fuzzy search is fast for 1000+ files
- **Caching:** 1-minute cache prevents excessive server calls
- **Accessibility:** Keyboard-first design, ARIA labels required
- **Mobile:** Consider bottom sheet on small screens
- **Convention:** Follow existing Biome linting rules
- **Modular OpenAPI:** Use separate path files under `packages/server/src/openapi/paths/`
- **No commits:** Implementation only, no automatic commits

---

## 🎯 Success Criteria

1. ✅ User can type `@` to trigger file picker
2. ✅ Fuzzy search filters files in real-time
3. ✅ Keyboard navigation works smoothly (Up/Down/Enter/Escape)
4. ✅ Selected file path inserted correctly
5. ✅ Works on desktop and mobile browsers
6. ✅ Supports 1000+ files without lag
7. ✅ Respects theme (dark/light)
8. ✅ Accessible (keyboard + screen readers)

---

**Ready for Implementation** ✓
