# Preview Feature - Shareable Session Links

## Overview

Enable users to share AGI sessions publicly via `agi share <sessionId>`, generating a shareable URL like `https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B`.

## Goals

1. One-command sharing: `agi share [sessionId]`
2. No authentication required for viewers
3. Manual re-sync support for updating shared sessions
4. Privacy-first: explicit user action required, no auto-upload
5. Zero-cost infrastructure (free tiers)
6. **Rich link previews** with dynamic OG images

---

## Architecture

```
┌─────────────────┐       ┌───────────────────────────┐       ┌──────────────┐
│   agi CLI       │──────►│    Cloudflare Workers     │──────►│ Cloudflare   │
│  `agi share`    │ POST  │  api.share.agi.nitish.sh  │       │     D1       │
└─────────────────┘       └───────────────────────────┘       └──────────────┘
                                    │
                                    │ /og/:shareId → Satori PNG
                                    │
                          ┌─────────▼───────────┐
                          │  Cloudflare Pages   │
                          │ share.agi.nitish.sh │
                          │  (Astro + React)    │
                          └─────────────────────┘
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **API** | SST + Cloudflare Workers + Hono | Edge-deployed via SST, same pattern as `install.agi.nitish.sh` |
| **Database** | Cloudflare D1 | Native SST support, same provider as Workers, no external accounts |
| **Frontend** | Astro + React (Cloudflare adapter) | SSR for meta tags, React islands for chat UI |
| **OG Images** | Satori + resvg-wasm | Dynamic PNG generation at edge |
| **ORM** | Drizzle | Already used in project, native D1 support |

### Why Cloudflare D1?

1. **Native SST support** - `sst.cloudflare.D1` with simple config
2. **Same provider** - No cross-service auth, lower latency
3. **No external account** - Unlike Turso, no separate signup needed
4. **Drizzle-native** - First-class ORM support, type-safe queries
5. **Generous free tier**:
   - 5GB storage
   - 5M reads/day
   - 100k writes/day
   - Unlimited databases

### Why Astro + React?

1. **SSR for meta tags** - Crawlers (Twitter, Slack, Discord) see `<meta og:image>` without JS
2. **Hybrid rendering** - Static landing page, SSR for `/s/:shareId`
3. **React islands** - Full `@agi-cli/web-sdk` chat components, hydrated client-side
4. **Cloudflare adapter** - First-class `@astrojs/cloudflare` support
5. **Faster initial load** - HTML streamed with content, not blank SPA shell

### Why Cloudflare Workers?

1. **Already using SST** - Existing pattern in `infra/script.ts`
2. **Hono-compatible** - Same framework used in `@agi-cli/server`
3. **Free tier** - 100,000 requests/day
4. **Global edge** - <50ms latency worldwide

---

## Dynamic OG Images

### Overview

Generate rich preview images dynamically for each shared session:

```
Twitter/Slack/Discord requests:
  https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B

Astro SSR injects:
  <meta property="og:image" content="https://api.share.agi.nitish.sh/og/V1StGXR8_Z5jdHi6B">

Worker generates PNG on demand → cached in KV/R2
```

### Image Content

| Element | Source | Customizable |
|---------|--------|--------------|
| **Title** | `--title` flag or session title | ✅ Yes |
| **Description** | `--description` flag or auto-generated | ✅ Yes |
| **Username** | System username (e.g., "bat") | No |
| **Model badge** | `claude-sonnet-4`, `gpt-4o`, etc. | No |
| **Message count** | Computed from session | No |
| **Token count** | Computed from session | No |
| **Timestamp** | Session created date | No |
| **Backdrop** | Gradient/pattern seeded by shareId | Consistent per share |
| **AGI branding** | Corner logo | No |

### Username Capture

Get the system username when sharing:

```typescript
import { userInfo } from 'os';

function getUsername(): string {
  try {
    return userInfo().username;
  } catch {
    return 'anonymous';
  }
}
```

This is **not unique** — multiple users can have the same system username. It's purely for display purposes in the OG image and preview header (e.g., "Shared by bat").

### Implementation

```typescript
// apps/preview-api/src/routes/og.ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-wasm';

