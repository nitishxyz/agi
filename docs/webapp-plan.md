# Web App Implementation Plan

## Overview
Lightweight web interface for AGI CLI with session management, message threading, and real-time chat capabilities.

## Tech Stack
- **Frontend Framework**: React + Vite (lightweight, fast)
- **Styling**: TailwindCSS (themeable, utility-first)
- **Data Fetching**: TanStack Query v5 (caching, SSE support)
- **Routing**: React Router v6
- **State Management**: Zustand (lightweight) for UI state
- **Icons**: Lucide React (tree-shakeable, consistent design)
- **Theme**: Dark by default with theme toggle capability

## Architecture

```
apps/web/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── sessions/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionItem.tsx
│   │   │   └── CreateSessionDialog.tsx
│   │   ├── messages/
│   │   │   ├── MessageThread.tsx
│   │   │   ├── MessagePart.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   ├── AssistantMessage.tsx
│   │   │   ├── ToolCall.tsx
│   │   │   ├── ToolResult.tsx
│   │   │   └── ThreadConnector.tsx (visual thread line)
│   │   ├── chat/
│   │   │   ├── ChatInput.tsx
│   │   │   └── ChatComposer.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       └── ThemeToggle.tsx
│   ├── hooks/
│   │   ├── useSessions.ts
│   │   ├── useMessages.ts
│   │   ├── useSessionStream.ts
│   │   └── useSendMessage.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── sse-client.ts
│   │   └── config.ts
│   ├── stores/
│   │   └── ui-store.ts
│   ├── types/
│   │   └── api.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## UI Design Concept

### Layout
```
┌─────────────────────────────────────────────────┐
│  Header [Theme Toggle] [New Session]            │
├──────────┬──────────────────────────────────────┤
│          │                                       │
│ Sessions │  Message Thread                       │
│ List     │  ┌─────────────────────────────────┐ │
│          │  │ ○ User: "help me..."            │ │
│ ┌──────┐ │  │ │                               │ │
│ │Active│ │  │ ├─ Assistant: "Sure..."         │ │
│ └──────┘ │  │ │  ├─ [Tool Call: read_file]    │ │
│          │  │ │  ├─ [Tool Result: ...]        │ │
│ ┌──────┐ │  │ │  └─ "Here's what I found..."  │ │
│ │Sess 2│ │  │ │                               │ │
│ └──────┘ │  │ ○ User: "thanks"                │ │
│          │  │ │                               │ │
│          │  │ └─ Assistant: "You're welcome"  │ │
│          │  └─────────────────────────────────┘ │
│          │                                       │
│          │  [Chat Input...] [Send]              │
└──────────┴──────────────────────────────────────┘
```

### Visual Threading
- Circular bullet points for main messages
- Vertical connecting lines between related parts
- Indented tool calls/results with distinct styling
- Color-coded by role (user/assistant/tool)
- Boxy cards for each message part
- Smooth animations for new messages

### Icon Usage (Lucide React)
- `MessageSquare` - Sessions/messages
- `Plus` - New session
- `Send` - Send message
- `Moon`/`Sun` - Theme toggle
- `Wrench` - Tool calls
- `Terminal` - Tool results
- `User` - User messages
- `Bot` - Assistant messages
- `Clock` - Timestamps
- `Zap` - Active/processing
- `AlertCircle` - Errors
- `ChevronRight`/`ChevronDown` - Expand/collapse

## API Integration

### Endpoints
1. `GET /v1/sessions` - List sessions
2. `POST /v1/sessions` - Create session
3. `GET /v1/sessions/:id/messages` - Get messages
4. `POST /v1/sessions/:id/messages` - Send message
5. `GET /v1/sessions/:id/stream` - SSE stream for real-time updates

### TanStack Query Setup
- Query for sessions list with auto-refetch
- Query for messages per session
- Mutation for creating sessions
- Mutation for sending messages
- SSE integration for real-time message updates

### Type Definitions (from schema)
```typescript
interface Session {
  id: string;
  title: string | null;
  agent: string;
  provider: string;
  model: string;
  projectPath: string;
  createdAt: number;
  lastActiveAt: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalToolTimeMs: number | null;
  toolCounts?: Record<string, number>;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  status: 'pending' | 'complete' | 'error';
  agent: string;
  provider: string;
  model: string;
  createdAt: number;
  completedAt: number | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  error: string | null;
  parts?: MessagePart[];
}

