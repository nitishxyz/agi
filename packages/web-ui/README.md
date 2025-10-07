# @agi-cli/web-ui

Pre-built, embeddable web UI for AGI CLI. This package contains the fully-built static assets from the AGI CLI web interface, ready to be served by any web server or framework.

## Features

- 🎯 **One-Line Integration** - Import and serve with a single function call
- 📦 **Pre-built Assets** - No build step required in your project
- 🚀 **Framework Agnostic** - Works with Bun, Express, Fastify, Hono, or any HTTP server
- 🎨 **Full Featured** - Complete AGI CLI web interface with all functionality
- 📱 **Responsive** - Modern, mobile-friendly UI built with React and Tailwind CSS
- ⚡ **Fast** - Optimized production build with code splitting
- 🛣️ **Smart Routing** - Handles SPA routing and direct asset requests automatically

## Installation

```bash
npm install @agi-cli/web-ui
# or
yarn add @agi-cli/web-ui
# or
pnpm add @agi-cli/web-ui
# or
bun add @agi-cli/web-ui
```

## Quick Start

### Ultra-Simple (Recommended)

Just one line - everything is handled for you:

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  idleTimeout: 240, // IMPORTANT: prevents SSE timeout
  fetch: serveWebUI({ prefix: '/ui' })
});

