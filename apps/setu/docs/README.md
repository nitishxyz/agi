# Setu Router

**AI Proxy powered by x402 payments on Solana**

Pay for AI inference with USDC using your Solana wallet. No API keys needed - just sign transactions.

## Architecture

```
Client → Setu Router → OpenAI/Anthropic APIs
         ↓
   (Wallet Auth + x402 Payments + Usage Billing)
```

The router acts as a **pure passthrough proxy** to native AI provider APIs:

- **OpenAI models** → Proxied to `https://api.openai.com/v1/responses`
- **Anthropic models** → Proxied to `https://api.anthropic.com/v1/messages`

Request bodies are forwarded unchanged, preserving full feature parity with native APIs.

## Features

- 🔐 **Wallet Authentication** - Sign requests with your Solana wallet
- 💳 **USDC Payments** - Pay-as-you-go with x402 protocol
- 🔄 **Full Provider Parity** - Native API passthrough supports all features:
  - ✅ Anthropic prompt caching (`cache_control`)
  - ✅ OpenAI reasoning models (GPT-5 Pro, etc.)
  - ✅ Extended thinking (Claude with `thinking` enabled)
  - ✅ Tool/function calling
  - ✅ Vision/multimodal inputs
  - ✅ Streaming
- 📊 **Real-time Billing** - Costs injected in streaming responses
- 🚀 **AI SDK Compatible** - Works with Vercel AI SDK using native providers

## Quick Start

```bash
# Install dependencies
bun install

# Start the router (dev mode - uses Solana devnet)
bun run dev

# Or with SST
sst dev
```

## Environments

The router uses **devnet by default**. Only `STAGE=prod` uses mainnet.

| Environment | Network | USDC Mint | Min Top-up | Top-up Options |
|-------------|---------|-----------|------------|----------------|
| **Development** (default) | `solana-devnet` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | $0.10 | $0.10, $1, $5, $10 |
| **Production** (`STAGE=prod`) | `solana` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | $5.00 | $5, $10, $25, $50 |

```bash
# Development (default - anything other than prod)
STAGE=dev bun run dev

# Production (mainnet)
STAGE=prod bun run start
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | No | Service info and available endpoints |
| `/health` | GET | No | Health check |
| `/v1/models` | GET | No | List available models with pricing |
| `/v1/balance` | GET | Yes | Check wallet balance |
| `/v1/topup` | POST | Yes | Top up balance via x402 payment |
| `/v1/responses` | POST | Yes | OpenAI Responses API (passthrough) |
| `/v1/messages` | POST | Yes | Anthropic Messages API (passthrough) |

## Supported Models

Models are fetched from [models.dev](https://models.dev) and cached in `src/catalog/index.ts`.

### OpenAI (via `/v1/responses`)

| Model | Label | Input $/1M | Output $/1M | Context | Max Output |
|-------|-------|------------|-------------|---------|------------|
| `gpt-5` | GPT-5 | $1.25 | $10.00 | 400K | 128K |
| `gpt-5-mini` | GPT-5 Mini | $0.25 | $2.00 | 400K | 128K |
| `gpt-5-nano` | GPT-5 Nano | $0.05 | $0.40 | 400K | 128K |
| `gpt-5-pro` | GPT-5 Pro | $15.00 | $120.00 | 400K | 272K |
| `gpt-5-codex` | GPT-5-Codex | $1.25 | $10.00 | 400K | 128K |
| `gpt-5.1` | GPT-5.1 | $1.25 | $10.00 | 400K | 128K |
| `gpt-5.1-codex` | GPT-5.1 Codex | $1.25 | $10.00 | 400K | 128K |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex mini | $0.25 | $2.00 | 400K | 128K |
| `gpt-5.2` | GPT-5.2 | $1.75 | $14.00 | 400K | 128K |
| `gpt-5.2-pro` | GPT-5.2 Pro | $21.00 | $168.00 | 400K | 128K |
| `codex-mini-latest` | Codex Mini | $1.50 | $6.00 | 200K | 100K |

All OpenAI models support tool calling and reasoning.

### Anthropic (via `/v1/messages`)

| Model | Label | Input $/1M | Output $/1M | Context | Max Output |
|-------|-------|------------|-------------|---------|------------|
| `claude-sonnet-4-0` | Claude Sonnet 4 (latest) | $3.00 | $15.00 | 200K | 64K |
| `claude-sonnet-4-20250514` | Claude Sonnet 4 | $3.00 | $15.00 | 200K | 64K |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 (latest) | $3.00 | $15.00 | 200K | 64K |
| `claude-opus-4-0` | Claude Opus 4 (latest) | $15.00 | $75.00 | 200K | 32K |
| `claude-opus-4-1` | Claude Opus 4.1 (latest) | $15.00 | $75.00 | 200K | 32K |
| `claude-opus-4-5` | Claude Opus 4.5 (latest) | $5.00 | $25.00 | 200K | 64K |
| `claude-haiku-4-5` | Claude Haiku 4.5 (latest) | $1.00 | $5.00 | 200K | 64K |

All Anthropic models support tool calling and reasoning.

> **Note**: Run `bun run update-catalog` to refresh models from models.dev

## Authentication

All protected endpoints require wallet authentication via headers:

```
x-wallet-address: <solana-public-key>
x-wallet-signature: <base58-signature>
x-wallet-nonce: <timestamp-ms>
```

### How It Works

1. Generate a timestamp nonce
2. Sign the nonce with your wallet's private key
3. Include headers in every request

```typescript
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';

