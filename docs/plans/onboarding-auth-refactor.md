# Onboarding & Auth Refactor Plan

## Overview

Refactor authentication to SDK + Server, enabling a web-first onboarding experience where users can start using AGI with zero friction. A Setu wallet is auto-created on first load, with optional provider setup.

## Current State

### SDK (`packages/sdk/src/auth/src/`)
- `index.ts` - `getAllAuth()`, `setAuth()`, `removeAuth()`, exports OAuth flows
- `oauth.ts` - Anthropic OAuth (Claude Max + Console API key)
- `openai-oauth.ts` - OpenAI OAuth (ChatGPT Plus/Pro)
- Types: `ApiAuth`, `OAuth`, `WalletAuth` in `types/src/auth.ts`

### CLI (`apps/cli/src/auth.ts`)
- `runAuthLoginSetu()` - wallet create/import logic (lines 489-544)
- Uses `Keypair.generate()` from `@solana/web3.js`
- Stores as `{ type: 'wallet', secret: base58PrivateKey }`

### Server (`packages/server/src/routes/`)
- `setu.ts` - balance, wallet info, USDC balance, Polar topup
- `config/` - providers, defaults, models (reads auth but doesn't manage it)
- **No auth management endpoints exist**

### Web UI (`packages/web-sdk/src/`)
- Settings sidebar shows Setu wallet, QR, balance, topup
- `SetuTopupModal.tsx` - card payment via Polar
- `useSetuBalance.ts`, `useSetuPayments.ts`, `setuStore.ts`
- **No onboarding flow exists**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                            SDK                                  │
│  packages/sdk/src/auth/src/                                     │
│  ├── wallet.ts (NEW)                                            │
│  │   ├── generateWallet() → { privateKey, publicKey }           │
│  │   ├── importWallet(privateKey) → { privateKey, publicKey }   │
│  │   ├── getSetuWallet() → WalletInfo | null                    │
│  │   └── ensureSetuWallet() → WalletInfo (creates if missing)   │
│  ├── index.ts (existing + re-exports wallet functions)          │
│  └── oauth.ts, openai-oauth.ts (unchanged)                      │
│                                                                 │
│  packages/sdk/src/types/src/config.ts                           │
│  └── Add onboardingComplete?: boolean to config                 │
│                                                                 │
│  packages/sdk/src/config/src/manager.ts                         │
│  └── Add get/setOnboardingComplete() using existing config      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                           Server                                │
│  packages/server/src/routes/auth.ts (NEW)                       │
│  ├── GET  /v1/auth/status         → onboarding + provider state │
│  ├── POST /v1/auth/setu/setup     → auto-generate wallet        │
│  ├── POST /v1/auth/setu/import    → import existing wallet      │
│  ├── POST /v1/auth/:provider      → add provider (API key)      │
│  ├── GET  /v1/auth/:provider/oauth/start → initiate OAuth       │
│  ├── GET  /v1/auth/:provider/oauth/callback → OAuth callback    │
│  ├── POST /v1/auth/onboarding/complete → mark onboarding done   │
│  └── DELETE /v1/auth/:provider    → remove provider             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          Web UI                                 │
│  packages/web-sdk/src/components/onboarding/ (NEW)              │
│  ├── OnboardingModal.tsx          → multi-step modal container  │
│  ├── steps/                                                     │
│  │   ├── WalletSetupStep.tsx      → auto-create, show QR/addr   │
│  │   ├── ProvidersStep.tsx        → optional provider setup     │
│  │   └── DefaultsStep.tsx         → provider/model/approval     │
│  ├── ProviderCard.tsx             → provider with model info    │
│  └── ProviderSetupModal.tsx       → API key / OAuth setup       │
│                                                                 │
│  Hooks:                                                         │
│  ├── useAuthStatus.ts             → fetch /v1/auth/status       │
│  └── useProviderSetup.ts          → provider add/remove         │
│                                                                 │
│  Stores:                                                        │
│  └── onboardingStore.ts           → step, completion state      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: SDK Wallet Module + Config Extension

**File: `packages/sdk/src/auth/src/wallet.ts`**

```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getAuth, setAuth } from './index.ts';

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
}

export function generateWallet(): WalletInfo {
  const keypair = Keypair.generate();
  return {
    privateKey: bs58.encode(keypair.secretKey),
    publicKey: keypair.publicKey.toBase58(),
  };
}

export function importWallet(privateKey: string): WalletInfo {
  const privateKeyBytes = bs58.decode(privateKey);
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  return {
    privateKey,
    publicKey: keypair.publicKey.toBase58(),
  };
}

export async function getSetuWallet(projectRoot?: string): Promise<WalletInfo | null> {
  const auth = await getAuth('setu', projectRoot);
  if (auth?.type === 'wallet' && auth.secret) {
    return importWallet(auth.secret);
  }
  return null;
}

export async function ensureSetuWallet(projectRoot?: string): Promise<WalletInfo> {
  const existing = await getSetuWallet(projectRoot);
  if (existing) return existing;
  
  const wallet = generateWallet();
  await setAuth('setu', { type: 'wallet', secret: wallet.privateKey }, projectRoot, 'global');
  return wallet;
}
```

**Update `packages/sdk/src/types/src/config.ts`** - Add to AGIConfig:

```typescript
export type AGIConfig = {
  projectRoot: string;
  defaults: DefaultConfig;
  providers: Record<ProviderId, ProviderConfig>;
  paths: PathConfig;
  onboardingComplete?: boolean;  // NEW
};
```

**Update `packages/sdk/src/config/src/manager.ts`** - Add helper functions:

```typescript
export async function getOnboardingComplete(projectRoot?: string): Promise<boolean> {
  const { cfg } = await read(projectRoot);
  // Check global config for onboardingComplete flag
  const globalPath = getGlobalConfigPath();
  const f = Bun.file(globalPath);
  if (await f.exists()) {
    const data = await f.json();
    return data?.onboardingComplete === true;
  }
  return false;
}

export async function setOnboardingComplete(projectRoot?: string): Promise<void> {
  const globalPath = getGlobalConfigPath();
  const base = getGlobalConfigDir();
  
  let existing = {};
  const f = Bun.file(globalPath);
  if (await f.exists()) {
    existing = await f.json();
  }
  
  const next = { ...existing, onboardingComplete: true };
  
  try {
    const { promises: fs } = await import('node:fs');
    await fs.mkdir(base, { recursive: true }).catch(() => {});
  } catch {}
  
  await Bun.write(globalPath, JSON.stringify(next, null, 2));
}
```

---

### Phase 2: Server Auth Routes

**File: `packages/server/src/routes/auth.ts` (NEW)**

```typescript
import type { Hono } from 'hono';
import {
  getAllAuth,
  setAuth,
  removeAuth,
  ensureSetuWallet,
  getSetuWallet,
  importWallet,
  loadConfig,
  catalog,
  getOnboardingComplete,
  setOnboardingComplete,
  authorize,
  exchange,
  authorizeOpenAI,
  exchangeOpenAI,
  type ProviderId,
} from '@agi-cli/sdk';

// In-memory store for OAuth verifiers
const oauthVerifiers = new Map<string, { verifier: string; provider: string; createdAt: number }>();

export function registerAuthRoutes(app: Hono) {
  // GET /v1/auth/status - Onboarding + provider status
  app.get('/v1/auth/status', async (c) => {
    const projectRoot = process.cwd();
    const auth = await getAllAuth(projectRoot);
    const cfg = await loadConfig(projectRoot);
    const onboardingComplete = await getOnboardingComplete(projectRoot);
    const setuWallet = await getSetuWallet(projectRoot);
    
    const providers: Record<string, { 
      configured: boolean; 
      type?: 'api' | 'oauth' | 'wallet';
      label: string;
      supportsOAuth: boolean;
      modelCount: number;
      costRange?: { min: number; max: number };
    }> = {};
    
    for (const [id, entry] of Object.entries(catalog)) {
      const providerAuth = auth[id as ProviderId];
      const models = entry.models || [];
      const costs = models
        .map(m => m.cost?.input)
        .filter((c): c is number => c !== undefined);
      
      providers[id] = {
        configured: !!providerAuth,
        type: providerAuth?.type,
        label: entry.label || id,
        supportsOAuth: id === 'anthropic' || id === 'openai',
        modelCount: models.length,
        costRange: costs.length > 0 ? {
          min: Math.min(...costs),
          max: Math.max(...costs),
        } : undefined,
      };
    }
    
    return c.json({
      onboardingComplete,
      setu: setuWallet ? {
        configured: true,
        publicKey: setuWallet.publicKey,
      } : {
        configured: false,
      },
      providers,
      defaults: cfg.defaults,
    });
  });

  // POST /v1/auth/setu/setup - Auto-generate wallet
  app.post('/v1/auth/setu/setup', async (c) => {
    const projectRoot = process.cwd();
    const existing = await getSetuWallet(projectRoot);
    const wallet = await ensureSetuWallet(projectRoot);
    
    return c.json({
      success: true,
      publicKey: wallet.publicKey,
      isNew: !existing,
    });
  });

  // POST /v1/auth/setu/import - Import existing wallet
  app.post('/v1/auth/setu/import', async (c) => {
    const { privateKey } = await c.req.json<{ privateKey: string }>();
    
    if (!privateKey) {
      return c.json({ error: 'Private key required' }, 400);
    }
    
    try {
      const wallet = importWallet(privateKey);
      await setAuth('setu', { type: 'wallet', secret: privateKey }, undefined, 'global');
      
      return c.json({
        success: true,
        publicKey: wallet.publicKey,
      });
    } catch {
      return c.json({ error: 'Invalid private key format' }, 400);
    }
  });

  // POST /v1/auth/:provider - Add provider with API key
  app.post('/v1/auth/:provider', async (c) => {
    const provider = c.req.param('provider') as ProviderId;
    const { apiKey } = await c.req.json<{ apiKey: string }>();
    
    if (!catalog[provider]) {
      return c.json({ error: 'Unknown provider' }, 400);
    }
    
    if (!apiKey) {
      return c.json({ error: 'API key required' }, 400);
    }
    
    await setAuth(provider, { type: 'api', key: apiKey }, undefined, 'global');
    
    return c.json({ success: true, provider });
  });

  // GET /v1/auth/:provider/oauth/start - Initiate OAuth flow
  app.get('/v1/auth/:provider/oauth/start', async (c) => {
    const provider = c.req.param('provider');
    const mode = c.req.query('mode') || 'max';
    
    try {
      let url: string;
      let verifier: string;
      
      if (provider === 'anthropic') {
        const result = await authorize(mode as 'max' | 'console');
        url = result.url;
        verifier = result.verifier;
      } else if (provider === 'openai') {
        const result = await authorizeOpenAI();
        url = result.url;
        verifier = result.verifier;
      } else {
        return c.json({ error: 'OAuth not supported for this provider' }, 400);
      }
      
      const sessionId = crypto.randomUUID();
      oauthVerifiers.set(sessionId, { verifier, provider, createdAt: Date.now() });
      
      c.header('Set-Cookie', `oauth_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
      
      return c.redirect(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth initialization failed';
      return c.json({ error: message }, 500);
    }
  });

  // GET /v1/auth/:provider/oauth/callback - OAuth callback
  app.get('/v1/auth/:provider/oauth/callback', async (c) => {
    const provider = c.req.param('provider');
    const code = c.req.query('code');
    const fragment = c.req.query('fragment');
    
    const cookies = c.req.header('Cookie') || '';
    const sessionMatch = cookies.match(/oauth_session=([^;]+)/);
    const sessionId = sessionMatch?.[1];
    
    if (!sessionId || !oauthVerifiers.has(sessionId)) {
      return c.html('<html><body><h1>Session expired</h1><script>window.close();</script></body></html>');
    }
    
    const { verifier } = oauthVerifiers.get(sessionId)!;
    oauthVerifiers.delete(sessionId);
    
    try {
      if (provider === 'anthropic') {
        const fullCode = fragment ? `${code}#${fragment}` : code;
        const tokens = await exchange(fullCode!, verifier);
        
        await setAuth('anthropic', {
          type: 'oauth',
          refresh: tokens.refresh,
          access: tokens.access,
          expires: tokens.expires,
        }, undefined, 'global');
      } else if (provider === 'openai') {
        const tokens = await exchangeOpenAI(code!, verifier);
        
        await setAuth('openai', {
          type: 'oauth',
          refresh: tokens.refresh,
          access: tokens.access,
          expires: tokens.expires,
          accountId: tokens.accountId,
          idToken: tokens.idToken,
        }, undefined, 'global');
      }
      
      return c.html(`
        <html>
          <body>
            <h1>✓ Connected!</h1>
            <p>You can close this window.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-success', provider: '${provider}' }, '*');
              }
              setTimeout(() => window.close(), 1500);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      return c.html(`
        <html>
          <body>
            <h1>✗ Error</h1>
            <p>${message}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-error', provider: '${provider}', error: '${message}' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }
  });

  // POST /v1/auth/onboarding/complete - Mark onboarding as complete
  app.post('/v1/auth/onboarding/complete', async (c) => {
    await setOnboardingComplete();
    return c.json({ success: true });
  });

  // DELETE /v1/auth/:provider - Remove provider
  app.delete('/v1/auth/:provider', async (c) => {
    const provider = c.req.param('provider') as ProviderId;
    
    if (!catalog[provider]) {
      return c.json({ error: 'Unknown provider' }, 400);
    }
    
    await removeAuth(provider, undefined, 'global');
    
    return c.json({ success: true, provider });
  });
}
```

---

### Phase 3: Web UI Onboarding

#### Wide-Screen Layout - Step 1: Wallet + Providers

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  Welcome to AGI CLI                                  │
│                                                                                      │
│  ┌─────────────────────────────────────┬────────────────────────────────────────┐    │
│  │                                     │                                        │    │
│  │  ✓ Your wallet is ready             │   💳 Pay with Card                     │    │
│  │                                     │   ─────────────────────────            │    │
│  │  ┌───────────┐                      │   Top up your balance with             │    │
│  │  │           │  7xKp...3nYz [Copy]  │   credit card via Polar                │    │
│  │  │  QR CODE  │                      │                                        │    │
│  │  │           │  Balance: $0.00      │   [Add Funds →]                        │    │
│  │  └───────────┘                      │                                        │    │
│  │                                     │   ─────────────────────────            │    │
│  │                                     │   🪙 Or send USDC to your wallet       │    │
│  │                                     │                                        │    │
│  └─────────────────────────────────────┴────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─ Connected Providers ────────────────────────────────────────────────────────┐    │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐                  │    │
│  │  │ ✓ Anthropic (Claude Max) │  │ ✓ OpenAI (API Key)       │                  │    │
│  │  │   12 models · $0.25-$15  │  │   8 models · $0.15-$60   │                  │    │
│  │  └──────────────────────────┘  └──────────────────────────┘                  │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ▼ Add more providers (optional)                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │    │
│  │  │ ✦ Google         │  │ 🔀 OpenRouter    │  │ 🌙 Moonshot      │            │    │
│  │  │ 6 models         │  │ 100+ models      │  │ 3 models         │            │    │
│  │  │ $0.08-$5/1M      │  │ varies           │  │ $0.14-$0.60/1M   │            │    │
│  │  │ [API Key]        │  │ [API Key]        │  │ [API Key]        │            │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘            │    │
│  │                                                                              │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                                  │    │
│  │  │ 🤖 Anthropic     │  │ 🧠 OpenAI        │                                  │    │
│  │  │ 12 models        │  │ 8 models         │                                  │    │
│  │  │ $0.25-$15/1M     │  │ $0.15-$60/1M     │                                  │    │
│  │  │ [Key] [Max]      │  │ [Key] [ChatGPT]  │                                  │    │
│  │  └──────────────────┘  └──────────────────┘                                  │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│                                                                    [Next →]          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Key layout features:**
- **Side-by-side**: QR/wallet info on left, Card payment on right
- **Connected providers section**: Shows configured providers as compact cards (appears after adding, above the collapsible)
- **Grid layout for unconfigured providers**: Cards in a responsive grid inside the collapsible
- **As you add providers**: They move from the collapsible grid to the "Connected Providers" section above

#### Step 2: Defaults

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  Configure Defaults                                  │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                              │    │
│  │   Default Provider      [▼ Setu                              ]               │    │
│  │                                                                              │    │
│  │   Default Model         [▼ claude-sonnet-4-20250514          ]               │    │
│  │                                                                              │    │
│  │   Default Agent         [▼ build                             ]               │    │
│  │                                                                              │    │
│  │   Tool Approval         [▼ Auto (no approval needed)         ]               │    │
│  │                         ────────────────────────────────────                 │    │
│  │                         ○ Auto - tools run without asking                    │    │
│  │                         ○ Dangerous - approve writes/deletes only            │    │
│  │                         ○ All - approve every tool call                      │    │
│  │                                                                              │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│                                                        [← Back]    [Finish →]        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

### New Files
- `packages/sdk/src/auth/src/wallet.ts`
- `packages/server/src/routes/auth.ts`
- `packages/web-sdk/src/stores/onboardingStore.ts`
- `packages/web-sdk/src/hooks/useAuthStatus.ts`
- `packages/web-sdk/src/components/onboarding/OnboardingModal.tsx`
- `packages/web-sdk/src/components/onboarding/steps/WalletSetupStep.tsx`
- `packages/web-sdk/src/components/onboarding/steps/ProvidersStep.tsx`
- `packages/web-sdk/src/components/onboarding/steps/DefaultsStep.tsx`
- `packages/web-sdk/src/components/onboarding/ProviderCard.tsx`
- `packages/web-sdk/src/components/onboarding/ProviderSetupModal.tsx`

### Modified Files
- `packages/sdk/src/auth/src/index.ts` - add wallet exports
- `packages/sdk/src/types/src/config.ts` - add `onboardingComplete` field
- `packages/sdk/src/config/src/manager.ts` - add `get/setOnboardingComplete()`
- `packages/sdk/src/index.ts` - add wallet + onboarding exports
- `packages/server/src/index.ts` - register auth routes
- `packages/web-sdk/src/lib/api-client.ts` - add auth methods
- `packages/web-sdk/src/hooks/index.ts` - add auth hooks export
- `packages/web-sdk/src/stores/index.ts` - add onboarding store export
- `apps/cli/src/auth.ts` - use SDK wallet functions
- `apps/web/src/routes/__root.tsx` - add onboarding check

---

## User Flow

### First Time User

1. User runs `agi` from CLI
2. Server starts, web UI opens
3. Web UI loads → calls `GET /v1/auth/status`
4. `onboardingComplete: false` → show onboarding modal
5. Modal auto-calls `POST /v1/auth/setu/setup` → wallet created
6. Show wallet address (left), QR code, funding options (right)
7. User can optionally add providers → they appear in "Connected Providers" section
8. Click "Next" → defaults configuration step
9. Click "Finish" → calls `POST /v1/auth/onboarding/complete`
10. Onboarding complete, start chatting

### Returning User

1. User runs `agi`
2. Web UI loads → calls `GET /v1/auth/status`
3. `onboardingComplete: true` → skip onboarding
4. Go straight to chat

### OAuth Flow (Web)

1. User clicks "Claude Max" or "ChatGPT Plus/Pro"
2. Web opens popup: `/v1/auth/anthropic/oauth/start`
3. Server generates OAuth URL, stores verifier, redirects popup
4. User authorizes in popup
5. Provider redirects to `/v1/auth/anthropic/oauth/callback`
6. Server exchanges code for tokens, saves auth
7. Popup shows success, posts message to parent window
8. Parent receives message, closes popup, refreshes auth status
9. Provider card moves from "Add more" to "Connected Providers"

---

## Decisions Made

1. ✅ **Persist onboarding complete in existing config.json** - No separate state file needed
2. ✅ **Full OAuth support in web UI** - Popup flow for Anthropic Max + OpenAI ChatGPT
3. ✅ **Show model count/cost on provider cards** - Clean display with model count + cost range
4. ✅ **Wide-screen layout** - QR/wallet left, Card payment right, grid of provider cards
5. ✅ **Connected providers section** - Providers move up from collapsible when configured
6. ✅ **Free credits**: $0 initial, handle on Setu side later
7. ✅ **Card payment**: Polar (already integrated)
8. ✅ **Default provider**: Setu stays default, user can change in step 2

---

## Implementation Order

1. **SDK wallet.ts** - Core wallet functions
2. **SDK config updates** - Add `onboardingComplete` to config type + helpers
3. **Server auth routes** - API endpoints including OAuth
4. **Web SDK api-client** - Add auth methods
5. **Web SDK stores/hooks** - Onboarding state
6. **Web UI components** - Onboarding modal + steps + provider cards (wide-screen layout)
7. **Integration** - Root component check
8. **CLI update** - Use SDK wallet functions
9. **Testing** - End-to-end flow
