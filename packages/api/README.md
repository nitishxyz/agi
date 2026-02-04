# @ottocode/api

Type-safe API client for ottocode server, generated from OpenAPI specification using [@hey-api/openapi-ts](https://heyapi.dev/openapi-ts/).

## Features

- ✅ **Type-safe SDK** - Fully typed API functions generated from OpenAPI spec
- 🚀 **Axios-powered** - Uses Axios for reliable HTTP requests with interceptors support
- 📦 **Tree-shakeable** - Import only what you need
- 🔄 **SSE Streaming** - Built-in support for Server-Sent Events
- ✨ **Runtime validation** - Optional schema validation with generated schemas
- 🎯 **Auto-generated** - Always in sync with the server API

## Installation

```bash
npm install @ottocode/api axios
# or
bun add @ottocode/api axios
# or
pnpm add @ottocode/api axios
```

## Quick Start

```typescript
import { client, ask, listSessions } from '@ottocode/api';

// Configure the client once at app startup
client.setConfig({
  baseURL: 'http://localhost:3000',
});

// Make type-safe API calls
const response = await ask({
  body: {
    prompt: 'Hello, AI!',
    sessionId: 'optional-session-id',
  },
});

if (response.error) {
  console.error('Error:', response.error);
} else {
  console.log('Response:', response.data);
}

// List all sessions
const sessions = await listSessions();
console.log('Sessions:', sessions.data);
```

## Configuration

### Basic Configuration

```typescript
import { client } from '@ottocode/api';

client.setConfig({
  baseURL: 'http://localhost:3000',
  // Optional: configure timeout
  timeout: 30000,
});
```

### Advanced Configuration with Interceptors

```typescript
import { client } from '@ottocode/api';

// Access the underlying Axios instance
client.instance.interceptors.request.use((config) => {
  // Add authentication token
  config.headers.set('Authorization', `Bearer ${getToken()}`);
  return config;
});

client.instance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

### Authentication

```typescript
import { client } from '@ottocode/api';

// Configure auth token (will be added to requests that require auth)
client.setConfig({
  baseURL: 'http://localhost:3000',
  auth: () => `Bearer ${getToken()}`,
});
```

## API Reference

All SDK functions are auto-generated and fully typed. Import them directly:

```typescript
import {
  // Session management
  listSessions,
  createSession,
  subscribeSessionStream,
  
  // Messages
  listMessages,
  createMessage,
  
  // Ask endpoint
  ask,
} from '@ottocode/api';
```

## SSE Streaming

For endpoints that support Server-Sent Events:

```typescript
import { createSSEStream } from '@ottocode/api';

const stream = createSSEStream({
  url: 'http://localhost:3000/v1/sessions/session-123/stream',
  onMessage: (event) => {
    console.log('Event:', event);
  },
  onError: (error) => {
    console.error('Stream error:', error);
  },
});

// Close the stream when done
stream.close();
```

## Error Handling

```typescript
import { ask, isApiError, handleApiError } from '@ottocode/api';

const response = await ask({
  body: { prompt: 'Hello' },
});

if (response.error) {
  if (isApiError(response.error)) {
    // Handle API errors
    const { status, message } = handleApiError(response.error);
    console.error(`API Error [${status}]:`, message);
  } else {
    // Handle network or other errors
    console.error('Unexpected error:', response.error);
  }
}
```

## Development

### Generating the Client

The client is auto-generated from the server's OpenAPI specification:

```bash
# Generate from the latest server spec
bun run generate

# Build the package
bun run build
```

### Configuration

The code generation is configured in `openapi-ts.config.ts`:

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi.json',
  output: {
    path: './src/generated',
  },
  plugins: [
    '@hey-api/typescript',     // Generate TypeScript types
    '@hey-api/schemas',        // Generate runtime schemas
    '@hey-api/sdk',            // Generate SDK functions
    '@hey-api/client-axios',   // Use Axios client
  ],
});
```

## Architecture

```
@ottocode/api/
├── src/
│   ├── generated/          # Auto-generated files (don't edit!)
│   │   ├── client.gen.ts   # Axios client instance
│   │   ├── sdk.gen.ts      # SDK functions
│   │   ├── types.gen.ts    # TypeScript types
│   │   └── schemas.gen.ts  # Runtime schemas
│   ├── runtime-config.ts   # Client runtime configuration
│   ├── streaming.ts        # SSE utilities
│   ├── utils.ts           # Helper functions
│   └── index.ts           # Public API exports
├── openapi-ts.config.ts   # Code generation config
├── generate.ts            # Generation script
└── build.ts              # Build script
```

## Migration from Legacy Client

If you're migrating from the old Fetch-based client:

### Before (Legacy)
```typescript
import { createApiClient } from '@ottocode/api';

const client = createApiClient({
  baseUrl: 'http://localhost:3000',
});

const response = await client.ask({
  prompt: 'Hello',
});
```

### After (New Axios Client)
```typescript
import { client, ask } from '@ottocode/api';

// Configure once at startup
client.setConfig({
  baseURL: 'http://localhost:3000',
});

// Use SDK functions
const response = await ask({
  body: { prompt: 'Hello' },
});
```

## Resources

- [Hey API Documentation](https://heyapi.dev/openapi-ts/)
- [Axios Client Guide](https://heyapi.dev/openapi-ts/clients/axios)
- [Server Package](../server) - The API server that this client connects to

## License

MIT
