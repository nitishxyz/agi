# @ottocode/ai-sdk

A drop-in SDK for accessing AI models (OpenAI, Anthropic, Google, Moonshot, MiniMax, Z.AI) through the [Setu](https://github.com/slashforge/setu) proxy with automatic x402 payments via Solana USDC.

All you need is a Solana wallet — the SDK handles authentication, payment negotiation, and provider routing automatically.

## Install

```bash
bun add @ottocode/ai-sdk ai
# or
npm install @ottocode/ai-sdk ai
```

## Quick Start

```ts
import { createSetu } from '@ottocode/ai-sdk';
import { generateText } from 'ai';

const setu = createSetu({
  auth: { privateKey: process.env.SOLANA_PRIVATE_KEY! },
});

const { text } = await generateText({
  model: setu.model('claude-sonnet-4-20250514'),
  prompt: 'Hello!',
});

console.log(text);
```

The SDK auto-resolves which provider to use based on the model name. It returns ai-sdk compatible model instances that work directly with `generateText()`, `streamText()`, etc.

## Provider Auto-Resolution

Models are resolved to providers by prefix:

| Prefix | Provider | API Format |
|---|---|---|
| `claude-` | Anthropic | Messages |
| `gpt-`, `o1`, `o3`, `o4`, `codex-` | OpenAI | Responses |
| `gemini-` | Google | Native |
| `kimi-` | Moonshot | OpenAI Chat |
| `MiniMax-` | MiniMax | Messages |
| `z1-` | Z.AI | OpenAI Chat |

```ts
setu.model('claude-sonnet-4-20250514');   // → anthropic
setu.model('gpt-4o');                      // → openai
setu.model('gemini-2.5-pro');             // → google
setu.model('kimi-k2');                    // → moonshot
```

## Explicit Provider

Override auto-resolution when needed:

```ts
const model = setu.provider('openai').model('gpt-4o');
const model = setu.provider('anthropic', 'anthropic-messages').model('claude-sonnet-4-20250514');
```

## Configuration

```ts
const setu = createSetu({
  // Required: Solana wallet private key (base58)
  auth: { privateKey: '...' },

  // Optional: Setu API base URL (default: https://api.setu.ottocode.io)
  baseURL: 'https://api.setu.ottocode.io',

  // Optional: Solana RPC URL (default: https://api.mainnet-beta.solana.com)
  rpcURL: 'https://api.mainnet-beta.solana.com',

  // Optional: Payment callbacks
  callbacks: { /* see Payment Callbacks */ },

  // Optional: Cache configuration
  cache: { /* see Caching */ },

  // Optional: Payment options
  payment: { /* see Payment Options */ },

  // Optional: Custom model→provider mappings
  modelMap: {
    'my-custom-model': 'openai',
  },

  // Optional: Register custom providers
  providers: [
    {
      id: 'my-provider',
      apiFormat: 'openai-chat',
      modelPrefix: 'myp-',
    },
  ],
});
```

## Payment Callbacks

Monitor and control the payment lifecycle:

```ts
const setu = createSetu({
  auth: { privateKey: '...' },
  callbacks: {
    // Called when a 402 is received and payment is needed
    onPaymentRequired: (amountUsd, currentBalance) => {
      console.log(`Payment required: $${amountUsd}`);
    },

    // Called when the SDK is signing a transaction
    onPaymentSigning: () => {
      console.log('Signing payment...');
    },

    // Called after successful payment
    onPaymentComplete: ({ amountUsd, newBalance, transactionId }) => {
      console.log(`Paid $${amountUsd}, balance: $${newBalance}`);
    },

    // Called on payment failure
    onPaymentError: (error) => {
      console.error('Payment failed:', error);
    },

    // Called after each request with cost info (streaming & non-streaming)
    onBalanceUpdate: ({ costUsd, balanceRemaining, inputTokens, outputTokens }) => {
      console.log(`Cost: $${costUsd}, remaining: $${balanceRemaining}`);
    },

    // Optional: interactive approval before payment
    onPaymentApproval: async ({ amountUsd, currentBalance }) => {
      // return 'crypto' to pay, 'fiat' for fiat flow, 'cancel' to abort
      return 'crypto';
    },
  },
});
```

## Payment Options

```ts
const setu = createSetu({
  auth: { privateKey: '...' },
  payment: {
    // 'auto' (default) — pay automatically
    // 'approval' — call onPaymentApproval before each payment
    topupApprovalMode: 'auto',

    // Auto-pay without approval if wallet USDC balance >= threshold
    autoPayThresholdUsd: 5.0,

    // Max retries for a single API request (default: 3)
    maxRequestAttempts: 3,

    // Max total payment attempts per wallet (default: 20)
    maxPaymentAttempts: 20,
  },
});
```

## Caching

### Anthropic Cache Control

By default, the SDK automatically injects `cache_control: { type: 'ephemeral' }` on the first system block and the last message for Anthropic models. This saves ~90% on cached token costs.

```ts
// Default: auto caching (1 system + 1 message breakpoint)
createSetu({ auth });

// Disable completely
createSetu({ auth, cache: { anthropicCaching: false } });

// Manual: SDK won't inject cache_control — set it yourself in messages
createSetu({ auth, cache: { anthropicCaching: { strategy: 'manual' } } });

// Custom breakpoint count and placement
createSetu({
  auth,
  cache: {
    anthropicCaching: {
      systemBreakpoints: 2,       // cache first 2 system blocks
      systemPlacement: 'first',   // 'first' | 'last' | 'all'
      messageBreakpoints: 3,      // cache last 3 messages
      messagePlacement: 'last',   // 'first' | 'last' | 'all'
    },
  },
});

// Full custom transform
createSetu({
  auth,
  cache: {
    anthropicCaching: {
      strategy: 'custom',
      transform: (body) => {
        // modify body however you want
        return body;
      },
    },
  },
});
```

| Option | Default | Description |
|---|---|---|
| `strategy` | `'auto'` | `'auto'`, `'manual'`, `'custom'`, or `false` |
| `systemBreakpoints` | `1` | Number of system blocks to cache |
| `messageBreakpoints` | `1` | Number of messages to cache |
| `systemPlacement` | `'first'` | Which system blocks: `'first'`, `'last'`, `'all'` |
| `messagePlacement` | `'last'` | Which messages: `'first'`, `'last'`, `'all'` |
| `cacheType` | `'ephemeral'` | The `cache_control.type` value |

### Setu Server-Side Caching

Provider-agnostic caching at the Setu proxy layer:

```ts
createSetu({
  auth,
  cache: {
    promptCacheKey: 'my-session-123',
    promptCacheRetention: 'in_memory', // or '24h'
  },
});
```

### OpenAI / Google

- **OpenAI**: Automatic server-side prefix caching — no configuration needed
- **Google**: Requires pre-uploaded `cachedContent` at the application level

## Balance

```ts
// Setu account balance
const balance = await setu.balance();
// { walletAddress, balance, totalSpent, totalTopups, requestCount }

// On-chain USDC balance
const wallet = await setu.walletBalance('mainnet');
// { walletAddress, usdcBalance, network }

// Wallet address
console.log(setu.walletAddress);
```

## Custom Providers

Register providers at init or runtime:

```ts
// At init
const setu = createSetu({
  auth,
  providers: [
    { id: 'my-provider', apiFormat: 'openai-chat', modelPrefix: 'myp-' },
  ],
});

// At runtime
setu.registry.register({
  id: 'another-provider',
  apiFormat: 'anthropic-messages',
  models: ['specific-model-id'],
});

// Map a specific model to a provider
setu.registry.mapModel('some-model', 'openai');
```

### API Formats

| Format | Description | Used by |
|---|---|---|
| `openai-responses` | OpenAI Responses API | OpenAI |
| `anthropic-messages` | Anthropic Messages API | Anthropic, MiniMax |
| `openai-chat` | OpenAI Chat Completions (compatible) | Moonshot, Z.AI |
| `google-native` | Google GenerativeAI native | Google |

## Low-Level: Custom Fetch

Use the x402-aware fetch wrapper directly:

```ts
const customFetch = setu.fetch();

const response = await customFetch('https://api.setu.ottocode.io/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: [...] }),
});
```

## Standalone Utilities

```ts
import {
  fetchBalance,
  fetchWalletUsdcBalance,
  getPublicKeyFromPrivate,
  addAnthropicCacheControl,
  createSetuFetch,
} from '@ottocode/ai-sdk';

// Get wallet address from private key
const address = getPublicKeyFromPrivate(privateKey);

// Fetch balance without creating a full Setu instance
const balance = await fetchBalance({ privateKey });

// Fetch on-chain USDC
const usdc = await fetchWalletUsdcBalance({ privateKey }, 'mainnet');

// Create a standalone x402-aware fetch
const setuFetch = createSetuFetch({
  wallet: createWalletContext({ privateKey }),
  baseURL: 'https://api.setu.ottocode.io',
});
```

## How It Works

1. You call `setu.model('claude-sonnet-4-20250514')` — the SDK resolves this to Anthropic
2. It creates an ai-sdk provider (`@ai-sdk/anthropic`) pointed at the Setu proxy
3. A custom fetch wrapper intercepts all requests to:
   - Inject wallet auth headers (address, nonce, signature)
   - Inject Anthropic cache control (if enabled)
   - Handle 402 responses by signing USDC payments via x402
   - Sniff balance/cost info from SSE stream comments
4. The Setu proxy verifies the wallet, checks balance, forwards to the real provider, tracks usage

## Requirements

- Solana wallet with USDC (for payments)
- `ai` SDK v6+ as a peer dependency
- Node.js 18+ or Bun

## License

MIT
