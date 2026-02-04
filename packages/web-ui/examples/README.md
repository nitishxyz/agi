# @ottocode/web-ui Examples

Examples showing different ways to use the `@ottocode/web-ui` package.

## Quick Start

All examples use the new `serveWebUI()` function for ultra-simple integration.

### 1. Minimal Server

The simplest possible setup - just one line:

```bash
bun run bun-server.ts
```

**Code:**
```typescript
import { serveWebUI } from '@ottocode/web-ui';

Bun.serve({
  port: 3000,
  fetch: serveWebUI({ prefix: '/ui', redirectRoot: true })
});
```

Open http://localhost:3000 (auto-redirects to /ui)

### 2. With API Routes

Combine the web UI with your own API endpoints:

```bash
bun run with-api-routes.ts
```

**Code:**
```typescript
import { serveWebUI } from '@ottocode/web-ui';

const webUI = serveWebUI({ prefix: '/ui' });

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Your API routes
    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({ message: 'Hello!' }));
    }
    
    // Try web UI
    const response = await webUI(req);
    if (response) return response;
    
    return new Response('Not found', { status: 404 });
  }
});
```

Endpoints:
- Web UI: http://localhost:3000/ui
- API: http://localhost:3000/api/hello
- API: http://localhost:3000/api/time

### 3. Express Server (Traditional)

For those using Express:

```bash
bun install express
bun run express-server.ts
```

**Code:**
```typescript
import express from 'express';
import { getWebUIPath, getIndexPath } from '@ottocode/web-ui';

const app = express();

app.use('/ui', express.static(getWebUIPath()));
app.get('/ui/*', (req, res) => res.sendFile(getIndexPath()));

app.listen(3000);
```

## Features Demonstrated

| Example | One-Line Setup | Custom Routes | Root Redirect | Framework |
|---------|---------------|---------------|---------------|-----------|
| `bun-server.ts` | ✅ | ❌ | ✅ | Bun |
| `with-api-routes.ts` | ✅ | ✅ | ❌ | Bun |
| `express-server.ts` | ❌ | ✅ | ❌ | Express |

## What the Examples Show

### Smart Routing
All examples handle:
- `/ui` → Serves web UI
- `/ui/assets/*` → Serves static assets
- `/assets/*` → Direct asset requests (fix for Vite builds)
- `/ui/*` → SPA fallback to index.html

### Security
- Directory traversal prevention
- Proper MIME types
- Safe path handling

### Flexibility
- Works standalone or with API routes
- Optional root redirect
- Customizable prefix
- Framework agnostic

## Testing

Test each example:

```bash
# Start an example
bun run bun-server.ts

# In another terminal, test it
curl http://localhost:3000/ui
curl http://localhost:3000/api/hello
```

## Integration Tips

1. **Use `serveWebUI()` for simplicity** - It handles everything
2. **Return `null` for non-UI routes** - Let other handlers process them
3. **Add API routes before or after** - The handler chains nicely
4. **Enable `redirectRoot`** - Great for dedicated UI servers
5. **Customize the prefix** - Use `/admin`, `/dashboard`, etc.

## Next Steps

- Check out the [main README](../README.md) for full API docs
- Browse the [source code](../src/index.ts) to see how it works
- Use these as templates for your own integration
