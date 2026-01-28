# Polar.sh Fiat Top-up Integration Plan

Note: User can specify any amount between $5-$500 (custom amounts, no fixed tiers).
Polar fees (4% + $0.40, +1.5% intl) are calculated and shown transparently.
**Implementation Status**: ✅ Complete
- Setu app routes and services implemented
- AGI server proxy routes added
- Web UI topup modal with amount selection and fee preview
## Overview

Enable non-crypto users to top up their Setu AI service balance using fiat payments via **Polar.sh**. This creates a seamless dual-payment system where:

- **Crypto users**: Use Solana USDC via x402 payments (existing)
- **Fiat users**: Use credit card via Polar.sh checkout (new)

The wallet address remains the universal identifier regardless of payment method.

## Current Architecture

### Database Schema (PostgreSQL via Neon)
```sql
router_users (wallet_address PRIMARY KEY, balance_usd, ...)
router_transactions (id, wallet_address, type, amount_usd, tx_signature, ...)
router_payment_logs (id, wallet_address, tx_signature UNIQUE, ...)
```

### Existing Top-up Flow (x402 Crypto)
```
Client -> POST /v1/topup
  ├── Auth: x-wallet-address, x-wallet-signature, x-wallet-nonce
  ├── Body: { paymentPayload, paymentRequirement }
  ├── Verify x402 payment via facilitator
  ├── Insert payment_log (tx_signature unique constraint)
  └── Credit balance
```

### Infrastructure
- **Dev**: SST DevCommand (local)
- **Prod**: Cloudflare Worker
- **Domain**: `{stage}.setu.agi.nitish.sh`
- **Secrets**: `PLATFORM_WALLET`, `DATABASE_URL`, API keys

## Proposed Polar.sh Integration

### Architecture Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Web App    │────▶│  POST /v1/   │────▶│  Polar.sh    │
│  (Top Up UI) │     │  topup/polar │     │   Checkout   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  │ Webhook
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Neon      │◄────│ POST /v1/    │◄────│   Polar.sh   │
│    PostgreSQL│     │ webhooks/    │     │   Webhook    │
└──────────────┘     └──────────────┘     └──────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │   Webhook    │
                     │   Worker     │
                     │ (Cloudflare) │
                     └──────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Webhooks via separate worker** | Polar webhooks need public HTTPS endpoint. Setu runs as Cloudflare Worker (good). Separate worker = cleaner separation of concerns. |
| **Metadata for wallet tracking** | Polar allows `metadata` field in checkout. Store `walletAddress` there for webhook correlation. |
| **Idempotency via polarCheckoutId** | Polar checkout IDs are unique. Store in `payment_logs` with partial unique constraint (allow nulls for x402). |
| **Unified balance system** | Both payment methods credit to same `balanceUsd` field. Transactions table tracks source via `provider` field. |
| **Webhook signature verification** | Polar provides signature headers. Verify before processing to prevent spoofing. |

## Database Schema Changes

### 1. Add `polar_checkout_id` to `payment_logs`

```typescript
// apps/setu/db/schema/payment-logs.ts
export const paymentLogs = pgTable('router_payment_logs', {
  // ... existing fields
  polarCheckoutId: text('polar_checkout_id'), // nullable, for fiat topups
  paymentMethod: text('payment_method').notNull().default('crypto'), // 'crypto' | 'fiat'
}, (table) => ({
  // Add unique constraint for polar checkout IDs (only non-null values)
  polarCheckoutIdx: uniqueIndex('polar_checkout_idx')
    .on(table.polarCheckoutId)
    .where(sql`${table.polarCheckoutId} IS NOT NULL`),
}));
```

### 2. Migration

```sql
-- drizzle/0001_add_polar_checkout.sql
ALTER TABLE "router_payment_logs" 
  ADD COLUMN "polar_checkout_id" text,
  ADD COLUMN "payment_method" text NOT NULL DEFAULT 'crypto';

CREATE UNIQUE INDEX "polar_checkout_idx" 
  ON "router_payment_logs" ("polar_checkout_id") 
  WHERE "polar_checkout_id" IS NOT NULL;
```

## API Endpoints

### 1. `POST /v1/topup/polar` - Create Checkout Session

**Auth**: Wallet signature (same headers as other endpoints)

**Request**:
```json
{
  "amount": 10.00,  // USD amount (one of: 5, 10, 25, 50)
  "successUrl": "https://app.agi.nitish.sh/topup/success",
  "cancelUrl": "https://app.agi.nitish.sh/topup/cancel"
}
```

