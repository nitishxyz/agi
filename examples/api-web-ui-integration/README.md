# AGI CLI - API & Web UI Integration Example

This example demonstrates how to build a custom chat UI using both `@agi-cli/api` and `@agi-cli/web-ui` packages.

## What This Example Shows

- ✅ Type-safe API calls with `@agi-cli/api`
- ✅ Reusable UI components from `@agi-cli/web-ui`
- ✅ React hooks for state management
- ✅ Real-time SSE streaming
- ✅ Session management
- ✅ Message handling

## Prerequisites

1. **AGI Server Running**: The AGI server must be running on port 9100
2. **Bun or Node.js**: This example requires a JavaScript runtime

## Setup

```bash
# Install dependencies
bun install

# Make sure the AGI server is running
# In another terminal:
bun run --filter @agi-cli/server dev

# Run the example (requires a bundler like Vite)
bun run dev
```

## Code Breakdown

### 1. API Client Setup

```typescript
import { createApiClient } from '@agi-cli/api';

const api = createApiClient({
  baseUrl: 'http://localhost:9100'
});

// Type-safe API calls
const sessions = await api.sessions.list();
const session = await api.sessions.create({ agent: 'code' });
```

### 2. Using React Hooks

```typescript
import { useSessions, useMessages, useSessionStream } from '@agi-cli/web-ui/hooks';

function MyComponent() {
  const { sessions, loading, error } = useSessions('http://localhost:9100');
  const { messages } = useMessages(sessionId);
  const { events, connected } = useSessionStream(sessionId);
  
  // Use the data in your component
}
```

### 3. Using UI Components

```typescript
import {
  Button,
  Card,
  ChatInput,
  SessionListContainer
} from '@agi-cli/web-ui/components';

function ChatUI() {
  return (
    <>
      <SessionListContainer
        sessions={sessions}
        activeSessionId={currentId}
        onSessionSelect={handleSelect}
      />
      <ChatInput onSubmit={handleSend} />
    </>
  );
}
```

## Key Features

### Type Safety

All API calls and components are fully typed:

```typescript
import type { Session, Message } from '@agi-cli/api';

const session: Session = await api.sessions.create({
  agent: 'code',
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022'
});
```

### Real-time Streaming

SSE events are handled automatically:

```typescript
const { events, connected } = useSessionStream(sessionId);

// Events include:
// - message.created
// - message.part.delta
// - tool.call
// - tool.result
// - message.completed
```

### Reusable Components

All components are styled with Tailwind CSS and support dark mode:

```typescript
<Button variant="primary" size="md">
  Click Me
</Button>

<Card className="p-6">
  Your content here
</Card>
```

## Running in Production

For a production setup, you'd typically:

1. Use a bundler like Vite or Next.js
2. Add proper error boundaries
3. Implement authentication
4. Add loading states
5. Handle edge cases

See the main AGI CLI documentation for more details.

## Related Examples

- [Basic CLI Bot](../basic-cli-bot) - Simple CLI bot using `@agi-cli/sdk`
- [Git Commit Helper](../git-commit-helper) - AI-powered commit message generator
- [Embedded Web UI](../simple-embedded.ts) - Serving the full web UI

## Learn More

- [@agi-cli/api Documentation](../../packages/api/README.md)
- [@agi-cli/web-ui Documentation](../../packages/web-ui/README.md)
- [AGI CLI Docs](../../docs/README.md)
