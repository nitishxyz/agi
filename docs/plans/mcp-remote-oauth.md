# MCP Remote Transport & OAuth Support Plan

## Problem

ottocode currently only supports **stdio** MCP servers — local processes spawned as child processes. Many popular MCP servers (Linear, Notion, Sentry, Asana, Stripe, GitHub via HTTP) are **remote** and use HTTP/SSE transports with **OAuth 2.0** authentication. Users cannot connect to these servers today.

## Current State

```
MCPServerConfig {
  name: string;        // e.g. "helius"
  command: string;     // e.g. "npx"
  args?: string[];     // e.g. ["-y", "helius-mcp@latest"]
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}
```

- Only `StdioClientTransport` is used
- API key auth via `env` field works
- No concept of transport type, URL, headers, or OAuth

## Target State

```
MCPServerConfig {
  name: string;
  transport: "stdio" | "http" | "sse";      // NEW — default "stdio"

  // stdio fields (existing)
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;

  // http/sse fields (NEW)
  url?: string;                              // e.g. "https://mcp.linear.app/mcp"
  headers?: Record<string, string>;          // e.g. { "Authorization": "Bearer xxx" }

  // oauth fields (NEW)
  oauth?: {
    clientId?: string;                       // pre-registered client ID
    clientSecret?: string;                   // stored in credential store, NOT config
    callbackPort?: number;                   // localhost port for redirect
    scopes?: string[];                       // requested scopes
  };

  disabled?: boolean;
}
```

## MCP SDK Available Transports

The `@modelcontextprotocol/sdk` (v1.26+) already provides everything we need:

| Transport | Class | Use Case |
|-----------|-------|----------|
| **stdio** | `StdioClientTransport` | Local process servers (current) |
| **SSE** | `SSEClientTransport` | Remote servers (legacy, deprecated) |
| **HTTP** | `StreamableHTTPClientTransport` | Remote servers (recommended) |

All remote transports accept an `authProvider?: OAuthClientProvider` option for OAuth.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  MCPClientWrapper                      │
│                                                        │
│  connect() → switch(config.transport) {                │
│    "stdio" → StdioClientTransport (existing)          │
│    "http"  → StreamableHTTPClientTransport (new)      │
│    "sse"   → SSEClientTransport (new, legacy)         │
│  }                                                     │
│                                                        │
│  If url requires OAuth:                                │
│    → OttoOAuthProvider handles the flow                │
│    → Opens browser for user consent                    │
│    → Receives callback on localhost                     │
│    → Stores tokens in credential store                 │
│    → Attaches tokens to transport                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│               OttoOAuthProvider                        │
│  implements OAuthClientProvider                        │
│                                                        │
│  redirectUrl      → http://localhost:{port}/callback   │
│  clientMetadata   → { name: "ottocode", ... }         │
│  tokens()         → load from credential store         │
│  saveTokens()     → persist to credential store        │
│  redirectToAuth() → open browser via child_process     │
│  codeVerifier()   → PKCE flow support                  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│             OAuth Credential Store                     │
│                                                        │
│  Location: ~/.config/otto/oauth/                       │
│  Files:    {server-name}.json                          │
│  Content:  { tokens, clientInfo, codeVerifier }        │
│                                                        │
│  Encryption: optional, use OS keychain if available    │
└──────────────────────────────────────────────────────┘
```

## OAuth Flow (User Perspective)

1. User adds remote server: `otto mcp add --transport http linear https://mcp.linear.app/mcp`
2. User clicks ▶ Start in the sidebar (or `otto mcp start linear`)
3. Server returns 401 → `UnauthorizedError` is thrown
4. ottocode detects the error, initiates OAuth:
   a. Discovers OAuth metadata from server (`/.well-known/oauth-authorization-server`)
   b. Dynamically registers as OAuth client (if server supports it)
   c. Generates PKCE code verifier + challenge
   d. Opens browser to authorization URL
   e. Starts temporary localhost HTTP server on callback port
5. User authorizes in browser → redirected to localhost callback
6. ottocode exchanges authorization code for tokens
7. Reconnects transport with Bearer token
8. Server status turns green, tools are indexed

## Implementation Plan