app.get('/og/:shareId', async (c) => {
  const { shareId } = c.req.param();
  
  // Check KV cache first
  const cached = await c.env.OG_CACHE.get(shareId, 'arrayBuffer');
  if (cached) {
    return new Response(cached, { headers: { 'Content-Type': 'image/png' } });
  }
  
  // Fetch session data
  const session = await db.query.sharedSessions.findFirst({
    where: eq(sharedSessions.shareId, shareId)
  });
  
  if (!session) return c.notFound();
  
  const data = JSON.parse(session.sessionData);
  
  // Generate SVG with Satori
  const svg = await satori(
    <OGImage
      title={session.title || 'AGI Session'}
      description={session.description}
      username={data.username}
      model={data.model}
      messageCount={data.messages.length}
      tokenCount={data.tokenCount}
      createdAt={session.createdAt}
      shareId={shareId}
    />,
    {
      width: 1200,
      height: 630,
      fonts: [/* load fonts */],
    }
  );
  
  // Convert to PNG
  const resvg = new Resvg(svg);
  const png = resvg.render().asPng();
  
  // Cache for 24 hours
  await c.env.OG_CACHE.put(shareId, png, { expirationTtl: 86400 });
  
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});
```

### OG Image Component

```tsx
// apps/preview-api/src/components/OGImage.tsx
function OGImage({ title, description, username, model, messageCount, tokenCount, createdAt, shareId }) {
  // Generate consistent gradient from shareId
  const gradient = generateGradient(shareId);
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: gradient,
      padding: 60,
    }}>
      {/* AGI logo top-left */}
      <div style={{ position: 'absolute', top: 40, left: 40 }}>
        <span style={{ fontSize: 24, fontWeight: 600 }}>AGI</span>
      </div>
      
      {/* Model badge top-right */}
      <div style={{ position: 'absolute', top: 40, right: 40 }}>
        <span style={{ 
          background: 'rgba(255,255,255,0.2)', 
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 18,
        }}>
          {model}
        </span>
      </div>
      
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, marginBottom: 16 }}>
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: 28, opacity: 0.8 }}>
            {description}
          </p>
        )}
      </div>
      
      {/* Stats footer */}
      <div style={{ display: 'flex', gap: 40, fontSize: 20, opacity: 0.7 }}>
        <span>by {username}</span>
        <span>{messageCount} messages</span>
        <span>{tokenCount?.toLocaleString()} tokens</span>
        <span>{formatDate(createdAt)}</span>
      </div>
    </div>
  );
}
```

---

## Database Schema

Cloudflare D1 database bound to the Worker.

```sql
CREATE TABLE shared_sessions (
  share_id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  title TEXT,
  description TEXT,
  session_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  view_count INTEGER DEFAULT 0,
  last_synced_message_id TEXT NOT NULL  -- boundary: messages up to this ID are included
);

CREATE INDEX idx_expires_at ON shared_sessions(expires_at);
```

### Drizzle Schema

```typescript
// apps/preview-api/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sharedSessions = sqliteTable('shared_sessions', {
  shareId: text('share_id').primaryKey(),
  secret: text('secret').notNull(),
  title: text('title'),
  description: text('description'),
  sessionData: text('session_data').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  expiresAt: integer('expires_at'),
  viewCount: integer('view_count').default(0),
  lastSyncedMessageId: text('last_synced_message_id').notNull(), // boundary: messages up to this ID are included
});
```

### Drizzle Config & Migrations

All Drizzle config and migrations live in `apps/preview-api/`:

```typescript
// apps/preview-api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
```

**Migration workflow:**
1. Edit `apps/preview-api/src/db/schema.ts`
2. Run `bunx drizzle-kit generate` from `apps/preview-api/`
3. **Never manually write migration files** — always use drizzle-kit

### Session Data JSON Structure

```typescript
interface SharedSessionData {
  title: string | null;
  username: string;
  agent: string;
  provider: string;
  model: string;
  createdAt: number;
  tokenCount?: number;
  messages: SharedMessage[];
}

interface SharedMessage {
  id: string;
  role: 'user' | 'assistant';
  createdAt: number;
  parts: SharedMessagePart[];
}

interface SharedMessagePart {
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error';
  content: string;
  toolName?: string;
  toolCallId?: string;
}
```

---

## API Endpoints

Base URL: `https://api.share.agi.nitish.sh`

### Create Share

```
POST /share
Content-Type: application/json

{
  "sessionData": SharedSessionData,
  "title": "Optional custom title",
  "description": "Optional description for OG preview"
}

Response 201:
{
  "shareId": "V1StGXR8_Z5jdHi6B",
  "secret": "sk_abc123...",
  "url": "https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B",
  "expiresAt": 1740000000
}
```

### Update Share

```
PUT /share/:shareId
X-Share-Secret: sk_abc123...
Content-Type: application/json

{
  "sessionData": SharedSessionData,
  "title": "Updated title",
  "description": "Updated description",
  "lastMessageId": "msg_xyz"
}

Response 200:
{
  "shareId": "V1StGXR8_Z5jdHi6B",
  "url": "https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B",
  "messagesAdded": 5
}
```

