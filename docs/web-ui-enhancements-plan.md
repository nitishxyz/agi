# Web UI Enhancements Plan

## Overview
This document outlines the implementation plan for two major feature sets for the AGI web UI:
1. **File Changes Viewer** - A sidebar showing git changes with diff visualization
2. **Smart Input with @mentions and /commands** - Enhanced input with file/directory mentions and command palette

---

## Feature 1: File Changes Sidebar

### User Experience
A collapsible right sidebar that displays file changes in the current project, showing git status and allowing users to view diffs.

### UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Header [Theme] [New Session]                         [▼ Files] │
├──────────┬──────────────────────────────────┬──────────────────┤
│          │                                   │                  │
│ Sessions │  Message Thread                   │  File Changes    │
│ List     │                                   │                  │
│          │                                   │  M src/App.tsx   │
│ ┌──────┐ │  [Messages...]                   │  A new-file.ts   │
│ │Active│ │                                   │  D old.ts        │
│ └──────┘ │                                   │                  │
│          │                                   │  [View Diff ▼]   │
│          │                                   │                  │
│          │                                   │  ┌────────────┐  │
│          │  [Chat Input]                     │  │ Diff View  │  │
│          │                                   │  │ +added     │  │
│          │                                   │  │ -removed   │  │
│          │                                   │  └────────────┘  │
└──────────┴──────────────────────────────────┴──────────────────┘
```

### Components Structure

```typescript
components/
├── files/
│   ├── FileChangesSidebar.tsx      // Main sidebar container
│   ├── FileChangesList.tsx         // List of changed files
│   ├── FileChangeItem.tsx          // Individual file entry
│   ├── DiffViewer.tsx              // Diff visualization component
│   └── DiffPanel.tsx               // Expandable diff panel
```

### Component Specifications

#### FileChangesSidebar.tsx
```typescript
interface FileChangesSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessionId?: string;
}

// Features:
// - Collapsible sidebar (toggle button in header)
// - Width: 320px-400px (resizable in future)
// - Smooth slide-in/out animation
// - Shows loading state while fetching changes
// - Empty state when no changes detected
```

#### FileChangeItem.tsx
```typescript
interface FileChangeItemProps {
  file: FileChange;
  onViewDiff: (file: FileChange) => void;
  isSelected: boolean;
}

interface FileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  insertions?: number;
  deletions?: number;
  diff?: string;
}

// Visual elements:
// - Status icon (M/A/D/R) with color coding
// - File path (truncated with tooltip)
// - Stats: +X/-Y lines
// - Hover state to show diff preview
// - Click to expand inline diff
```

#### DiffViewer.tsx
```typescript
interface DiffViewerProps {
  diff: string;
  fileName: string;
  language?: string;
}

// Features:
// - Syntax highlighting for code
// - Line numbers
// - +/- indicators with color coding
// - Collapsible hunks
// - Copy button
// - Expand context lines (future)
```

### Server API Requirements

#### New Endpoint: GET /v1/files/changes
```typescript
// Request
GET /v1/files/changes?project=/path/to/project&sessionId=<id>

// Response
{
  "changes": [
    {
      "path": "src/App.tsx",
      "status": "modified",
      "insertions": 15,
      "deletions": 3
    }
  ],
  "staged": 2,
  "unstaged": 3,
  "untracked": 1
}
```

#### New Endpoint: GET /v1/files/diff
```typescript
// Request
GET /v1/files/diff?project=/path/to/project&file=src/App.tsx

// Response
{
  "file": "src/App.tsx",
  "diff": "diff --git a/src/App.tsx b/src/App.tsx\n...",
  "insertions": 15,
  "deletions": 3,
  "language": "typescript"
}
```

### State Management

```typescript
// Using TanStack Query
const { data: fileChanges } = useFileChanges(projectRoot);
const { data: diff } = useFileDiff(projectRoot, selectedFile);