console.log('Web UI: http://localhost:3000/ui');
```

> **⚠️ Important**: Always set `idleTimeout: 240` (or higher) in `Bun.serve()` to prevent SSE connection timeouts. The web UI uses Server-Sent Events for real-time streaming, and Bun's default timeout of 10 seconds will cause connections to drop.

That's it! The web UI will be available at `/ui` with:
- ✅ Automatic SPA routing
- ✅ Asset path handling (both `/ui/assets/*` and `/assets/*`)
- ✅ Proper MIME types
- ✅ 404 fallbacks
- ✅ Real-time SSE streaming

### With Custom Routes

Combine the web UI with your own API routes:

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

const webUI = serveWebUI({ prefix: '/ui' });

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Your API routes
    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({ message: 'Hello!' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Try web UI handler
    const webUIResponse = await webUI(req);
    if (webUIResponse) return webUIResponse;
    
    // Final fallback
    return new Response('Not found', { status: 404 });
  }
});
```

### With Root Redirect

Automatically redirect `/` to `/ui`:

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  fetch: serveWebUI({ 
    prefix: '/ui',
    redirectRoot: true  // '/' → '/ui'
  })
});
```

### Different Prefix

Serve the UI at any path you want:

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  fetch: serveWebUI({ prefix: '/admin' })
});

console.log('Web UI: http://localhost:3000/admin');
```

### Custom Server URL

When serving both the API and web UI from the same server, you can configure the web UI to connect to your server instead of the default `localhost:9100`:

```typescript
import { createApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';

const app = createApp();
const handleWebUI = serveWebUI({
  prefix: '/ui',
  serverUrl: `http://${host}:${port}`, // Explicit server URL
});

// Or let it auto-detect (recommended for same-server setup):
// const handleWebUI = serveWebUI({ prefix: '/ui' });

const server = Bun.serve({
  port,
  hostname: host,
  async fetch(req) {
    // Serve web UI first
    const webUIResponse = await handleWebUI(req);
    if (webUIResponse) return webUIResponse;

    // Then API routes
    return app.fetch(req);
  },
});

console.log(`Server: http://${host}:${server.port}/ui`);
```

> **Note:** If you don't specify `serverUrl`, the web UI will automatically detect the server URL from the incoming request. This is recommended when serving both the API and UI from the same server.

## API Reference

### `serveWebUI(options?): (req: Request) => Promise<Response | null>`

Creates a request handler that serves the web UI.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'/ui'` | URL prefix for the web UI |
| `redirectRoot` | `boolean` | `false` | Redirect `/` to the prefix |
| `onNotFound` | `(req: Request) => Response \| null` | `null` | Custom 404 handler |
| `serverUrl` | `string` | Auto-detected | API server URL for the web UI to connect to. If not provided, auto-detects from request (e.g., `http://localhost:3000`) |

**Returns:** A request handler function that returns:
- `Response` if the request matches a web UI route
- `null` if the request should be handled by other routes

**Example:**

```typescript
const handler = serveWebUI({
  prefix: '/dashboard',
  redirectRoot: true,
  onNotFound: (req) => new Response('UI not found', { status: 404 })
});

Bun.serve({ port: 3000, fetch: handler });
```

### `getWebUIPath(): string`

Returns the absolute path to the directory containing all built web UI assets.

```typescript
import { getWebUIPath } from '@agi-cli/web-ui';

const assetsPath = getWebUIPath();
// => '/path/to/node_modules/@agi-cli/web-ui/dist/web-assets'
```

### `getIndexPath(): string`

Returns the absolute path to the main `index.html` file.

```typescript
import { getIndexPath } from '@agi-cli/web-ui';

const indexPath = getIndexPath();
// => '/path/to/node_modules/@agi-cli/web-ui/dist/web-assets/index.html'
```

### `isWebUIAvailable(): boolean`

Checks if the web UI assets are properly built and available.

```typescript
import { isWebUIAvailable } from '@agi-cli/web-ui';

if (!isWebUIAvailable()) {
  console.error('Web UI assets not found!');
  process.exit(1);
}
```

## Framework Examples

### Bun (Recommended)

```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  fetch: serveWebUI({ prefix: '/ui' })
});
```

### Express

```typescript
import express from 'express';
import { getWebUIPath, getIndexPath } from '@agi-cli/web-ui';

const app = express();

// Serve static assets
app.use('/ui', express.static(getWebUIPath()));

// SPA fallback
app.get('/ui/*', (req, res) => {
  res.sendFile(getIndexPath());
});

app.listen(3000);
```

### Fastify

```typescript
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { getWebUIPath } from '@agi-cli/web-ui';

const fastify = Fastify();

await fastify.register(fastifyStatic, {
  root: getWebUIPath(),
  prefix: '/ui/',
});

await fastify.listen({ port: 3000 });
```

### Hono

```typescript
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getWebUIPath } from '@agi-cli/web-ui';

const app = new Hono();

app.use('/ui/*', serveStatic({ root: getWebUIPath() }));

export default app;
```

### Node.js HTTP

```typescript
import { createServer } from 'http';
import { serveWebUI } from '@agi-cli/web-ui';

const handler = serveWebUI({ prefix: '/ui' });

createServer(async (req, res) => {
  const request = new Request(`http://localhost${req.url}`);
  const response = await handler(request);
  
  if (response) {
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(3000);
```

## How It Works

The `serveWebUI()` function handles all the complexity for you:

1. **Prefixed Routes** (`/ui/*`): Strips the prefix and serves the requested file
2. **Direct Asset Requests** (`/assets/*`, `/vite.svg`, etc.): Serves assets directly (for when HTML references them)
3. **SPA Fallback**: Returns `index.html` for any unmatched routes under the prefix
4. **Security**: Prevents directory traversal attacks
5. **MIME Types**: Automatically sets correct Content-Type headers
6. **Cross-Runtime**: Works in both Bun and Node.js

This pattern solves the common issue where Vite-built apps reference assets like `/assets/index-*.js` directly, which would 404 without special handling.

## Important Notes

### Single Page Application (SPA)

The web UI is a React-based SPA with client-side routing. The `serveWebUI()` handler automatically:
- Serves static assets from the web UI path
- Falls back to `index.html` for client-side routes
- Handles both prefixed (`/ui/assets/*`) and direct (`/assets/*`) asset requests

### API Configuration

The web UI expects an API to be available. By default, it will try to connect to:
- `http://localhost:3000/api` (in development)
- Same origin `/api` (in production)

You'll need to set up your API endpoints to handle AGI CLI requests. See the [AGI CLI documentation](https://github.com/yourusername/agi-cli) for API implementation details.

### CORS

If your API is on a different origin than the web UI, you'll need to configure CORS headers:

```typescript
Bun.serve({
  port: 3000,
  async fetch(req) {
    // Your routes...
    
    const response = await handler(req);
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }
});
```

## Examples

See the [examples](./examples) directory for complete working examples:

- **Bun Server** - Minimal example using Bun's HTTP server with `serveWebUI()`
- **Express Server** - Traditional Express.js integration

## Development

This package is part of the AGI CLI monorepo. To build from source:

```bash
# Clone the repository
git clone https://github.com/yourusername/agi-cli
cd agi-cli

# Install dependencies
bun install

# Build the package
cd packages/web-ui
bun run build
```

The build process:
1. Builds the web app from `apps/web` using Vite
2. Copies the production build to `dist/web-assets`
3. Compiles the TypeScript exports
4. Generates type declarations

## What's Included

The package includes:

- ✅ Complete AGI CLI web interface
- ✅ React 19 with optimized production build
- ✅ TailwindCSS for styling
- ✅ Code syntax highlighting
- ✅ Markdown rendering
- ✅ Real-time API communication
- ✅ Responsive mobile design
- ✅ Dark mode support (if configured)
- ✅ Smart request handler with automatic routing

## Bundle Size

The production build is optimized and includes:
- Main JS bundle: ~1.1 MB (370 KB gzipped)
- CSS: ~31 KB (6.5 KB gzipped)
- Total initial load: ~376 KB gzipped

## Browser Support

The web UI supports all modern browsers:
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

## Migration from Manual Setup

If you were using the old manual approach:

**Before:**
```typescript
import { getWebUIPath, getIndexPath } from '@agi-cli/web-ui';

// 50 lines of routing logic...
```

**After:**
```typescript
import { serveWebUI } from '@agi-cli/web-ui';

Bun.serve({
  port: 3000,
  fetch: serveWebUI({ prefix: '/ui' })
});
```

## License

MIT

## Related

- [AGI CLI](https://github.com/yourusername/agi-cli) - The main CLI tool
- [AGI CLI API Documentation](https://github.com/yourusername/agi-cli/docs/api) - API implementation guide

## Support

For issues, questions, or contributions:
- 🐛 [Report a bug](https://github.com/yourusername/agi-cli/issues)
- 💡 [Request a feature](https://github.com/yourusername/agi-cli/issues)
- 📖 [Read the docs](https://github.com/yourusername/agi-cli/docs)
