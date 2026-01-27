# AI Router - Implementation Plan

> A lean AI proxy service powered by x402 payments. OpenRouter-like functionality with Solana USDC payments.

## Overview

**Goal**: Pure passthrough AI proxy - no conversation storage, dynamic pricing from models.dev, OpenAI + Anthropic only.

**Key Differences from `apps/ai`**:
- No session/message/artifact storage (removes 5 DB tables)
- Catalog-based pricing (no hardcoded PRICING object)
- Model resolution from catalog (not prefix-based)
- Simpler provider handlers (pure forward + bill)

## Architecture

```
apps/router/
├── scripts/
│   └── update-catalog.ts      # Fetch from models.dev → generate catalog
├── src/
│   ├── catalog/
│   │   └── index.ts           # AUTO-GENERATED - models with pricing
│   ├── providers/
│   │   ├── types.ts           # Provider interface
│   │   ├── openai.ts          # OpenAI passthrough
│   │   ├── anthropic.ts       # Anthropic passthrough
│   │   └── resolver.ts        # Model → provider resolution
│   ├── services/
│   │   ├── pricing.ts         # Cost calculation from catalog
│   │   ├── balance.ts         # Credit management
│   │   └── x402.ts            # Payment handling
│   ├── middleware/
│   │   ├── auth.ts            # Wallet signature verification
│   │   └── balance-check.ts   # 402 if low balance
│   ├── routes/
│   │   ├── chat.ts            # POST /v1/chat/completions
│   │   ├── models.ts          # GET /v1/models
│   │   ├── balance.ts         # GET /v1/balance
│   │   ├── topup.ts           # POST /v1/topup
│   │   └── usage.ts           # GET /v1/usage (optional)
│   ├── config.ts              # Environment config
│   └── index.ts               # Hono app entry
├── db/
│   ├── index.ts               # Drizzle client
│   └── schema/
│       ├── index.ts
│       ├── users.ts           # Wallet balances
│       ├── transactions.ts    # Usage logs (topup/deduction)
│       └── payment-logs.ts    # x402 settlement logs
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Database Schema (Minimal)

Only 3 tables - no conversation storage:

```sql
-- users: wallet balances
CREATE TABLE users (
  wallet_address TEXT PRIMARY KEY,
  balance_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,8) NOT NULL DEFAULT 0,
  total_topups NUMERIC(10,2) NOT NULL DEFAULT 0,
  request_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_request TIMESTAMP
);

-- transactions: usage logs
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES users(wallet_address),
  type TEXT NOT NULL, -- 'topup' | 'deduction'
  amount_usd NUMERIC(12,8) NOT NULL,
  tx_signature TEXT, -- for topups
  provider TEXT,
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  balance_before NUMERIC(12,8) NOT NULL,
  balance_after NUMERIC(12,8) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- payment_logs: x402 idempotency
CREATE TABLE payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES users(wallet_address),
  tx_signature TEXT UNIQUE NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Catalog System

### Source
- URL: `https://models.dev/api.json`
- Filter: `openai` and `anthropic` providers only

### Generated Format
```typescript
// src/catalog/index.ts (AUTO-GENERATED)
export type ProviderId = 'openai' | 'anthropic';

export interface ModelCost {
  input: number;      // per 1M tokens
  output: number;     // per 1M tokens
  cacheRead?: number; // per 1M tokens
}

export interface ModelInfo {
  id: string;
  label?: string;
  cost?: ModelCost;
  limit?: { context?: number; output?: number };
  toolCall?: boolean;
  reasoning?: boolean;
}

export interface ProviderEntry {
  id: ProviderId;
  models: ModelInfo[];
}

export const catalog: Record<ProviderId, ProviderEntry> = { ... };
```

### Update Script
```bash
bun run scripts/update-catalog.ts
```

## API Endpoints

### `POST /v1/chat/completions`
OpenAI-compatible chat endpoint.

**Headers**:
- `x-wallet-address`: Solana wallet pubkey
- `x-wallet-signature`: Signed nonce
- `x-wallet-nonce`: Timestamp nonce

**Flow**:
1. Auth (verify signature)
2. Balance check (402 if low)
3. Resolve provider from model
4. Forward request to provider
5. Stream/return response
6. Deduct cost from balance

### `GET /v1/models`
List available models with pricing.

**Response**:
```json
{
  "data": [
    {
      "id": "gpt-4o",
      "provider": "openai",
      "pricing": { "input": 2.5, "output": 10.0 }
    }
  ]
}
```

### `GET /v1/balance`
Check wallet balance.

### `POST /v1/topup`
Process x402 payment.

### `GET /v1/usage`
Recent transaction history (optional).

## Implementation Steps

### Phase 1: Foundation
1. [x] Create directory structure
2. [ ] Create `scripts/update-catalog.ts`
3. [ ] Run catalog generation
4. [ ] Create `src/catalog/index.ts` types

### Phase 2: Database
5. [ ] Create `db/schema/*.ts`
6. [ ] Create `db/index.ts` (drizzle client)
7. [ ] Create `drizzle.config.ts`

### Phase 3: Core Services
8. [ ] Create `src/config.ts`
9. [ ] Create `src/services/pricing.ts`
10. [ ] Create `src/services/balance.ts`
11. [ ] Create `src/services/x402.ts`

### Phase 4: Providers
12. [ ] Create `src/providers/types.ts`
13. [ ] Create `src/providers/resolver.ts`
14. [ ] Create `src/providers/openai.ts`
15. [ ] Create `src/providers/anthropic.ts`

### Phase 5: Routes
16. [ ] Create `src/middleware/auth.ts`
17. [ ] Create `src/middleware/balance-check.ts`
18. [ ] Create `src/routes/chat.ts`
19. [ ] Create `src/routes/models.ts`
20. [ ] Create `src/routes/balance.ts`
21. [ ] Create `src/routes/topup.ts`

### Phase 6: Entry Point
22. [ ] Create `src/index.ts`
23. [ ] Create `Dockerfile`
24. [ ] Add to `infra/router.ts` (SST)

## Key Design Decisions

1. **No Conversation Storage**: Pure proxy - client manages history
2. **Catalog-Based Pricing**: Single source of truth from models.dev
3. **Post-Hoc Billing**: Bill after response (simpler, handles streaming)
4. **Provider from Catalog**: Model lookup determines provider (not prefix)
5. **Minimal Dependencies**: Reuse patterns from `apps/ai` but leaner

## Config

```typescript
// src/config.ts
export const config = {
  port: 4001,
  minBalance: 0.05,
  markup: 1.005, // 0.5% markup
  
  openai: { apiKey: Resource.OpenAiApiKey.value },
  anthropic: { apiKey: Resource.AnthropicApiKey.value },
  
  facilitator: { url: 'https://facilitator.payai.network' },
  
  payment: {
    companyWallet: Resource.PlatformWallet.value,
    network: 'solana', // or 'solana-devnet'
    usdcMint: '...',
  },
};
```

## Testing

```bash
# Start dev server
bun run dev

# Test chat completion
curl -X POST http://localhost:4001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: <WALLET>" \
  -H "x-wallet-signature: <SIG>" \
  -H "x-wallet-nonce: <NONCE>" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```