### Get Share

```
GET /share/:shareId

Response 200:
{
  "shareId": "V1StGXR8_Z5jdHi6B",
  "title": "Fix authentication bug",
  "description": "Debugging OAuth flow with Claude",
  "sessionData": SharedSessionData,
  "createdAt": 1737312000,
  "viewCount": 42
}
```

### Get OG Image

```
GET /og/:shareId

Response 200:
Content-Type: image/png
Cache-Control: public, max-age=86400

<PNG binary>
```

### Delete Share

```
DELETE /share/:shareId
X-Share-Secret: sk_abc123...

Response 204 (No Content)
```

---

## CLI Commands

### `agi share [sessionId]`

```bash
# Share with custom title and description
$ agi share abc123 --title "OAuth Bug Fix" --description "Debugging the refresh token flow"

# Share only up to a specific message
$ agi share abc123 --until msg_xyz

# Interactive picker if no sessionId
$ agi share
? Select a session to share:
  ❯ Fix authentication bug (2 hours ago, 24 messages)
    Refactor database schema (yesterday, 156 messages)

# Confirmation prompt
⚠️  Share this session publicly?
    Title: "Fix authentication bug"
    Messages: 24
    Provider: anthropic/claude-sonnet-4

? Confirm [y/N] y

✓ https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B
  (Secret saved for future updates)
```

### `agi share <sessionId> --update`

```bash
$ agi share abc123 --update

✓ Updated share with 12 new messages
  https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B

# Sync up to a specific message (not beyond)
$ agi share abc123 --update --until msg_abc

✓ Updated share (synced until msg_abc)
  https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B

# Update title/description
$ agi share abc123 --update --title "New Title" --description "New description"
```

### `agi share <sessionId> --delete`

```bash
$ agi share abc123 --delete

? Delete this shared session? [y/N] y
✓ Share deleted
```

### `agi share <sessionId> --status`

Check the current share state — see what's published vs local:

```bash
$ agi share abc123 --status

Share Status: abc123
  URL: https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B
  Title: "OAuth Bug Fix"
  
  Synced until: msg_xyz (message 24 of 36)
  12 new messages since last sync
  
  Last synced: 2 hours ago
  Views: 42

# If not shared yet
$ agi share def456 --status

Session def456 is not shared.
  Messages: 89
  Run `agi share def456` to share it.
```

### `agi share --list`

```bash
$ agi share --list

Shared Sessions:
  abc123 → https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B (24 messages, 42 views)
  def456 → https://share.agi.nitish.sh/s/xK9mN2pQ7rT4wY6z (156 messages, 8 views)
```

---

## Local Storage (SQLite)

Store share metadata in the existing local SQLite database (`~/.agi/agi.sqlite`), not a JSON file.

### Schema Addition (packages/database)

```typescript
// packages/database/src/schema/shares.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const shares = sqliteTable('shares', {
  sessionId: text('session_id').primaryKey(),
  shareId: text('share_id').notNull().unique(),
  secret: text('secret').notNull(),
  url: text('url').notNull(),
  title: text('title'),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  lastSyncedAt: integer('last_synced_at').notNull(),
  lastSyncedMessageId: text('last_synced_message_id').notNull(), // boundary: messages up to this ID are shared
});
```

### Migration Workflow

1. Add schema file: `packages/database/src/schema/shares.ts`
2. Export from index: `packages/database/src/schema/index.ts`
3. Generate migration: `bunx drizzle-kit generate`
4. Update `packages/database/src/migrations-bundled.ts` to include new migration
5. **Never manually write migration files** — always use drizzle-kit

---

## Security Model

### Unguessable IDs

- Share ID: `nanoid(21)` = 21 chars, ~126 bits entropy
- Secret: `nanoid(32)` = 32 chars, ~192 bits entropy
- No enumeration endpoint - must know exact ID

### Content Scrubbing

Before upload, scrub sensitive data:

```typescript
function scrubSessionData(session: Session, messages: Message[]): SharedSessionData {
  return {
    ...session,
    projectPath: undefined,
    messages: messages.map(msg => ({
      ...msg,
      parts: msg.parts.map(part => scrubPart(part))
    }))
  };
}

function scrubPart(part: MessagePart): SharedMessagePart {
  if (part.type === 'tool_result') {
    const content = JSON.parse(part.content);
    if (part.toolName === 'bash' && containsEnvVars(content)) {
      content.output = '[redacted: environment variables]';
    }
    return { ...part, content: JSON.stringify(content) };
  }
  return part;
}
```

