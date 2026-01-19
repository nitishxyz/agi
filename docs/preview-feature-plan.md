# Preview Feature - Shareable Session Links

## Overview

Enable users to share AGI sessions publicly via `agi share <sessionId>`, generating a shareable URL like `https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B`.

## Goals

1. One-command sharing: `agi share [sessionId]`
2. No authentication required for viewers
3. Manual re-sync support for updating shared sessions
4. Privacy-first: explicit user action required, no auto-upload
5. Zero-cost infrastructure (free tiers)

---

## Architecture

```
┌─────────────────┐       ┌───────────────────────────┐       ┌──────────────┐
│   agi CLI       │──────►│    Cloudflare Workers     │──────►│    Turso     │
│  `agi share`    │ POST  │  api.share.agi.nitish.sh  │       │  (libsql)    │
└─────────────────┘       └───────────────────────────┘       └──────────────┘
                                    │
                          ┌─────────▼───────────┐
                          │  Cloudflare Pages │
                          │  share.agi.nitish.sh│
                          │  (React SPA)      │
                          └─────────────────────┘
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **API** | SST + Cloudflare Workers + Hono | Edge-deployed via SST, same pattern as `install.agi.nitish.sh` |
| **Database** | Turso (libsql) | SQLite-compatible, edge-replicated, free tier: 500M reads/mo, 10M writes/mo |
| **Frontend** | Cloudflare Pages + React | Static hosting, unlimited requests, instant deploys |
| **ORM** | Drizzle | Already used in project, native Turso/libsql support |

### Why Turso?

1. **SQLite-compatible** - Same SQL dialect as local `.agi/agi.sqlite`
2. **Edge-distributed** - Automatic geo-replication, low latency everywhere
3. **Drizzle-native** - First-class ORM support, type-safe queries
4. **Generous free tier**:
   - 100 databases (we only need 1)
   - 5GB storage
   - 500M reads/month
   - 10M writes/month
5. **Cloudflare integration** - Native Workers integration via `@libsql/client/web`

### Why Cloudflare Workers?

1. **Already using SST** - Existing pattern in `infra/script.ts`
2. **Hono-compatible** - Same framework used in `@agi-cli/server`
3. **Free tier** - 100,000 requests/day
4. **Global edge** - <50ms latency worldwide

---

## Database Schema

Single Turso database: `agi-preview`

```sql
CREATE TABLE shared_sessions (
  share_id TEXT PRIMARY KEY,           -- nanoid(21), unguessable
  secret TEXT NOT NULL,                 -- nanoid(32), for updates/deletes
  title TEXT,
  session_data TEXT NOT NULL,           -- JSON blob
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,                   -- optional TTL (Unix timestamp)
  view_count INTEGER DEFAULT 0,
  last_synced_message_id TEXT           -- for delta sync
);

CREATE INDEX idx_expires_at ON shared_sessions(expires_at);
```

### Session Data JSON Structure

```typescript
interface SharedSessionData {
  // Session metadata
  title: string | null;
  agent: string;
  provider: string;
  model: string;
  createdAt: number;
  
  // Messages (scrubbed)
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
  content: string;  // JSON string (same as local DB)
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
  "sessionData": SharedSessionData
}

Response 201:
{
  "shareId": "V1StGXR8_Z5jdHi6B",
  "secret": "sk_abc123...",
  "url": "https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B",
  "expiresAt": 1740000000  // 30 days default
}
```

### Update Share

```
PUT /share/:shareId
X-Share-Secret: sk_abc123...
Content-Type: application/json

{
  "sessionData": SharedSessionData,
  "lastMessageId": "msg_xyz"  // optional, for delta append
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
  "sessionData": SharedSessionData,
  "createdAt": 1737312000,
  "viewCount": 42
}
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
# Share a specific session
$ agi share abc123

# Interactive picker if no sessionId
$ agi share
? Select a session to share:
  ❯ Fix authentication bug (2 hours ago, 24 messages)
    Refactor database schema (yesterday, 156 messages)
    Add preview feature (3 days ago, 89 messages)

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
```

### `agi share <sessionId> --delete`

```bash
$ agi share abc123 --delete

? Delete this shared session? [y/N] y
✓ Share deleted
```

### `agi share --list`

```bash
$ agi share --list

Shared Sessions:
  abc123 → https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B (24 messages, 42 views)
  def456 → https://share.agi.nitish.sh/s/xK9mN2pQ7rT4wY6z (156 messages, 8 views)
```

---

## Local Storage

File: `.agi/shares.json`

```json
{
  "abc123": {
    "shareId": "V1StGXR8_Z5jdHi6B",
    "secret": "sk_abc123xyz789...",
    "url": "https://share.agi.nitish.sh/s/V1StGXR8_Z5jdHi6B",
    "createdAt": 1737312000,
    "lastSyncedAt": 1737312000,
    "lastSyncedMessageId": "msg_xyz"
  }
}
```

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
    // Remove local paths
    projectPath: undefined,
    
    messages: messages.map(msg => ({
      ...msg,
      parts: msg.parts.map(part => scrubPart(part))
    }))
  };
}

function scrubPart(part: MessagePart): SharedMessagePart {
  // For tool results, redact potentially sensitive outputs
  if (part.type === 'tool_result') {
    const content = JSON.parse(part.content);
    
    // Redact environment variables
    if (part.toolName === 'bash' && containsEnvVars(content)) {
      content.output = '[redacted: environment variables]';
    }
    
    // Redact file paths (optional, configurable)
    // content.output = redactPaths(content.output);
    
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

## Preview Web App

### Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `HomePage` | Landing page, explanation |
| `/s/:shareId` | `PreviewPage` | Renders shared session |

### Component Reuse

Import from `@agi-cli/web-sdk`:

```typescript
// Preview-specific read-only wrapper
import { MessageThread } from '@agi-cli/web-sdk/components';