function createAuthHeaders(keypair: Keypair) {
  const nonce = Date.now().toString();
  const message = new TextEncoder().encode(nonce);
  const signature = nacl.sign.detached(message, keypair.secretKey);

  return {
    'x-wallet-address': keypair.publicKey.toBase58(),
    'x-wallet-signature': bs58.encode(signature),
    'x-wallet-nonce': nonce,
  };
}
```

### Nonce Expiry

Nonces are valid for **60 seconds**. Requests with stale nonces will be rejected with `401 Nonce expired`.

## x402 Payment Flow

When your balance falls below **$0.05**, the router returns `402 Payment Required`.

### 402 Response Format

```json
{
  "x402Version": 1,
  "error": {
    "message": "Balance too low. Please top up.",
    "type": "insufficient_balance",
    "current_balance": "0.00",
    "minimum_balance": "0.05",
    "topup_required": true
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-devnet",
      "maxAmountRequired": "100000",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "payTo": "<company-wallet>",
      "resource": "https://setu.agi.nitish.sh/v1/responses",
      "description": "Top-up required for API access (0.10 USD)",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 60,
      "extra": { "feePayer": "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" }
    },
    {
      "scheme": "exact",
      "network": "solana-devnet",
      "maxAmountRequired": "1000000",
      "description": "Top-up required for API access (1.00 USD)"
    }
  ]
}
```

The `accepts` array contains multiple top-up options. **The client picks any option** - typically the first/smallest.

### Top-up Amounts

| Environment | Available Amounts (micro-USDC) |
|-------------|--------------------------------|
| Development | $0.10 (100000), $1 (1000000), $5 (5000000), $10 (10000000) |
| Production | $5 (5000000), $10 (10000000), $25 (25000000), $50 (50000000) |

### Processing Payment

1. Client receives 402 with payment options in `accepts`
2. Client picks an option (e.g., first one)
3. Client builds and signs a USDC transfer transaction using x402 SDK
4. Client submits to `/v1/topup` with signed transaction
5. Router verifies payment via facilitator and credits balance
6. Client retries original request

### Top-up Request

```typescript
const response = await fetch('https://setu.agi.nitish.sh/v1/topup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...createAuthHeaders(keypair),
  },
  body: JSON.stringify({
    paymentPayload: {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { transaction: signedTxBase58 }
    },
    paymentRequirement: selectedAcceptOption
  })
});

const result = await response.json();
// { success: true, amount: 0.10, new_balance: "0.10000000", transaction: "..." }
```

### Top-up Response

**Success:**
```json
{
  "success": true,
  "amount": 0.10,
  "balance": 0.10,
  "new_balance": "0.10000000",
  "amount_usd": "0.10",
  "transaction": "TpMQGwMb..."
}
```

**Duplicate Transaction (safe retry):**
```json
{
  "success": true,
  "duplicate": true,
  "amount": 0.10,
  "balance": 0.10,
  "new_balance": "0.10000000",
  "transaction": "TpMQGwMb..."
}
```

Submitting the same transaction twice returns success with `duplicate: true` - no double-crediting.

## Cost Tracking

Prices include a **0.5% markup** over base provider rates.

### Non-Streaming Responses

Costs returned in response headers:
```
x-cost-usd: 0.00001234
x-balance-remaining: 4.99998766
```

### Streaming Responses

Costs injected as SSE comment at stream end:
```
: setu {"cost_usd":"0.00000904","balance_remaining":"4.99856275","input_tokens":20,"output_tokens":11}
```

Parse with:
```typescript
const lines = chunk.split('\n').filter(l => l.startsWith(': setu '));
for (const line of lines) {
  const data = JSON.parse(line.slice(11));
  console.log(`Cost: $${data.cost_usd}, Balance: $${data.balance_remaining}`);
}
```

### Prompt Caching Pricing

Cached tokens are billed at reduced rates:
- **Anthropic**: `cache_read_input_tokens` billed at `cacheRead` rate
- **OpenAI**: `input_tokens_details.cached_tokens` billed at `cacheRead` rate

## Client Integration

### Using with Vercel AI SDK

```typescript
import { createSetuModel } from '@agi-cli/sdk';
import { generateText } from 'ai';

const model = createSetuModel(
  'gpt-5-mini',
  { privateKey: process.env.SOLANA_PRIVATE_KEY },
  { 
    baseURL: 'https://setu.agi.nitish.sh',
    providerNpm: '@ai-sdk/openai',
  }
);