### Rate Limiting

- Cloudflare Workers built-in rate limiting
- 10 creates per minute per IP
- 100 reads per minute per IP

### Expiration

- Default: 30 days
- Configurable via `--expires <days>` flag
- Background cleanup job (Cloudflare Cron Trigger)

---

## Preview Web App (Astro)

### Routes

| Route | Rendering | Description |
|-------|-----------|-------------|
| `/` | Static | Landing page, explanation |
| `/s/:shareId` | SSR | Renders shared session with OG meta tags |

### Astro Page with React

```astro
---
// apps/preview-web/src/pages/s/[shareId].astro
import Layout from '../../layouts/Layout.astro';
import ChatPreview from '../../components/ChatPreview';

const { shareId } = Astro.params;
const API_URL = import.meta.env.PUBLIC_API_URL;

const response = await fetch(`${API_URL}/share/${shareId}`);
if (!response.ok) {
  return Astro.redirect('/404');
}

const data = await response.json();
const { title, description, sessionData } = data;

const ogImageUrl = `${API_URL}/og/${shareId}`;
const pageTitle = title || 'AGI Session';
const pageDescription = description || `${sessionData.messages.length} messages • ${sessionData.model}`;
---

<Layout>
  <Fragment slot="head">
    <title>{pageTitle} | AGI Share</title>
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={pageDescription} />
    <meta property="og:image" content={ogImageUrl} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={pageTitle} />
    <meta name="twitter:description" content={pageDescription} />
    <meta name="twitter:image" content={ogImageUrl} />
  </Fragment>
  
  <ChatPreview data={data} client:load />
</Layout>
```

### ChatPreview Component

```tsx
// apps/preview-web/src/components/ChatPreview.tsx
import { MessageThread } from '@agi-cli/web-sdk/components';

interface ChatPreviewProps {
  data: {
    shareId: string;
    title: string | null;
    description: string | null;
    sessionData: SharedSessionData;
    createdAt: number;
    viewCount: number;
  };
}

export default function ChatPreview({ data }: ChatPreviewProps) {
  return (
    <div className="preview-container">
      <PreviewHeader 
        title={data.title || 'AGI Session'} 
        description={data.description}
        model={data.sessionData.model}
        createdAt={data.createdAt}
        viewCount={data.viewCount}
        messageCount={data.sessionData.messages.length}
      />
      <MessageThread 
        messages={data.sessionData.messages}
        readOnly={true}
      />
      <PreviewFooter shareId={data.shareId} />
    </div>
  );
}
```

### Astro Config

```typescript
// apps/preview-web/astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'hybrid',
  adapter: cloudflare(),
  integrations: [react(), tailwind()],
});
```

### Styling

- **Match existing webapp** — Use same color scheme and styling as `@agi-cli/web-ui`
- Import Tailwind config or CSS variables from web-ui for consistency
- Dark/light theme toggle (same as webapp)
- Responsive design
- Minimal AGI branding (corner logo, "Made with AGI" footer)

---

## Project Structure

```
infra/
  domains.ts                      # ADD share.agi.nitish.sh domain
  preview-api.ts                  # NEW - Worker + D1 definition
  preview-web.ts                  # NEW - Astro site definition

apps/
  preview-api/                    # NEW - Cloudflare Worker
    src/
      index.ts                    # Hono app entry
      db/
        client.ts                 # D1 client via Drizzle
        schema.ts                 # Drizzle schema
      routes/
        share.ts                  # CRUD endpoints
        og.ts                     # OG image generation
      components/
        OGImage.tsx               # Satori JSX component
      lib/
        nanoid.ts                 # ID generation
        gradient.ts               # Backdrop generation
    wrangler.toml
    drizzle.config.ts

  preview-web/                    # NEW - Astro + React
    src/
      pages/
        index.astro               # Landing page
        s/[shareId].astro         # Session preview (SSR)
        404.astro
      layouts/
        Layout.astro
      components/
        ChatPreview.tsx           # React island
        PreviewHeader.tsx
        PreviewFooter.tsx
    astro.config.mjs
    tailwind.config.js

apps/cli/
  src/
    commands/
      share.ts                    # NEW - agi share command
```

### SST Infrastructure Code

#### `infra/domains.ts` (updated)

```typescript
const SUB = $app.stage === 'prod' ? '' : `${$app.stage}.`;
const HOST = 'agi.nitish.sh';

export const domains = {
  sh: `${SUB}install.${HOST}`,
  previewApi: `${SUB}api.share.${HOST}`,
  previewWeb: `${SUB}share.${HOST}`,
};
```