interface MessagePart {
  id: string;
  messageId: string;
  index: number;
  stepIndex: number | null;
  type: 'text' | 'tool_call' | 'tool_result' | 'image' | 'error';
  content: string; // JSON string
  contentJson?: Record<string, unknown>; // Parsed content
  agent: string;
  provider: string;
  model: string;
  startedAt: number | null;
  completedAt: number | null;
  toolName: string | null;
  toolCallId: string | null;
  toolDurationMs: number | null;
}

interface SSEEvent {
  type: string;
  payload: Record<string, unknown>;
}
```

## Features

### Phase 1 (MVP)
- Session list with metadata (agent, provider, model, timestamps)
- Message thread view with proper part rendering
- Send messages to active session
- SSE connection for real-time updates
- Dark theme by default
- Basic responsive layout

### Phase 2 (Enhancement)
- Theme toggle (dark/light/system)
- Create new sessions
- Search/filter sessions
- Message part syntax highlighting
- Tool call/result expansion/collapse
- Session metadata display
- Error handling UI

### Phase 3 (Future)
- Embed into binary
- Environment variable config
- Export session history
- Advanced filtering/search
- Keyboard shortcuts

## Environment Config Strategy

### Development
```env
VITE_API_BASE_URL=http://localhost:9100
```

**How to run:**
1. Start server: `NODE_ENV=development bun run cli serve`
2. Start web app: `bun run dev:web` (or `cd apps/web && bun dev`)
3. Open http://localhost:5173

### Embedded (future)
```typescript
const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  window.__AGI_API_URL__ || 
  'http://localhost:9100'
```

## Implementation Steps

### 1. Setup (apps/web)
- Initialize Vite + React + TypeScript
- Setup TailwindCSS with dark theme
- Configure TanStack Query
- Setup basic routing
- Install lucide-react for icons

### 2. Core Components
- Layout structure (Sidebar + Main)
- Session list component
- Message thread component
- Message part renderers

### 3. API Integration
- API client with fetch
- SSE client for streaming
- TanStack Query hooks
- Type definitions from schema

### 4. UI Polish
- Thread connector styling
- Message animations
- Loading states
- Error boundaries

### 5. Server Integration
- Add CORS middleware to server
- Serve static files route (for embedded)
- Build process integration

## Server Changes Required

### CORS Middleware
Add to server for development mode:
```typescript
import { cors } from 'hono/cors';

if (process.env.NODE_ENV === 'development') {
  app.use('/v1/*', cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
}
```

### Static Files (for embedded)
```typescript
import { serveStatic } from '@hono/node-server/serve-static';

app.use('/*', serveStatic({ root: './apps/web/dist' }));
app.get('/', serveStatic({ path: './apps/web/dist/index.html' }));
```

## Design System

### Color Palette (Dark Theme)
- Background: `#0a0a0a` (zinc-950)
- Surface: `#18181b` (zinc-900)
- Border: `#27272a` (zinc-800)
- Text Primary: `#fafafa` (zinc-50)
- Text Secondary: `#a1a1aa` (zinc-400)
- Accent: `#3b82f6` (blue-500)
- User: `#10b981` (emerald-500)
- Assistant: `#8b5cf6` (violet-500)
- Tool: `#f59e0b` (amber-500)
- Error: `#ef4444` (red-500)

### Typography
- Font: System UI stack (sans-serif)
- Code: JetBrains Mono / Fira Code (monospace)
- Sizes: text-xs to text-2xl

### Spacing
- Consistent 4px grid (Tailwind default)
- Card padding: p-4
- Section gaps: gap-4

## Dependencies

### Core
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.22.0",
  "@tanstack/react-query": "^5.28.0",
  "zustand": "^4.5.0",
  "lucide-react": "^0.index.359.0"
}
```

### Dev
```json
{
  "vite": "^5.1.0",
  "typescript": "^5.3.3",
  "tailwindcss": "^3.4.1",
  "autoprefixer": "^10.4.18",
  "postcss": "^8.4.35",
  "@vitejs/plugin-react": "^4.2.1"
}
```