// Zustand store for UI state
interface FilesStore {
  isOpen: boolean;
  selectedFile: string | null;
  toggleSidebar: () => void;
  selectFile: (path: string | null) => void;
}
```

### Styling & Colors

```css
/* Status colors */
.file-modified { color: #f59e0b; } /* amber-500 */
.file-added { color: #10b981; }    /* emerald-500 */
.file-deleted { color: #ef4444; }  /* red-500 */
.file-renamed { color: #3b82f6; }  /* blue-500 */

/* Diff colors */
.diff-addition { background: rgba(16, 185, 129, 0.15); }  /* emerald with opacity */
.diff-deletion { background: rgba(239, 68, 68, 0.15); }   /* red with opacity */
.diff-line-number { color: #71717a; } /* zinc-500 */
```

---

## Feature 2: Smart Input (@mentions & /commands)

### User Experience
Enhanced chat input with:
- **@mentions** - Autocomplete for files/directories to provide context
- **/commands** - Quick access to predefined commands (model selection, compact mode, etc.)

### UI Design

```
┌─────────────────────────────────────────────────┐
│  Message Thread                                  │
│                                                  │
└──────────────────────────────────────────────────┘
                    ┌────────────────────────────┐
                    │ /model                     │  ← Command popup
                    │ /agent                     │
                    │ /compact                   │
                    │ /clear                     │
                    └────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ [≡] /mo|                                    [↑] │  ← Input
└──────────────────────────────────────────────────┘

                    ┌────────────────────────────┐
                    │ @src/App.tsx              📄│  ← File mention popup
                    │ @src/components/          📁│
                    │ @package.json             📄│
                    └────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ [≡] Review @src/A|                          [↑] │
└──────────────────────────────────────────────────┘
```

### Components Structure

```typescript
components/
├── chat/
│   ├── ChatInput.tsx                 // Enhanced input (existing)
│   ├── MentionAutocomplete.tsx       // @mention popup
│   ├── CommandPalette.tsx            // /command popup
│   ├── ModelSelector.tsx             // Model selection submenu
│   └── InputToolbar.tsx              // Toolbar with mention/command triggers
```

### Feature 2A: @mentions for Files/Directories

#### Behavior
1. User types `@` → Popup appears above input
2. Continue typing → Filters results fuzzy-match style
3. Arrow keys to navigate, Enter to select
4. Selected items appear as pills/chips in input
5. Can mention multiple files/directories
6. Backend receives list of mentioned paths for context

#### MentionAutocomplete.tsx
```typescript
interface MentionAutocompleteProps {
  query: string;              // Text after @
  position: { x: number; y: number };
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  projectRoot: string;
}

interface MentionItem {
  type: 'file' | 'directory';
  path: string;
  relativePath: string;
  icon: string;
}

// Features:
// - Max 10-15 results
// - Shows file/directory icons
// - Keyboard navigation (↑↓ + Enter)
// - Click to select
// - Shows relative paths
// - Highlights matching characters
// - Debounced search
```

#### Mention Pills in Input
```typescript
// Visual representation of selected mentions
interface MentionPill {
  id: string;
  path: string;
  type: 'file' | 'directory';
}

// Renders as:
// <span class="mention-pill">
//   <FileIcon /> src/App.tsx <X />
// </span>

// Styling:
// - Rounded background
// - Slightly elevated (border)
// - Remove button (X)
// - Different colors for file vs directory
```

### Feature 2B: /commands (Command Palette)

#### Behavior
1. Input is empty or starts with `/` → Show command palette
2. Type to filter commands
3. Select command → Auto-fill or execute
4. `/model` shows secondary menu with all available models across all authenticated providers

#### CommandPalette.tsx
```typescript
interface CommandPaletteProps {
  query: string;              // Text after /
  position: { x: number; y: number };
  onSelect: (command: Command) => void;
  onClose: () => void;
  currentConfig: ChatConfig;
}

interface Command {
  name: string;               // e.g., "model", "compact"
  trigger: string;            // e.g., "/model", "/compact"
  description: string;
  icon?: string;
  category: 'config' | 'action' | 'custom';
  execute?: (params?: string) => void | Promise<void>;
  inline?: boolean;           // If true, inserts into message; else executes immediately
}

// Built-in commands:
const BUILT_IN_COMMANDS: Command[] = [
  {
    name: 'Model',
    trigger: '/model',
    description: 'Change AI model (all providers)',
    category: 'config',
    // Opens ModelSelector submenu
  },
  {
    name: 'Agent',
    trigger: '/agent',
    description: 'Change agent',
    category: 'config',
  },
  {
    name: 'Compact',
    trigger: '/compact',
    description: 'Toggle compact message view',
    category: 'config',
    execute: () => toggleCompactMode(),
  },
  {
    name: 'Clear',
    trigger: '/clear',
    description: 'Clear current session',
    category: 'action',
    execute: () => clearSession(),
  },
  {
    name: 'Export',
    trigger: '/export',
    description: 'Export session',
    category: 'action',
  },
  {
    name: 'New',
    trigger: '/new',
    description: 'New session',
    category: 'action',
  },
];
```

#### ModelSelector.tsx (Submenu for /model)
```typescript
interface ModelSelectorProps {
  query: string;              // Filter query
  onSelect: (model: ModelOption) => void;
  onBack: () => void;
  currentModel?: string;
  authenticatedProviders: string[];
}

interface ModelOption {
  id: string;                 // e.g., "claude-3-5-sonnet-20241022"
  name: string;               // Display name
  provider: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'opencode';
  description?: string;
  isAvailable: boolean;       // Based on authentication
}

// Features:
// - Shows models grouped by provider
// - Only shows providers user has authenticated with
// - Search/filter across all models
// - Indicates current model
// - Shows model descriptions
// - "Back" button to return to main command palette

// Example UI:
/*
┌────────────────────────────────────┐
│ ← Back     Select Model            │
├────────────────────────────────────┤
│ Search: claude|                    │
├────────────────────────────────────┤
│ Anthropic                          │
│  ● claude-3-5-sonnet-20241022 ✓   │
│    claude-3-5-haiku-20241022       │
│    claude-3-opus-20240229          │
│                                    │
│ OpenAI                             │
│    gpt-4-turbo                     │
│    gpt-4                           │
│                                    │
│ OpenRouter                         │
│    anthropic/claude-3.5-sonnet     │
└────────────────────────────────────┘
*/
```

#### Command Categories
```typescript
// Config Commands (modify session settings)
- /model                // Shows model picker (all authenticated providers)
- /agent [name]         // Switch agent (general, code, etc.)
- /compact              // Toggle compact view

// Action Commands (perform operations)
- /clear                // Clear session messages
- /export               // Export session
- /new                  // New session
- /help                 // Show help

// Custom Commands (from CLI commands.ts discovery)
// Load from server via API
- /commit               // Git commit helper
- /review               // Code review
- [any discovered command]
```

#### Menu Button Integration
```typescript
// The menu button (≡) should also show command palette
// Same CommandPalette component, different trigger

interface MenuButtonProps {
  onCommandSelect: (command: Command) => void;
}

// Shows full categorized list (not filtered)
// Future: Add settings, preferences, etc.
```

### Server API Requirements

#### New Endpoint: GET /v1/files/search
```typescript
// Request
GET /v1/files/search?project=/path/to/project&q=App&limit=15

// Response
{
  "results": [
    {
      "path": "/absolute/path/to/src/App.tsx",
      "relativePath": "src/App.tsx",
      "type": "file",
      "size": 1234,
      "language": "typescript"
    },
    {
      "path": "/absolute/path/to/src/components",
      "relativePath": "src/components",
      "type": "directory"
    }
  ]
}

// Implementation:
// - Use ripgrep or fast file system search
// - Fuzzy matching (fzf-like)
// - Respect .gitignore
// - Return both files and directories
// - Limit results (default 15)
```

#### New Endpoint: GET /v1/commands
```typescript
// Request
GET /v1/commands?project=/path/to/project

// Response
{
  "commands": [
    {
      "name": "commit",
      "trigger": "/commit",
      "description": "Generate git commit message",
      "agent": "code",
      "category": "custom",
      "promptTemplate": "Generate commit message for staged changes"
    },
    {
      "name": "review",
      "trigger": "/review",
      "description": "Code review assistant",
      "agent": "code",
      "category": "custom"
    }
  ]
}

// Implementation:
// - Call existing discoverCommands() from apps/cli/src/commands.ts
// - Format as web-friendly Command objects
// - Cache results (invalidate on file changes in .agi/commands/)
```

#### New Endpoint: GET /v1/models
```typescript
// Request
GET /v1/models

// Response
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "isAuthenticated": true,
      "models": [
        {
          "id": "claude-3-5-sonnet-20241022",
          "name": "Claude 3.5 Sonnet",
          "description": "Most intelligent model",
          "contextWindow": 200000
        },
        {
          "id": "claude-3-5-haiku-20241022",
          "name": "Claude 3.5 Haiku",
          "description": "Fastest model",
          "contextWindow": 200000
        }
      ]
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "isAuthenticated": true,
      "models": [
        {
          "id": "gpt-4-turbo",
          "name": "GPT-4 Turbo",
          "contextWindow": 128000
        }
      ]
    },
    {
      "id": "google",
      "name": "Google",
      "isAuthenticated": false,
      "models": []
    }
  ],
  "currentProvider": "anthropic",
  "currentModel": "claude-3-5-sonnet-20241022"
}

// Implementation:
// - Read from config to determine authenticated providers
// - Return available models per provider
// - Filter based on authentication status
// - Include current selection
```

#### Enhanced: POST /v1/sessions/:id/messages
```typescript
// Request body enhanced with mentions
{
  "content": "Review this file",
  "mentions": [
    {
      "type": "file",
      "path": "src/App.tsx"
    }
  ],
  "command": "/review",  // Optional: if message started with command
  "agent": "code",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022"
}

// Server handles mentions by:
// 1. Reading mentioned files
// 2. Adding to context/prompt
// 3. Potentially using read/grep tools automatically
```

### Input State Management

```typescript
interface InputState {
  text: string;
  mentions: MentionPill[];
  caretPosition: number;
  showMentionPopup: boolean;
  showCommandPopup: boolean;
  showModelSelector: boolean;
  mentionQuery: string;
  commandQuery: string;
  modelQuery: string;
}

// Detection logic
function detectTriggers(text: string, caretPos: number) {
  // Check for @ trigger
  const beforeCaret = text.slice(0, caretPos);
  const lastAt = beforeCaret.lastIndexOf('@');
  const lastSpace = beforeCaret.lastIndexOf(' ');
  
  if (lastAt > lastSpace) {
    return {
      type: 'mention',
      query: beforeCaret.slice(lastAt + 1),
      position: lastAt
    };
  }
  
  // Check for / trigger (at start or after space)
  if (text.startsWith('/') || beforeCaret.match(/\s\/[a-z]*$/)) {
    const lastSlash = beforeCaret.lastIndexOf('/');
    return {
      type: 'command',
      query: beforeCaret.slice(lastSlash + 1),
      position: lastSlash
    };
  }
  
  return null;
}
```

### Keyboard Navigation

```typescript
// Both MentionAutocomplete and CommandPalette support:
- ArrowUp/ArrowDown: Navigate items
- Enter: Select item
- Escape: Close popup
- Tab: Select first item (optional)
- Backspace on empty query: Close popup

// ModelSelector additional shortcuts:
- ArrowLeft/Escape: Go back to main command palette
- ArrowRight/Enter: Select model

// Input field shortcuts:
- @: Trigger mention popup
- /: Trigger command popup (if at start)
- Ctrl/Cmd + K: Open command palette (alternative)
```

### Styling & Visual Design

```css
/* Popup containers */
.autocomplete-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

/* Mention pills */
.mention-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin: 0 2px;
  background: rgba(59, 130, 246, 0.2);  /* blue-500 with opacity */
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 9999px;
  font-size: 0.875rem;
  color: #93c5fd;  /* blue-300 */
}

/* Command items */
.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.command-item:hover,
.command-item.selected {
  background: rgba(255, 255, 255, 0.05);
}

/* Command categories */
.command-category {
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Model selector */
.model-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.model-item.current {
  background: rgba(59, 130, 246, 0.1);
}

.model-item .provider-badge {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
```

---

## Implementation Plan

### Phase 1: File Changes Sidebar (Week 1-2)
1. **Server Implementation** (2-3 days)
   - [ ] Create `/v1/files/changes` endpoint
   - [ ] Create `/v1/files/diff` endpoint
   - [ ] Wire up git status/diff commands
   - [ ] Add tests

2. **Frontend Components** (3-4 days)
   - [ ] FileChangesSidebar layout
   - [ ] FileChangesList component
   - [ ] FileChangeItem component
   - [ ] DiffViewer component (basic)
   - [ ] Add to AppLayout

3. **State & Integration** (2 days)
   - [ ] TanStack Query hooks
   - [ ] Zustand store for sidebar state
   - [ ] Toggle button in Header
   - [ ] Polish animations & responsive behavior

4. **Enhancement** (1-2 days)
   - [ ] Syntax highlighting in diffs
   - [ ] Collapse/expand diff hunks
   - [ ] Copy diff functionality
   - [ ] Empty states

### Phase 2: @mentions (Week 3)
1. **Server Implementation** (2 days)
   - [ ] Create `/v1/files/search` endpoint
   - [ ] Implement fuzzy file search
   - [ ] Add .gitignore filtering
   - [ ] Optimize for speed (< 100ms)

2. **Frontend Components** (3 days)
   - [ ] MentionAutocomplete component
   - [ ] Mention pill rendering
   - [ ] Input parsing & caret tracking
   - [ ] Keyboard navigation
   - [ ] Debounced search

3. **Integration** (2 days)
   - [ ] Enhance ChatInput component
   - [ ] Wire up search API
   - [ ] Handle mention selection
   - [ ] Update message send to include mentions
   - [ ] Backend context handling

### Phase 3: /commands (Week 4)
1. **Server Implementation** (2-3 days)
   - [ ] Create `/v1/commands` endpoint
   - [ ] Create `/v1/models` endpoint
   - [ ] Integrate with existing discoverCommands()
   - [ ] Format for web consumption
   - [ ] Add caching

2. **Frontend Components** (3-4 days)
   - [ ] CommandPalette component
   - [ ] ModelSelector submenu component
   - [ ] Command categories
   - [ ] Built-in commands
   - [ ] Custom command loading
   - [ ] Command execution logic

3. **Integration** (2 days)
   - [ ] Detect `/` trigger in ChatInput
   - [ ] Menu button integration
   - [ ] Command execution handlers
   - [ ] Model switching (all providers)
   - [ ] Agent switching
   - [ ] Action commands (clear, export, new)

4. **Polish** (1 day)
   - [ ] Keyboard shortcuts (Cmd/Ctrl + K)
   - [ ] Icons for commands and models
   - [ ] Help text
   - [ ] Documentation

### Phase 4: Testing & Documentation (Week 5)
1. **Testing**
   - [ ] Unit tests for components
   - [ ] Integration tests for APIs
   - [ ] E2E tests for user flows
   - [ ] Cross-browser testing

2. **Documentation**
   - [ ] Update webapp-plan.md
   - [ ] User guide for @mentions
   - [ ] User guide for /commands
   - [ ] API documentation
   - [ ] Video demo (optional)

3. **Polish & Optimization**
   - [ ] Performance optimization
   - [ ] Accessibility (ARIA labels, keyboard nav)
   - [ ] Error handling & edge cases
   - [ ] Loading states
   - [ ] Animations & transitions

---

## Technical Considerations

### Performance
- **File search**: Use fast fuzzy search (fzf algorithm or ripgrep)
- **Debouncing**: 150-200ms for autocomplete searches
- **Caching**: Cache file tree, command list, and model list
- **Virtualization**: For large file lists (future)

### Accessibility
- **Keyboard navigation**: Full support for arrow keys, Enter, Escape
- **ARIA labels**: Proper labeling for screen readers
- **Focus management**: Trap focus in popups
- **Contrast**: Ensure readable colors

### Edge Cases
- **Empty project**: No git repo → hide file changes sidebar
- **Large diffs**: Truncate or paginate very large diffs
- **No permissions**: Handle file read errors gracefully
- **Network errors**: Retry logic and error messages
- **Concurrent editing**: Handle file changes during session
- **No authenticated providers**: Show helpful message in model selector

### Security
- **Path traversal**: Validate file paths on server
- **Rate limiting**: Prevent abuse of search endpoint
- **Sanitization**: Sanitize file paths in UI

### Future Enhancements
- **Image previews**: Show image diffs
- **Resizable sidebar**: Drag to resize file changes panel
- **Multi-file select**: Select multiple files for bulk operations
- **Command parameters**: `/model claude-3-5-sonnet` inline (skip picker)
- **Command history**: Recent commands quick access
- **Custom keyboard shortcuts**: User-defined shortcuts
- **@mention search modes**: Search by type (files only, dirs only)
- **Smart context**: Auto-attach related files based on mention
- **Model favorites**: Pin frequently used models
- **Recent models**: Quick access to recently used models

---

## Success Metrics

### File Changes Sidebar
- Users can view git changes without leaving the UI
- Diffs load in < 500ms for typical files
- Users report improved workflow efficiency

### @mentions
- Search returns results in < 100ms
- Users successfully mention files in 90%+ attempts
- Reduced need to manually specify file paths

### /commands
- Command palette opens in < 50ms
- Model selector shows all authenticated providers
- Users can quickly switch models without leaving chat
- Custom commands from CLI are discoverable
- Users adopt commands for common workflows

---

## Migration Path

### Backward Compatibility
- All existing features continue to work
- New features are additive, not breaking
- Server endpoints are versioned (/v1/...)
- Graceful degradation for older clients

### Rollout Strategy
1. **Alpha**: Internal testing with file changes only
2. **Beta**: Add @mentions, gather feedback
3. **RC**: Add /commands, final polish
4. **Release**: Full launch with documentation

---

## Open Questions

1. **File Changes Sidebar**
   - Should we show staged vs unstaged separately?
   - Support for viewing commit history?
   - Integration with git commands (stage, unstage)?

2. **@mentions**
   - Should we support @mention for URLs or other resources?
   - Show recent files for quick access?
   - Mention entire directories → include all files?

3. **/commands**
   - Should commands be executable mid-message or always at start?
   - Support for command aliases?
   - How to handle model selection inline (e.g., `/model gpt-4`)?
   - Show model pricing/token limits in picker?

4. **General**
   - Should these features be optional (user preferences)?
   - Mobile/tablet support priority?
   - Offline mode considerations?

---

## Resources & References

- **TanStack Query**: https://tanstack.com/query/latest
- **Lucide Icons**: https://lucide.dev
- **diff2html**: https://github.com/rtfpessoa/diff2html (for diff rendering)
- **fzf algorithm**: https://github.com/junegunn/fzf (for fuzzy search)
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/ (alternative for advanced diff view)

---

## Conclusion

These enhancements will significantly improve the AGI web UI by:
1. Providing better visibility into file changes
2. Enabling contextual file mentions for improved AI responses
3. Offering quick access to commands and unified model selection for power users

The unified `/model` command simplifies the UX by showing all available models across authenticated providers in one searchable interface, making it easy to switch between different providers without separate commands.

The features are designed to be intuitive, performant, and extensible for future enhancements.