const result = await generateText({
  model,
  prompt: 'Hello, world!',
});
```

The SDK automatically:
- Adds wallet authentication headers
- Handles 402 responses by signing and submitting payments
- Picks the first available top-up option from server

### Manual Integration with x402

```typescript
import { createPaymentHeader } from 'x402/client';
import { svm } from 'x402/shared';
import bs58 from 'bs58';

async function handlePaymentRequired(body: any, keypair: Keypair): Promise<boolean> {
  if (!body.accepts?.length) return false;
  
  const requirement = body.accepts[0];
  const privateKeyBase58 = bs58.encode(keypair.secretKey);
  const signer = await svm.createSignerFromBase58(privateKeyBase58);

  const paymentHeader = await createPaymentHeader(
    signer,
    1,
    requirement,
    { svmConfig: { rpcUrl: RPC_URL } }
  );

  const decoded = JSON.parse(
    Buffer.from(paymentHeader, 'base64').toString('utf-8')
  );

  const res = await fetch(`${BASE_URL}/v1/topup`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...createAuthHeaders(keypair)
    },
    body: JSON.stringify({
      paymentPayload: {
        x402Version: 1,
        scheme: 'exact',
        network: requirement.network,
        payload: { transaction: decoded.payload.transaction },
      },
      paymentRequirement: requirement,
    }),
  });

  return res.ok;
}
```

## Advanced Features

### Anthropic Prompt Caching

Full support for `cache_control` - passed through unchanged:

```typescript
const result = await generateText({
  model: anthropic('claude-sonnet-4-0'),
  messages: [{
    role: 'user',
    content: [{
      type: 'text',
      text: veryLongDocument,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }]
  }]
});
```

### OpenAI Pro Models (Background Mode)

Pro models (`gpt-5-pro`, `gpt-5.2-pro`) automatically use `background: true`:

```typescript
const result = await generateText({
  model: openai('gpt-5-pro'),
  prompt: 'Complex reasoning task...',
});
```

### Anthropic Extended Thinking

```typescript
const result = await generateText({
  model: anthropic('claude-sonnet-4-0'),
  prompt: 'Analyze this complex problem...',
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 16000 }
    }
  }
});
```

### Tool Calling

Both providers support tool calling through their native SDKs:

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-5'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get the weather for a location',
      parameters: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }) => {
        return { temperature: 72, condition: 'sunny' };
      },
    }),
  },
});
```

## Balance Endpoint

```bash
curl -H "x-wallet-address: YOUR_WALLET" \
     -H "x-wallet-signature: SIGNATURE" \
     -H "x-wallet-nonce: TIMESTAMP" \
     https://setu.agi.nitish.sh/v1/balance
```

Response:
```json
{
  "wallet_address": "ABC123...",
  "balance_usd": 4.95,
  "total_spent": 0.05,
  "total_topups": 5.00,
  "request_count": 10,
  "created_at": "2025-01-20T10:00:00.000Z",
  "last_request": "2025-01-24T15:30:00.000Z"
}
```

## Configuration

### Server Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STAGE` | `prod` for mainnet, anything else for devnet | No (default: dev) |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `PLATFORM_WALLET` | Company wallet to receive payments | Yes |
| `DATABASE_URL` | Neon Postgres connection string | Yes |

### Client Environment Variables

| Variable | Description |
|----------|-------------|
| `SETU_BASE_URL` | Router URL (default: `https://api.setu.nitish.sh`) |
| `SETU_SOLANA_RPC_URL` | Solana RPC (default: `https://api.mainnet-beta.solana.com`) |
| `SETU_PRIVATE_KEY` | Base58-encoded Solana private key |

## Error Handling

| Status | Meaning |
|--------|---------|
| 400 | Bad request - invalid model, missing fields, unsupported amount |
| 401 | Authentication failed - missing headers, invalid signature, expired nonce |
| 402 | Payment required - balance below $0.05 |
| 500 | Server error - provider error, database error |

### Error Response Format

```json
{
  "error": "Error message here",
  "details": "Optional additional information"
}
```

## Development

```bash
# Install dependencies
bun install

# Run locally (uses devnet)
bun run dev

# Update model catalog from models.dev
bun run update-catalog

# Run with SST (auto-links secrets)
sst dev

# Run tests
bun run test/client.ts "Hello world"
bun run test/ai-sdk-client.ts
```

### Database Migrations

```bash
# Generate migration
bunx drizzle-kit generate

# Push to database
bunx drizzle-kit push
```

### Project Structure

```
apps/router/
├── src/
│   ├── catalog/         # Model catalog (auto-generated)
│   ├── middleware/      # Auth & balance check
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── config.ts        # Environment config
│   └── index.ts         # Hono app entry
├── db/                  # Drizzle schema
├── scripts/             # Catalog update script
└── test/                # Test clients
```

## Support

- GitHub Issues: [sst/setu](https://github.com/sst/setu/issues)
