# @agi-cli/api

Type-safe API client for AGI CLI server, auto-generated from OpenAPI spec.

## Installation

```bash
npm install @agi-cli/api
# or
bun add @agi-cli/api
```

## Features

- 🔒 **Fully typed** - Generated from OpenAPI spec
- 🌊 **SSE streaming** - Built-in support for Server-Sent Events
- 🎯 **Simple API** - Clean, intuitive methods
- 🔧 **Configurable** - Custom base URL, headers, and fetch implementation
- 📦 **Zero runtime dependencies** (except `eventsource-parser` for SSE)

## Quick Start

```typescript
import { createApiClient, createSSEStream } from '@agi-cli/api';

// Create an API client
const api = createApiClient({
  baseUrl: 'http://localhost:9100',
  projectPath: '/path/to/your/project'
});

// List sessions
const sessions = await api.sessions.list();

// Create a new session
const session = await api.sessions.create({
  agent: 'code',
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022'
});

// Send a message
const { messageId } = await api.messages.create(session.id, {
  content: 'Write a Hello World program in TypeScript'
});

// Stream the response
const controller = new AbortController();
await createSSEStream({
  baseUrl: 'http://localhost:9100',
  sessionId: session.id,
  onEvent: (event) => {
    const data = JSON.parse(event.data);
    console.log(`Event: ${event.event}`, data);
    
    // Handle different event types
    if (event.event === 'message.part.delta') {
      process.stdout.write(data.delta);
    }
  },
  onError: (error) => {
    console.error('Stream error:', error);
  },
  onClose: () => {
    console.log('\nStream closed');
  }
}, controller.signal);

// Stop streaming
// controller.abort();
```

## API Reference

### `createApiClient(config?)`

Creates a configured API client instance.

**Options:**
- `baseUrl` - API server URL (default: `http://localhost:9100`)
- `projectPath` - Project path for requests
- `fetch` - Custom fetch implementation
- `headers` - Additional headers for all requests

**Returns:** `ApiClient` with methods:
- `sessions.list()` - List all sessions
- `sessions.create(options)` - Create a new session
- `messages.list(sessionId, options?)` - List messages
- `messages.create(sessionId, options)` - Send a message
- `ask.send(options)` - Send a prompt (CLI-style endpoint)

### `createSSEStream(options, signal?)`

Connect to a session's SSE event stream.

**Options:**
- `baseUrl` - API server URL
- `sessionId` - Session to stream
- `projectPath` - Optional project path
- `fetch` - Custom fetch implementation
- `onEvent(event)` - Event handler
- `onError(error)` - Error handler
- `onClose()` - Close handler

**Signal:** Optional `AbortSignal` to close the stream

### Server Events

The stream emits these event types:

- `session.created` - New session created
- `message.created` - New message started
- `message.part.delta` - Text delta (streaming content)
- `tool.call` - Tool invocation started
- `tool.delta` - Tool execution progress
- `tool.result` - Tool execution completed
- `message.completed` - Message finished (includes token usage)
- `error` - Error occurred

## Examples

### Simple Ask Request

```typescript
import { createApiClient } from '@agi-cli/api';

const api = createApiClient();

const response = await api.ask.send({
  prompt: 'What is the capital of France?',
  last: true // Reuse last session
});

console.log('Session:', response.sessionId);
console.log('Message ID:', response.assistantMessageId);
```

### Custom Configuration

```typescript
import { createApiClient } from '@agi-cli/api';

const api = createApiClient({
  baseUrl: 'https://api.example.com',
  projectPath: '/home/user/my-project',
  headers: {
    'Authorization': 'Bearer your-token-here'
  },
  fetch: customFetch // For Node.js environments
});
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { createApiClient, createSSEStream } from '@agi-cli/api';

function useSessionStream(sessionId: string) {
  const [messages, setMessages] = useState<string[]>([]);
  
  useEffect(() => {
    const controller = new AbortController();
    
    createSSEStream({
      baseUrl: 'http://localhost:9100',
      sessionId,
      onEvent: (event) => {
        if (event.event === 'message.part.delta') {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data.delta]);
        }
      }
    }, controller.signal);
    
    return () => controller.abort();
  }, [sessionId]);
  
  return messages;
}
```

## Type Definitions

All types are automatically generated from the OpenAPI spec:

```typescript
import type {
  Session,
  Message,
  MessagePart,
  Provider,
  AskResponse
} from '@agi-cli/api';
```

## License

MIT