#### `infra/preview-api.ts` (new)

```typescript
import { domains } from './domains';

export const previewDb = new sst.cloudflare.D1('PreviewDB');

export const ogCache = new sst.cloudflare.Kv('OGCache');

export const previewApi = new sst.cloudflare.Worker('PreviewApi', {
  domain: domains.previewApi,
  handler: 'apps/preview-api/src/index.ts',
  link: [previewDb, ogCache],
  url: true,
});
```

#### `infra/preview-web.ts` (new)

```typescript
import { domains } from './domains';
import { previewApi } from './preview-api';

export const previewWeb = new sst.cloudflare.Astro('PreviewWeb', {
  domain: domains.previewWeb,
  path: 'apps/preview-web',
  link: [previewApi],
  environment: {
    PUBLIC_API_URL: previewApi.url,
  },
});
```

#### `sst.config.ts` (updated)

```typescript
async run() {
  const { script } = await import('./infra/script');
  const { previewApi, previewDb } = await import('./infra/preview-api');
  const { previewWeb } = await import('./infra/preview-web');

  return {
    script: script.url,
    previewApi: previewApi.url,
    previewWeb: previewWeb.url,
  };
}
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup (1 hour)

1. Update `infra/domains.ts` with new domains
2. Create `infra/preview-api.ts` with D1 + KV bindings
3. Create `infra/preview-web.ts` with Astro config
4. Deploy infrastructure: `bunx sst deploy`

### Phase 2: Preview API (3-4 hours)

1. Create `apps/preview-api/` with Hono app
2. Setup Drizzle schema for D1
3. Implement CRUD routes (create, get, update, delete)
4. Implement OG image generation with Satori
5. Test locally with `bunx sst dev`
6. Deploy with `bunx sst deploy`

### Phase 3: CLI Command (2-3 hours)

1. Add `share` command to CLI
2. Implement session export/scrubbing
3. Add `--title` and `--description` flags
4. Add `.agi/shares.json` management
5. Test create/update/delete flows

### Phase 4: Preview Web App (3-4 hours)

1. Create `apps/preview-web/` with Astro
2. Setup `@astrojs/cloudflare` adapter
3. Build SSR page for `/s/:shareId` with OG meta tags
4. Import `@agi-cli/web-sdk` components for chat rendering
5. Deploy with `bunx sst deploy`

### Phase 5: Polish (1-2 hours)

1. Add expiration cleanup (Cron Trigger)
2. Improve scrubbing logic
3. Add `--expires` flag
4. OG image caching in KV
5. Documentation

**Total Estimated Time: 10-14 hours**

---

## Cost Analysis

### Cloudflare D1 (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Storage | 5GB | ~100MB (10k shares × 10KB avg) |
| Reads | 5M/day | ~5k/day |
| Writes | 100k/day | ~500/day |

### Cloudflare Workers (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Requests | 100k/day | ~2k/day |
| CPU time | 10ms/req | ~5ms/req (OG gen ~50ms cached) |

### Cloudflare KV (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Reads | 100k/day | ~1k/day (OG cache hits) |
| Writes | 1k/day | ~100/day (new OG images) |
| Storage | 1GB | ~50MB (OG images ~50KB each) |

### Cloudflare Pages (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Requests | Unlimited | ~5k/day |
| Bandwidth | Unlimited | ~10GB/mo |

**Total Monthly Cost: $0**

---

## Future Enhancements (Out of Scope for v1)

1. **Live sync** (`--live` flag) - Auto-upload new messages
2. **Password protection** - Optional PIN for sensitive shares
3. **Custom expiration** - User-defined TTL
4. **Analytics** - View counts, referrers
5. **Embed widget** - `<iframe>` embed code
6. **Export formats** - Markdown, JSON download
7. **Comments** - Allow viewers to add comments
8. **Custom OG backgrounds** - User-uploaded images

---

## Open Questions

1. ~~**Domain**: `share.agi.nitish.sh` or `preview.agi.nitish.sh`?~~ → `share.agi.nitish.sh`
2. **Default expiration**: 30 days or 7 days?
3. **Max session size**: Limit message count or total JSON size?
4. **Scrubbing depth**: How aggressive with path/secret redaction?
5. **OG image fonts**: Which fonts to bundle for Satori?

---

## References

- [Cloudflare D1 + Drizzle](https://orm.drizzle.team/docs/tutorials/drizzle-with-d1)
- [SST Cloudflare D1](https://sst.dev/docs/component/cloudflare/d1)
- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Satori - OG Image Generation](https://github.com/vercel/satori)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
