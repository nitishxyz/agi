# Top-up Approval Flow Plan

## Overview

Replace the automatic x402 crypto top-up with an **approval-based flow** that lets users choose their payment method (USDC or Fiat) when their balance is insufficient.

## Current Behavior

1. User sends message → Setu returns 402 Payment Required
2. SDK automatically signs x402 transaction
3. Balance is credited via USDC transfer
4. Request retries automatically

**Problem**: No user choice, crypto-only, no visibility in UI

## Proposed Behavior

1. User sends message → Setu returns 402 Payment Required
2. **Payment Required event** emitted to SSE stream
3. **TopupApproval renderer** appears in message thread
4. User selects payment method:
   - **USDC**: Proceed with x402 flow (existing)
   - **Fiat**: Open Polar checkout modal
5. After payment completes, request automatically retries

## Architecture

### Event Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Server    │────▶│   SSE       │────▶│   UI        │
│   (Setu)    │     │   Stream    │     │   Renderer  │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                    setu.topup.required
                    {
                      amountUsd: 0.05,
                      currentBalance: 0.02,
                      requiredBalance: 0.07,
                      sessionId,
                      messageId
                    }
```

### New SSE Event Types

```typescript
// Emitted when payment is needed (instead of auto-paying)
type SetuTopupRequired = {
  type: 'setu.topup.required';
  sessionId: string;
  messageId: string;
  payload: {
    amountUsd: number;        // Amount needed for this request
    currentBalance: number;   // Current Setu balance
    minTopupUsd: number;      // Minimum top-up ($5 for Polar)
    suggestedTopupUsd: number; // Suggested amount (e.g., $10)
  };
};

// User selected payment method
type SetuTopupMethodSelected = {
  type: 'setu.topup.method_selected';
  sessionId: string;
  payload: {
    method: 'crypto' | 'fiat';
  };
};

// Crypto payment in progress (existing events)
type SetuPaymentSigning = { type: 'setu.payment.signing'; ... };
type SetuPaymentComplete = { type: 'setu.payment.complete'; ... };
type SetuPaymentError = { type: 'setu.payment.error'; ... };

// Fiat checkout created
type SetuFiatCheckoutCreated = {
  type: 'setu.fiat.checkout_created';
  sessionId: string;
  payload: {
    checkoutId: string;
    checkoutUrl: string;
    chargeAmount: number;
    creditAmount: number;
  };
};
```

## Implementation Plan

### Phase 1: Server Changes (packages/server)

#### 1.1 Modify Setu Provider to Pause on 402

**File**: `packages/server/src/runtime/provider/setu.ts`

```typescript
// Instead of auto-paying, emit event and wait for user choice
onPaymentRequired: (amountUsd, currentBalance) => {
  publish({
    type: 'setu.topup.required',
    sessionId,
    payload: {
      amountUsd,
      currentBalance,
      minTopupUsd: 5,
      suggestedTopupUsd: Math.max(10, Math.ceil(amountUsd * 2)),
    },
  });
  
  // Return promise that resolves when user selects method
  return waitForTopupMethodSelection(sessionId);
};
```

#### 1.2 Add Topup Method Selection Endpoint

**File**: `packages/server/src/routes/setu.ts`

```typescript
// POST /v1/setu/topup/select
app.post('/v1/setu/topup/select', async (c) => {
  const { sessionId, method } = await c.req.json();
  
  if (method === 'crypto') {
    // Trigger x402 payment flow
    resolveTopupMethodSelection(sessionId, 'crypto');
  } else if (method === 'fiat') {
    // Create Polar checkout and return URL
    const checkout = await createPolarCheckout(...);
    publish({
      type: 'setu.fiat.checkout_created',
      sessionId,
      payload: checkout,
    });
  }
});
```

#### 1.3 Add Topup State Manager

**File**: `packages/server/src/runtime/topup/manager.ts`

```typescript
// Track pending topup requests per session
const pendingTopups = new Map<string, {
  resolve: (method: 'crypto' | 'fiat') => void;
  reject: (error: Error) => void;
  amountUsd: number;
  createdAt: number;
}>();

