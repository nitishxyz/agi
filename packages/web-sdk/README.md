# @ottocode/web-sdk

Reusable React components, hooks, and utilities for building ottocode web interfaces.

## Installation

```bash
npm install @ottocode/web-sdk
# or
bun add @ottocode/web-sdk
```

## Setup

### Tailwind CSS Configuration

The components in this package use Tailwind CSS classes. You **must** configure Tailwind to scan the web-sdk package for class names.

In your `tailwind.config.js` (or `tailwind.config.ts`):

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // ⚠️ IMPORTANT: Include web-sdk package
    './node_modules/@ottocode/web-sdk/dist/**/*.{js,jsx}',
    // Or if using a monorepo with workspace:*
    '../../packages/web-sdk/src/**/*.{js,ts,jsx,tsx}',
  ],
  // ... rest of your config
};
```

### CSS Variables

The components use CSS custom properties for theming. Add these to your global CSS:

```css
@layer base {
  :root {
    --background: 220 25% 95%;
    --foreground: 220 10% 15%;
    --card: 220 25% 98%;
    --card-foreground: 220 10% 15%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --border: 220 15% 89%;
    --input: 220 15% 89%;
    --ring: 222.2 84% 4.9%;
    /* ... other variables */
  }

  .dark {
    --background: 240 10% 8%;
    --foreground: 0 0% 98%;
    /* ... dark theme variables */
  }
}
```

See the [apps/web/src/index.css](../../apps/web/src/index.css) file for the complete set of CSS variables.

## Usage

### Components

```tsx
import { 
  ChatInput, 
  ChatInputContainer,
  MessageThread,
  SessionListContainer 
} from '@ottocode/web-sdk/components';

function MyApp() {
  return (
    <div>
      <SessionListContainer 
        activeSessionId={sessionId}
        onSelectSession={handleSelect}
      />
      <MessageThread messages={messages} />
      <ChatInputContainer sessionId={sessionId} />
    </div>
  );
}
```

### Hooks

```tsx
import { 
  useSessions, 
  useMessages, 
  useSessionStream,
  useTheme 
} from '@ottocode/web-sdk/hooks';

function MyComponent() {
  const { data: sessions } = useSessions();
  const { data: messages } = useMessages(sessionId);
  const { theme, toggleTheme } = useTheme();
  
  // ...
}
```

### Stores

```tsx
import { useGitStore, useSidebarStore } from '@ottocode/web-sdk/stores';

function MyComponent() {
  const gitFiles = useGitStore((state) => state.files);
  const isSidebarCollapsed = useSidebarStore((state) => state.collapsed);
  
  // ...
}
```

### Utilities

```tsx
import { apiClient, SSEClient } from '@ottocode/web-sdk/lib';

// Use the API client
const sessions = await apiClient.getSessions();

// Use the SSE client for streaming
const sseClient = new SSEClient('/api/sessions/123/stream');
sseClient.onMessage((data) => console.log(data));
```

## Features

- 🎨 **Pre-built Components** - Chat interface, message threads, session management
- 🪝 **Custom Hooks** - React Query hooks for sessions, messages, and real-time streaming
- 🗄️ **State Management** - Zustand stores for git and sidebar state
- 🛠️ **Utilities** - API client and SSE client for backend communication
- 📘 **TypeScript** - Full type definitions included
- 🎨 **Tailwind CSS** - Styled with Tailwind utility classes

## Package Structure

```
@ottocode/web-sdk/
├── components/     # React components
├── hooks/          # React hooks
├── lib/            # Utilities (API client, SSE client, config)
├── stores/         # Zustand stores
└── types/          # TypeScript type definitions
```

## Troubleshooting

### Styles not working

If the components appear unstyled:

1. **Check Tailwind content paths**: Make sure your `tailwind.config.js` includes the web-sdk package
2. **Verify CSS variables**: Ensure you've added the required CSS custom properties
3. **Import global styles**: Make sure you're importing your global CSS file with Tailwind directives
4. **Restart dev server**: After config changes, restart your development server

### Component not found

Make sure you're importing from the correct path:

```tsx
// ✅ Correct
import { Button } from '@ottocode/web-sdk/components';

// ❌ Wrong
import { Button } from '@ottocode/web-sdk';
```

## Related Packages

- `@ottocode/web-ui` - Pre-built static web app
- `@ottocode/sdk` - Node.js SDK for ottocode
- `@ottocode/api` - API client types
- `@ottocode/server` - Backend server

## License

MIT