function PreviewPage({ shareId }: { shareId: string }) {
  const { data, isLoading } = useShare(shareId);
  
  if (isLoading) return <Loading />;
  
  return (
    <div className="preview-container">
      <PreviewHeader 
        title={data.title} 
        createdAt={data.createdAt}
        viewCount={data.viewCount}
      />
      <MessageThread 
        messages={data.sessionData.messages}
        readOnly={true}
      />
    </div>
  );
}
```

### Styling

- Dark/light theme toggle
- Responsive design
- Minimal branding
- Copy link button
- "Made with AGI" footer

---

## Project Structure

### Infrastructure (SST)

```
infra/
  domains.ts                      # ADD share.agi.nitish.sh domain
  preview-api.ts                  # NEW - Worker definition
  preview-web.ts                  # NEW - Static site definition

apps/
  preview-api/                    # NEW - Cloudflare Worker
    src/
      index.ts                    # Hono app entry
      db/
        client.ts                 # Turso client
        schema.ts                 # Drizzle schema
      lib/
        nanoid.ts                 # ID generation
    wrangler.toml
    drizzle.config.ts

  preview-web/                    # NEW - Cloudflare Pages
    src/
      main.tsx
      App.tsx
      routes/
        HomePage.tsx
        PreviewPage.tsx
      components/
        PreviewHeader.tsx
        PreviewThread.tsx         # Wrapper around web-sdk MessageThread
      hooks/
        useShare.ts
      lib/
        api.ts
    vite.config.ts

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
  previewApi: `${SUB}api.share.${HOST}`,   // NEW
  previewWeb: `${SUB}share.${HOST}`,       // NEW
};
```

#### `infra/preview-api.ts` (new)

```typescript
import { domains } from './domains';

// Turso credentials as secrets
const tursoUrl = new sst.Secret('TursoUrl');
const tursoAuthToken = new sst.Secret('TursoAuthToken');

export const previewApi = new sst.cloudflare.Worker('PreviewApi', {
  domain: domains.previewApi,
  handler: 'apps/preview-api/src/index.ts',
  link: [tursoUrl, tursoAuthToken],
  url: true,
});
```

#### `infra/preview-web.ts` (new)

```typescript
import { domains } from './domains';
import { previewApi } from './preview-api';

export const previewWeb = new sst.cloudflare.StaticSite('PreviewWeb', {
  domain: domains.previewWeb,
  path: 'apps/preview-web',
  build: {
    command: 'bun run build',
    output: 'dist',
  },
  environment: {
    VITE_API_URL: previewApi.url,
  },
});
```

#### `sst.config.ts` (updated)

```typescript
async run() {
  const { script } = await import('./infra/script');
  const { previewApi } = await import('./infra/preview-api');
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

### Phase 1: Infrastructure Setup (1-2 hours)

1. Create Turso database `agi-preview` via CLI
2. Generate auth tokens via `turso db tokens create`
3. Add SST secrets: `bunx sst secret set TursoUrl <url>` and `TursoAuthToken`
4. Update `infra/domains.ts` with new domains
5. Create `infra/preview-api.ts` and `infra/preview-web.ts`

### Phase 2: Preview API (2-3 hours)

1. Create `apps/preview-api/` with Hono app
2. Setup Drizzle schema for `shared_sessions`
3. Implement CRUD routes (create, get, update, delete)
4. Test locally with `bunx sst dev`
5. Deploy with `bunx sst deploy`

Turso URL format: `libsql://agi-preview-<username>.turso.io`

### Phase 3: CLI Command (2-3 hours)

1. Add `share` command to CLI
2. Implement session export/scrubbing
3. Add `.agi/shares.json` management
4. Test create/update/delete flows

### Phase 4: Preview Web App (3-4 hours)

1. Create `apps/preview-web/` with Vite + React
2. Build `PreviewPage` component
3. Reuse `@agi-cli/web-sdk` message renderers
4. Deploy with `bunx sst deploy`

### Phase 5: Polish (1-2 hours)

1. Add expiration cleanup (Cron Trigger)
2. Improve scrubbing logic
3. Add `--expires` flag
4. Documentation

**Total Estimated Time: 10-14 hours**

---

## Cost Analysis

### Turso (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Databases | 100 | 1 |
| Storage | 5GB | ~100MB (10k shares × 10KB avg) |
| Reads | 500M/mo | ~50k/mo (5k views × 10 queries) |
| Writes | 10M/mo | ~5k/mo (1k new shares + updates) |

### Cloudflare Workers (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Requests | 100k/day | ~1k/day |
| CPU time | 10ms/req | ~2ms/req |

### Cloudflare Pages (Free Tier)

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| Bandwidth | Unlimited | ~10GB/mo |
| Builds | 500/mo | ~20/mo |

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

---

## Open Questions

1. **Domain**: `share.agi.nitish.sh` or `preview.agi.nitish.sh`?
2. **Default expiration**: 30 days or 7 days?
3. **Max session size**: Limit message count or total JSON size?
4. **Scrubbing depth**: How aggressive with path/secret redaction?

---

## References

- [Turso + Cloudflare Workers Tutorial](https://developers.cloudflare.com/workers/tutorials/connect-to-turso-using-workers/)
- [Drizzle + Turso Integration](https://orm.drizzle.team/docs/tutorials/drizzle-with-turso)
- [Turso Pricing](https://turso.tech/pricing)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