export function waitForTopupMethodSelection(sessionId: string): Promise<'crypto' | 'fiat'> {
  return new Promise((resolve, reject) => {
    pendingTopups.set(sessionId, { resolve, reject, ... });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      if (pendingTopups.has(sessionId)) {
        pendingTopups.delete(sessionId);
        reject(new Error('Topup selection timeout'));
      }
    }, 5 * 60 * 1000);
  });
}

export function resolveTopupMethodSelection(sessionId: string, method: 'crypto' | 'fiat') {
  const pending = pendingTopups.get(sessionId);
  if (pending) {
    pendingTopups.delete(sessionId);
    pending.resolve(method);
  }
}
```

### Phase 2: SDK Changes (packages/sdk)

#### 2.1 Add Approval Mode to Setu Client

**File**: `packages/sdk/src/providers/src/setu-client.ts`

```typescript
export type SetuProviderOptions = {
  // ... existing options
  topupApprovalMode?: 'auto' | 'approval'; // 'auto' = current behavior, 'approval' = new flow
  onTopupRequired?: (info: TopupRequiredInfo) => Promise<'crypto' | 'fiat' | 'cancel'>;
};
```

### Phase 3: Web SDK Changes (packages/web-sdk)

#### 3.1 Add TopupApproval Store

**File**: `packages/web-sdk/src/stores/topupApprovalStore.ts`

```typescript
interface TopupApprovalState {
  pendingTopup: {
    sessionId: string;
    messageId: string;
    amountUsd: number;
    currentBalance: number;
    suggestedTopupUsd: number;
  } | null;
  
  setPendingTopup: (topup: TopupApprovalState['pendingTopup']) => void;
  clearPendingTopup: () => void;
}
```

#### 3.2 Create TopupApprovalRenderer Component

**File**: `packages/web-sdk/src/components/messages/renderers/TopupApprovalRenderer.tsx`

```tsx
export function TopupApprovalRenderer({ 
  amountUsd,
  currentBalance,
  suggestedTopupUsd,
  sessionId,
}: TopupApprovalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'crypto' | 'fiat' | null>(null);
  
  const handleSelectCrypto = async () => {
    setSelectedMethod('crypto');
    setIsProcessing(true);
    await apiClient.selectTopupMethod(sessionId, 'crypto');
  };
  
  const handleSelectFiat = async () => {
    setSelectedMethod('fiat');
    // Open the topup modal with pre-filled amount
    openTopupModal({ 
      prefilledAmount: suggestedTopupUsd,
      onComplete: () => {
        // After Polar payment, retry the request
        apiClient.retryPendingRequest(sessionId);
      }
    });
  };
  
  return (
    <div className="topup-approval-card">
      <div className="header">
        <AlertCircle className="text-yellow-500" />
        <span>Insufficient Balance</span>
      </div>
      
      <div className="info">
        <p>This request requires ~${amountUsd.toFixed(4)}</p>
        <p>Current balance: ${currentBalance.toFixed(4)}</p>
      </div>
      
      <div className="methods">
        <button onClick={handleSelectCrypto} disabled={isProcessing}>
          <Wallet className="w-4 h-4" />
          <div>
            <span>Pay with USDC</span>
            <span className="text-muted">Auto-deduct from wallet</span>
          </div>
          {selectedMethod === 'crypto' && <Loader2 className="animate-spin" />}
        </button>
        
        <button onClick={handleSelectFiat} disabled={isProcessing}>
          <CreditCard className="w-4 h-4" />
          <div>
            <span>Pay with Card</span>
            <span className="text-muted">Top up via Polar (min $5)</span>
          </div>
        </button>
      </div>
    </div>
  );
}
```

#### 3.3 Update useSetuPayments Hook

**File**: `packages/web-sdk/src/hooks/useSetuPayments.ts`

```typescript
// Add handler for new event type
case 'setu.topup.required': {
  const { amountUsd, currentBalance, suggestedTopupUsd } = payload;
  
  // Store pending topup info for renderer
  setTopupApproval({
    sessionId,
    amountUsd,
    currentBalance,
    suggestedTopupUsd,
  });
  break;
}