### Phase 1: Static Headers & HTTP Transport

**Goal**: Support remote servers with pre-configured Bearer tokens.

**Config example**:
```json
{
  "name": "linear",
  "transport": "http",
  "url": "https://mcp.linear.app/mcp",
  "headers": { "Authorization": "Bearer lin_api_xxx" }
}
```

**Changes**:

1. **`packages/sdk/src/core/src/mcp/types.ts`** — Extend `MCPServerConfig`:
   - Add `transport?: "stdio" | "http" | "sse"` (default: `"stdio"`)
   - Add `url?: string`
   - Add `headers?: Record<string, string>`

2. **`packages/sdk/src/core/src/mcp/client.ts`** — Update `MCPClientWrapper.connect()`:
   - Import `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk/client/streamableHttp.js`
   - Import `SSEClientTransport` from `@modelcontextprotocol/sdk/client/sse.js`
   - Switch on `config.transport` to create the appropriate transport
   - Pass `headers` as `requestInit.headers` for HTTP/SSE transports
   - Change private `transport` type to `Transport` (base interface) instead of `StdioClientTransport`

3. **`packages/server/src/routes/mcp.ts`** — Update POST `/v1/mcp/servers`:
   - Accept `transport`, `url`, `headers` fields

4. **`packages/web-sdk/src/components/mcp/AddMCPServerModal.tsx`** — Add transport selector:
   - Radio/tab for "Local (stdio)" vs "Remote (HTTP)"
   - Show URL + Headers fields when Remote is selected
   - Show Command + Args when Local is selected

5. **`apps/cli/src/commands/mcp.ts`** — Update `otto mcp add`:
   - Add `--transport http|sse|stdio` flag
   - Add `--header "Key: Value"` flag (repeatable)
   - Syntax: `otto mcp add --transport http linear https://mcp.linear.app/mcp`

6. **Validation**: `url` required when transport is `"http"` or `"sse"`, `command` required when `"stdio"`.

**Effort**: ~2-3 hours

### Phase 2: OAuth Credential Store

**Goal**: Persist and load OAuth tokens securely.

**Changes**:

1. **`packages/sdk/src/core/src/mcp/oauth/store.ts`** — Create `OAuthCredentialStore`:
   ```
   class OAuthCredentialStore {
     constructor(storePath: string)   // ~/.config/otto/oauth/
     async loadTokens(serverName: string): Promise<OAuthTokens | null>
     async saveTokens(serverName: string, tokens: OAuthTokens): Promise<void>
     async loadClientInfo(serverName: string): Promise<OAuthClientInfo | null>
     async saveClientInfo(serverName: string, info: OAuthClientInfo): Promise<void>
     async loadCodeVerifier(serverName: string): Promise<string | null>
     async saveCodeVerifier(serverName: string, verifier: string): Promise<void>
     async clearServer(serverName: string): Promise<void>
   ```
   - Store as JSON files in `~/.config/otto/oauth/{server-name}.json`
   - Tokens include `access_token`, `refresh_token`, `expires_at`
   - Ensure directory permissions are restrictive (0700)

2. **Security considerations**:
   - Never store tokens in `.otto/config.json` (checked into git)
   - Never log tokens
   - `client_secret` stored in credential store, not config
   - Consider OS keychain integration later (macOS Keychain, Linux Secret Service)

**Effort**: ~1-2 hours

### Phase 3: OAuth Flow Implementation

**Goal**: Full browser-based OAuth 2.0 + PKCE flow.

**Changes**:

