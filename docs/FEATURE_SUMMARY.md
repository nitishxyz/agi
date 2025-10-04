# Feature Summary: Web UI Enhancements

## Quick Overview

This is a high-level summary of the planned enhancements. See [web-ui-enhancements-plan.md](./web-ui-enhancements-plan.md) for the full detailed plan.

---

## 🎯 Two Major Features

### 1. File Changes Sidebar
**What**: A collapsible right sidebar showing git changes with inline diff viewing

**Key Capabilities**:
- View modified, added, deleted, and renamed files
- See diff stats (+X/-Y lines)
- View inline diffs with syntax highlighting
- Toggle sidebar open/close from header
- Real-time updates as files change

**Server Endpoints Needed**:
- `GET /v1/files/changes` - List changed files
- `GET /v1/files/diff` - Get diff for specific file

---

### 2. Smart Input with @mentions and /commands
**What**: Enhanced chat input with autocomplete for files and command palette

#### Part A: @mentions
**Trigger**: Type `@` in the chat input

**Capabilities**:
- Fuzzy search files and directories
- Autocomplete popup with results
- Select multiple files as "pills" in input
- Backend receives mentioned files for better context
- Arrow key navigation, Enter to select

**Server Endpoint Needed**:
- `GET /v1/files/search?q=<query>` - Fuzzy file search

#### Part B: /commands
**Trigger**: Type `/` at start of input or press Cmd/Ctrl+K

**Capabilities**:
- Quick access to config changes (model, agent)
- Action commands (clear, export, new session)
- Custom commands from CLI discovery system
- **Unified `/model` command**: Shows all models from all authenticated providers in one searchable picker
- Categorized and searchable
- Keyboard-first navigation

**Server Endpoints Needed**:
- `GET /v1/commands` - List available commands
- `GET /v1/models` - List all models across all authenticated providers

---

## 📅 Timeline

- **Week 1-2**: File Changes Sidebar
- **Week 3**: @mentions
- **Week 4**: /commands  
- **Week 5**: Testing & Polish

**Total**: ~5 weeks for full implementation

---

## 🎨 UI Layout

```
┌────────────────────────────────────────────────┐
│  Header               [Files Toggle]           │
├────────┬───────────────────────────┬───────────┤
│Sessions│  Message Thread           │ File      │
│  List  │                           │ Changes   │
│        │  ┌─────────────────────┐  │           │
│ [Sess1]│  │ Messages...         │  │ M App.tsx │
│ [Sess2]│  │                     │  │ A new.ts  │
│        │  └─────────────────────┘  │ D old.ts  │
│        │                           │           │
│        │  ┌─────────────────────┐  │ [Diff]    │
│        │  │ @|                  │  │ +added    │
│        │  │ /|               [↑]│  │ -removed  │
│        │  └─────────────────────┘  │           │
│        │       ↑ Autocomplete      │           │
└────────┴───────────────────────────┴───────────┘
```

### Model Selector UI (from /model command)
```
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
```

---

## 🔧 Technical Stack

### Frontend
- React components
- TanStack Query for data fetching
- Zustand for UI state (sidebar open/close)
- Lucide React icons
- Custom autocomplete logic

### Backend
- Hono routes for new endpoints
- Git integration for file changes
- File system search (ripgrep/fzf-like)
- Command discovery from existing CLI system
- Model catalog from provider configs

---

## 💡 Key Benefits

1. **File Changes Sidebar**
   - See what's changed without leaving the UI
   - Review diffs before committing
   - Better context awareness

2. **@mentions**
   - Quickly reference files in conversations
   - AI gets better context automatically
   - No need to copy/paste file paths

3. **/commands**
   - Fast access to config changes
   - **Unified model selection**: All models from all authenticated providers in one place
   - No need to remember which models belong to which provider
   - Discover available commands
   - Power user efficiency boost
   - Seamless integration with CLI commands

---

## 🚀 Future Possibilities

- Resizable sidebar
- Stage/unstage files from UI
- Command history
- Custom keyboard shortcuts
- @mention for URLs, symbols, etc.
- Command aliases
- Image diff previews
- Model favorites/recent models
- Model pricing/token limit display in picker

---

## 📖 Documentation

- Full plan: [web-ui-enhancements-plan.md](./web-ui-enhancements-plan.md)
- Existing web app: [webapp-plan.md](./webapp-plan.md)
- API docs: [api.md](./api.md)

---

## ✅ Next Steps

1. Review this plan and provide feedback
2. Prioritize features if needed
3. Start with Phase 1 (File Changes Sidebar)
4. Iterate based on user feedback