case 'setu.fiat.checkout_created': {
  const { checkoutUrl, checkoutId } = payload;
  // Store checkout ID for verification
  localStorage.setItem('pendingPolarCheckout', checkoutId);
  // Open in new tab
  window.open(checkoutUrl, '_blank');
  break;
}
```

#### 3.4 Add TopupApproval to Message Thread

**File**: `packages/web-sdk/src/components/messages/MessagePartItem.tsx`

```typescript
// Add case for topup approval in message rendering
if (pendingTopup && pendingTopup.messageId === message.id) {
  return <TopupApprovalRenderer {...pendingTopup} />;
}
```

### Phase 4: API Client Updates

#### 4.1 Add New API Methods

**File**: `packages/web-sdk/src/lib/api-client.ts`

```typescript
async selectTopupMethod(sessionId: string, method: 'crypto' | 'fiat'): Promise<void> {
  await fetch(`${this.baseUrl}/v1/setu/topup/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, method }),
  });
}

async retryPendingRequest(sessionId: string): Promise<void> {
  await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/retry`, {
    method: 'POST',
  });
}
```

## File Changes Summary

### New Files
- `packages/server/src/runtime/topup/manager.ts` - Topup state manager
- `packages/web-sdk/src/stores/topupApprovalStore.ts` - UI state for pending topups
- `packages/web-sdk/src/components/messages/renderers/TopupApprovalRenderer.tsx` - Payment method selector

### Modified Files
- `packages/server/src/runtime/provider/setu.ts` - Add approval mode
- `packages/server/src/routes/setu.ts` - Add `/topup/select` endpoint
- `packages/server/src/events/types.ts` - Add new event types
- `packages/sdk/src/providers/src/setu-client.ts` - Add approval mode option
- `packages/web-sdk/src/hooks/useSetuPayments.ts` - Handle new events
- `packages/web-sdk/src/components/messages/MessagePartItem.tsx` - Render approval card
- `packages/web-sdk/src/lib/api-client.ts` - Add new methods

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  Insufficient Balance                               │
│                                                         │
│  This request requires approximately $0.05              │
│  Your current balance is $0.02                          │
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │  💳 Pay with USDC   │  │  💳 Pay with Card   │      │
│  │  Auto-deduct from   │  │  Top up via Polar   │      │
│  │  wallet             │  │  (min $5)           │      │
│  └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

## Implementation Order

1. **Phase 1.3**: Topup state manager (foundation)
2. **Phase 1.1**: Modify Setu provider (emit events)
3. **Phase 1.2**: Add selection endpoint
4. **Phase 3.1**: Topup approval store
5. **Phase 3.2**: TopupApprovalRenderer component
6. **Phase 3.3**: Update useSetuPayments hook
7. **Phase 3.4**: Add to message thread
8. **Phase 4.1**: API client methods
9. **Phase 2.1**: SDK approval mode (optional, for CLI)

## Estimated Time

- Phase 1 (Server): ~2-3 hours
- Phase 2 (SDK): ~1 hour
- Phase 3 (Web SDK): ~3-4 hours
- Phase 4 (API): ~30 min
- Testing: ~2 hours

**Total**: ~8-10 hours

## Open Questions

1. **Timeout behavior**: What happens if user doesn't select a method within 5 minutes?
   - Option A: Auto-cancel the request
   - Option B: Keep waiting indefinitely
   - Option C: Fall back to auto-crypto

2. **Fiat flow retry**: After Polar payment completes, how do we trigger retry?
   - Option A: Auto-retry when webhook confirms payment
   - Option B: User clicks "Retry" button
   - Option C: Show "Payment complete, sending message..." status

3. **Balance check frequency**: Should we pre-check balance before sending message?
   - Could show warning if balance is low before user sends

4. **Minimum topup for fiat**: Polar has $5 minimum. What if user only needs $0.05?
   - Always top up $5+ via fiat (user keeps credit)
   - Or show "USDC recommended for small amounts"