**Response**:
```json
{
  "success": true,
  "checkoutUrl": "https://polar.sh/checkout/...",
  "checkoutId": "polar_check_abc123",
  "amount": 10.00
}
```

**Flow**:
1. Verify wallet signature
2. Validate amount (must be in allowed list)
3. Call Polar API to create checkout session
4. Store pending `payment_logs` entry with `status: 'pending'`
5. Return checkout URL to client

### 2. `POST /v1/webhooks/polar` - Webhook Handler

**Auth**: Polar webhook signature verification (no wallet auth)

**Request Headers**:
```
Polar-Signature: v1=abc123...,v1=def456...
```

**Payload Types**:

#### `checkout.created` (optional - informational)
```json
{
  "type": "checkout.created",
  "data": {
    "id": "polar_check_abc123",
    "metadata": { "walletAddress": "0x..." },
    "amount": 1000,  // cents
    "currency": "usd",
    "status": "pending"
  }
}
```

#### `checkout.completed` (process credit)
```json
{
  "type": "checkout.completed",
  "data": {
    "id": "polar_check_abc123",
    "metadata": { "walletAddress": "0x..." },
    "amount": 1000,
    "currency": "usd",
    "status": "succeeded"
  }
}
```

**Flow for `checkout.completed`**:
1. Verify Polar webhook signature
2. Extract `walletAddress` from metadata
3. Check `payment_logs` for existing `polarCheckoutId` (idempotency)
4. If not processed:
   - Insert `payment_logs` with `polar_checkout_id`
   - Call `creditBalance()` to update user balance
   - Insert `transactions` record with `provider: 'polar'`
5. Return 200 OK

#### `checkout.failed` (optional - logging)
```json
{
  "type": "checkout.failed",
  "data": {
    "id": "polar_check_abc123",
    "metadata": { "walletAddress": "0x..." },
    "status": "failed"
  }
}
```

## Implementation Files

### New Files

```
apps/setu/src/
├── routes/
│   ├── polar-topup.ts       # POST /v1/topup/polar
│   └── polar-webhook.ts     # POST /v1/webhooks/polar
├── services/
│   └── polar.ts             # Polar API client, signature verification
├── middleware/
│   └── polar-webhook-auth.ts # Signature verification middleware
```

### Modified Files

```
apps/setu/
├── db/schema/payment-logs.ts    # Add polarCheckoutId, paymentMethod
├── src/services/balance.ts      # Add creditBalanceFiat() variant
├── src/config.ts                # Add POLAR_API_KEY, POLAR_WEBHOOK_SECRET
├── infra/secrets.ts             # Add polarApiKey, polarWebhookSecret
├── infra/setu.ts                # Pass new secrets to worker
├── package.json                 # Add @polar-sh/sdk dependency
```

## Secrets Configuration

### Add to `infra/secrets.ts`:

```typescript
export const polarApiKey = new sst.Secret('PolarApiKey');
export const polarWebhookSecret = new sst.Secret('PolarWebhookSecret');
```

### Add to `infra/setu.ts`:

```typescript
import { polarApiKey, polarWebhookSecret } from './secrets';

// In Worker environment:
environment: {
  // ... existing
  POLAR_API_KEY: polarApiKey.value,
  POLAR_WEBHOOK_SECRET: polarWebhookSecret.value,
}
```

### Local Development (.env):

```bash
# apps/setu/.env
POLAR_API_KEY=polar_test_...
POLAR_WEBHOOK_SECRET=whsec_...
```

## Webhook Worker Approach

Since Setu runs as Cloudflare Worker, we have two options:

### Option A: Inline Webhook Handler (Recommended)

Add webhook route directly to Setu worker. Cloudflare Workers accept HTTP requests natively.

**Pros**:
- Single deployment, single URL
- Shared database connection pool
- Simpler infrastructure

**Cons**:
- Webhook handler shares rate limits with API

### Option B: Separate Webhook Worker

Create `apps/polar-webhook` as separate Cloudflare Worker.

**Pros**:
- Isolated scaling for webhooks
- Can use different domain if needed

**Cons**:
- Extra service to maintain
- Cross-service DB calls

**Decision**: Use **Option A** - inline handler. The webhook is a simple idempotent credit operation. Setu Worker can handle it fine.

## Frontend Integration

### New UI Components