1. **`packages/sdk/src/core/src/mcp/oauth/provider.ts`** — Create `OttoOAuthProvider`:
   ```
   class OttoOAuthProvider implements OAuthClientProvider {
     constructor(serverName: string, store: OAuthCredentialStore, options?: {
       clientId?: string;
       callbackPort?: number;
       scopes?: string[];
     })

     get redirectUrl()        → `http://localhost:${port}/callback`
     get clientMetadata()     → { client_name: "ottocode", redirect_uris: [...] }
     clientInformation()      → load from store
     saveClientInformation()  → persist to store
     tokens()                 → load from store
     saveTokens()             → persist to store
     redirectToAuthorization() → open browser + start callback server
     saveCodeVerifier()       → persist to store
     codeVerifier()           → load from store
   ```

2. **`packages/sdk/src/core/src/mcp/oauth/callback.ts`** — Create `OAuthCallbackServer`:
   ```
   class OAuthCallbackServer {
     constructor(port: number)
     waitForCallback(timeout?: number): Promise<{ code: string; state?: string }>
     close(): void
   }
   ```
   - Temporary HTTP server on `localhost:{port}`
   - Listens for GET `/callback?code=xxx&state=yyy`
   - Returns HTML success page, auto-closes
   - Times out after 5 minutes

3. **Update `MCPClientWrapper.connect()`**:
   - If transport is `http`/`sse` and no static `Authorization` header:
     - Create `OttoOAuthProvider` with credential store
     - Pass as `authProvider` to transport constructor
   - Catch `UnauthorizedError`:
     - Log auth status to server events
     - Emit `mcp.auth.required` event for UI
     - Re-attempt connection after auth completes

4. **`packages/sdk/src/core/src/mcp/oauth/index.ts`** — Re-export everything

**Effort**: ~4-6 hours

### Phase 4: Server-Side OAuth API Routes

**Goal**: Expose OAuth state to the web UI.

**Changes**:

1. **`packages/server/src/routes/mcp.ts`** — Add OAuth routes:
   - `POST /v1/mcp/servers/:name/auth` — Initiate OAuth flow
     - Returns `{ ok: true, authUrl: "...", callbackPort: 8090 }` or triggers browser open
   - `POST /v1/mcp/servers/:name/auth/callback` — Complete OAuth (receive code)
     - Body: `{ code: "xxx", state: "yyy" }`
     - Exchanges code for tokens, reconnects
   - `DELETE /v1/mcp/servers/:name/auth` — Clear stored OAuth tokens
   - `GET /v1/mcp/servers/:name/auth/status` — Check auth state
     - Returns `{ authenticated: boolean, expiresAt?: number }`

2. **Update server list response** — Add auth status:
   ```json
   {
     "name": "linear",
     "transport": "http",
     "url": "https://mcp.linear.app/mcp",
     "connected": false,
     "authRequired": true,
     "authenticated": false,
     "tools": []
   }
   ```

**Effort**: ~2-3 hours

### Phase 5: Web UI OAuth Flow

**Goal**: In-browser OAuth experience.

**Changes**:

1. **`packages/web-sdk/src/components/mcp/MCPSidebar.tsx`** — Update server cards:
   - Show "Authenticate" button when `authRequired && !authenticated`
   - Show lock icon for OAuth-protected servers
   - Show "Connected (OAuth)" badge when authenticated
   - Show "Revoke" option in hover menu

2. **`packages/web-sdk/src/components/mcp/OAuthStatusBadge.tsx`** — New component:
   - Green lock: authenticated
   - Yellow lock: token expiring soon
   - Red lock: needs re-authentication

3. **`packages/web-sdk/src/hooks/useMCP.ts`** — Add OAuth hooks:
   - `useAuthenticateMCPServer()` — POST to `/auth`, opens popup/redirect
   - `useRevokeMCPAuth()` — DELETE to `/auth`
   - `useMCPAuthStatus()` — poll auth status

4. **OAuth popup/redirect flow**:
   - When user clicks "Authenticate":
     - POST `/v1/mcp/servers/:name/auth` → get `authUrl`
     - Open `authUrl` in new tab/popup
     - Poll `/v1/mcp/servers/:name/auth/status` until authenticated
     - Auto-reconnect server once tokens are available

**Effort**: ~3-4 hours

### Phase 6: CLI OAuth Support

**Goal**: `otto mcp auth linear` triggers browser OAuth from terminal.

**Changes**:

1. **`apps/cli/src/commands/mcp.ts`** — Add subcommands:
   - `otto mcp auth <name>` — initiate OAuth, open browser, wait for callback
   - `otto mcp auth <name> --revoke` — clear stored tokens
   - `otto mcp auth <name> --status` — show auth state

2. **Terminal flow**:
   ```
   $ otto mcp auth linear
   🔐 Opening browser for Linear authorization...
   ⏳ Waiting for callback on http://localhost:8090/callback...
   ✅ Authenticated! Token stored for "linear".
   ```

3. **Pre-configured credentials** (for CI/non-interactive):
   - `otto mcp add --transport http --client-id xxx --header "Authorization: Bearer token" linear https://mcp.linear.app/mcp`