```typescript
// Top-up modal with dual options
<TopupModal>
  <Tabs>
    <Tab label="Crypto (USDC)">
      <CryptoTopup />  // Existing x402 flow
    </Tab>
    <Tab label="Card (Fiat)">
      <FiatTopup />    // New Polar flow
    </Tab>
  </Tabs>
</TopupModal>

// Fiat topup component
<FiatTopup>
  <AmountSelector options={[5, 10, 25, 50]} />
  <Button onClick={createPolarCheckout}>
    Pay with Card
  </Button>
</FiatTopup>
```

### Flow

1. User selects "Card" tab
2. User selects amount ($5, $10, $25, $50)
3. Click "Pay with Card" -> API call to `POST /v1/topup/polar`
4. Redirect to `checkoutUrl` (Polar hosted checkout)
5. User completes payment on Polar
6. Polar redirects to `successUrl` (your app)
7. Webhook fires (async) -> credits balance
8. User sees updated balance on next page load

## Polar Configuration

### Dashboard Setup

1. **Create Organization**: https://polar.sh
2. **Create Product**: "AI Service Credits" - one-time payment type
3. **Set Prices**: $5, $10, $25, $50 USD
4. **Webhook URL**: `https://{stage}.setu.agi.nitish.sh/v1/webhooks/polar`
5. **Webhook Events**: Subscribe to `checkout.completed`, `checkout.failed`
6. **Copy Keys**: API key and Webhook secret

### Test Mode

Polar provides test environment:
- API Keys: `polar_test_*`
- Webhook Secrets: `whsec_test_*`
- Test card: `4242 4242 4242 4242`

## Implementation Phases

### Phase 1: Backend Core (2-3 hours)

1. **Database Migration**
   - Add `polar_checkout_id` and `payment_method` columns
   - Generate Drizzle migration

2. **Polar Service**
   - Create `src/services/polar.ts`
   - Implement `createCheckoutSession()`
   - Implement `verifyWebhookSignature()`

3. **New Routes**
   - `POST /v1/topup/polar` - Create checkout
   - `POST /v1/webhooks/polar` - Handle webhooks

4. **Balance Service Update**
   - Modify `creditBalance()` to accept optional `polarCheckoutId`
   - Update transaction recording

### Phase 2: Secrets & Infra (30 min)

1. Add secrets to `infra/secrets.ts`
2. Add environment variables to `infra/setu.ts`
3. Add `@polar-sh/sdk` to package.json

### Phase 3: Testing (1-2 hours)

1. **Local testing** with Polar test mode
2. **Webhook testing** using Polar CLI or ngrok
3. **Idempotency testing** - duplicate webhook handling
4. **Error handling** - failed payments, invalid signatures

### Phase 4: Frontend (2-3 hours)

1. Add Polar topup UI component
2. Integrate with existing balance display
3. Add success/cancel redirect pages

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Webhook spoofing | Verify Polar-Signature header using webhook secret |
| Replay attacks | Idempotency via `polar_checkout_id` unique constraint |
| Metadata tampering | Trust Polar's webhook, not client-provided metadata. But metadata is set server-side during checkout creation. |
| Amount manipulation | Validate amount against allowed list server-side |
| Double crediting | Database unique constraint on `polar_checkout_id` |

## Polar SDK Reference

```typescript
// Using @polar-sh/sdk
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({
  accessToken: process.env.POLAR_API_KEY!,
  server: 'sandbox', // or 'production'
});

// Create checkout
const checkout = await polar.checkouts.create({
  productPriceId: 'price_xxx',
  successUrl: 'https://...',
  cancelUrl: 'https://...',
  metadata: {
    walletAddress: '0x...',
  },
});
```

## Rollback Plan

If issues occur:

1. **Disable webhook** in Polar dashboard
2. **Revert code** to previous version
3. **Manual refund process** for any stuck payments:
   - Query `payment_logs` for recent Polar entries
   - Verify balances are correct
   - Refund via Polar dashboard if needed

## Success Metrics

- Fiat topup success rate > 95%
- Webhook processing latency < 2s p99
- Zero double-credit incidents
- Customer support tickets < 1% of fiat transactions

## Open Questions

1. **Pricing tiers**: Should fiat have different pricing than crypto (to cover Polar fees ~0.5%)?
2. **Minimum amounts**: Polar has $0.50 minimum. Keep $5 minimum or lower?
3. **Subscription vs one-time**: Do we want subscription option for recurring credits?
4. **Refund policy**: How to handle refunds? Manual process via Polar dashboard?
5. **Tax handling**: Do we need to collect sales tax? Polar can handle this.