**Effort**: ~2 hours

## Config Examples

### Remote server with API key (Phase 1)
```json
{
  "name": "github",
  "transport": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": { "Authorization": "Bearer ghp_xxxx" }
}
```

### Remote server with OAuth (Phase 3+)
```json
{
  "name": "linear",
  "transport": "http",
  "url": "https://mcp.linear.app/mcp",
  "oauth": {
    "callbackPort": 8090
  }
}
```

### Remote server with pre-registered OAuth client (Phase 3+)
```json
{
  "name": "notion",
  "transport": "http",
  "url": "https://mcp.notion.com/mcp",
  "oauth": {
    "clientId": "my-client-id",
    "callbackPort": 8090,
    "scopes": ["read", "write"]
  }
}
```

### SSE server (legacy, Phase 1)
```json
{
  "name": "asana",
  "transport": "sse",
  "url": "https://mcp.asana.com/sse",
  "headers": { "Authorization": "Bearer asana_token" }
}
```

## CLI Examples

```bash
# Phase 1: Add remote server with Bearer token
otto mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer ghp_xxxx"

# Phase 1: Add remote server (will need OAuth later)
otto mcp add --transport http linear https://mcp.linear.app/mcp

# Phase 3: Authenticate with OAuth
otto mcp auth linear

# Phase 3: Pre-configured OAuth client
otto mcp add --transport http --client-id xxx notion https://mcp.notion.com/mcp
otto mcp auth notion

# Phase 6: Revoke auth
otto mcp auth linear --revoke
```

## Known Remote MCP Servers

| Server | URL | Auth | Transport |
|--------|-----|------|-----------|
| Linear | `https://mcp.linear.app/mcp` | OAuth | HTTP |
| Notion | `https://mcp.notion.com/mcp` | OAuth | HTTP |
| Sentry | `https://mcp.sentry.dev/mcp` | OAuth | HTTP |
| Stripe | `https://mcp.stripe.com` | OAuth | HTTP |
| GitHub | `https://api.githubcopilot.com/mcp/` | OAuth | HTTP |
| Asana | `https://mcp.asana.com/sse` | OAuth | SSE |
| PayPal | `https://mcp.paypal.com/mcp` | OAuth | HTTP |
| HubSpot | `https://mcp.hubspot.com/anthropic` | OAuth | HTTP |

## Dependencies

- `@modelcontextprotocol/sdk` v1.26+ (already installed) — provides:
  - `StreamableHTTPClientTransport`
  - `SSEClientTransport`
  - `OAuthClientProvider` interface
  - `UnauthorizedError` class
  - `auth.ts` helper functions

No additional dependencies needed.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OAuth tokens stored insecurely | Phase 2 restricts file permissions; future: OS keychain |
| Dynamic client registration rejected | Support pre-configured `clientId` fallback |
| Callback port conflict | Allow user to configure `callbackPort`; try fallback ports |
| Token refresh fails | Detect 401, clear tokens, prompt re-auth |
| CORS issues with browser redirect | Callback is localhost, not cross-origin |
| Server doesn't support PKCE | MCP spec requires PKCE; fall back gracefully |

## Estimated Total Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Static Headers + HTTP/SSE Transport | 2-3 hours | **P0** — enables most use cases |
| Phase 2: OAuth Credential Store | 1-2 hours | P1 |
| Phase 3: OAuth Flow Implementation | 4-6 hours | P1 |
| Phase 4: Server-Side OAuth Routes | 2-3 hours | P1 |
| Phase 5: Web UI OAuth Flow | 3-4 hours | P2 |
| Phase 6: CLI OAuth Support | 2 hours | P2 |
| **Total** | **14-20 hours** | |

Phase 1 alone unlocks the majority of remote MCP servers for users who can provide API keys or Bearer tokens. Phases 2-4 enable zero-config OAuth. Phases 5-6 polish the experience.
