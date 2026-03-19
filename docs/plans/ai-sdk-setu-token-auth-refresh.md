# Plan: refresh `@ottocode/ai-sdk` to match current Setu auth + request flow

> **Status: COMPLETED** — The ai-sdk payment layer has been migrated from x402 to MPP (Micropayment Protocol) using `mppx` and `mppx-solana`. The Setu server has also been migrated (see `setu` repo commit `a5f5f04`). This document is retained for historical context.

## Goal

Update `packages/ai-sdk` so it matches current Setu behavior:

- authenticate once with a signed wallet request to `POST /v1/auth/wallet-token`
- use `Authorization: Bearer <token>` for normal API traffic after that
- keep MPP payment signing exactly as it works today
- do **not** keep the legacy "sign every inference request" request path inside the SDK

This plan is intentionally written for a **published package**. It favors:

- keeping the primary constructor API stable where possible
- limiting avoidable public API breakage
- documenting any unavoidable release/risk items up front

---

## What Setu supports today

Current Setu server behavior relevant to the SDK:

1. `POST /v1/auth/wallet-token`
   - authenticates using the existing wallet headers:
     - `x-wallet-address`
     - `x-wallet-signature`
     - `x-wallet-nonce`
   - returns a short-lived bearer token

2. `walletAuth` on protected routes now accepts either:
   - a bearer token, or
   - signed wallet headers

3. MPP topups still require the wallet to sign the **payment transaction**, but request auth itself can use the bearer token.

So the SDK should shift from:

- **request-time wallet signing on every call**

to:

- **wallet-sign once for token exchange, then bearer token for API requests**

---

## Current AGI `ai-sdk` gaps

### 1. It signs every request today

Current files:

- `packages/ai-sdk/src/auth.ts`
- `packages/ai-sdk/src/fetch.ts`
- `packages/ai-sdk/src/balance.ts`
- `packages/ai-sdk/src/payment.ts`

Current flow:

- `createWalletContext()` builds fresh signed wallet headers
- `createSetuFetch()` injects wallet headers into every API request
- `fetchBalance()` also signs every balance request
- `processSinglePayment()` signs the topup request itself with wallet headers

This is now out of sync with the preferred Setu fast path.

### 2. No bearer token cache / refresh layer

There is no concept of:

- token issuance
- token expiry tracking
- refresh on expiry / `401`
- concurrency-safe token reuse across multiple requests

### 3. Public docs are now misleading

`packages/ai-sdk/README.md` currently says the SDK:

- injects wallet auth headers into all requests
- signs every request as part of normal operation

That is no longer the desired client behavior.

### 4. Published-package nuance: `WalletContext` is part of the public surface

`src/index.ts` exports:

- `createWalletContext`
- `WalletContext`
- `createSetuFetch`

Today `WalletContext` is built around `buildHeaders()`, which encodes the legacy auth model. That makes this refactor partly a **public API design** task, not just an internal code change.

### 5. Release tooling nuance

`packages/ai-sdk/package.json` is versioned independently (`0.1.8` right now), and `scripts/bump-version.ts` does **not** appear to manage it.

`prepare-publish.ts` knows about `packages/ai-sdk`, but only as a version-only package.

That means the release plan must explicitly include:

- manual version bump for `packages/ai-sdk/package.json`
- package-specific changelog/release notes
- explicit publish verification for `@ottocode/ai-sdk`

---

## Desired end state

### Runtime behavior

1. First protected API call (or an explicit preflight) triggers token exchange:
   - SDK signs nonce using `privateKey` or `signer.signNonce`
   - SDK calls `POST /v1/auth/wallet-token`
   - SDK stores `{ accessToken, expiresAt }`

2. Subsequent requests use:
   - `Authorization: Bearer <token>`

3. If token is near expiry or invalid:
   - SDK refreshes it once
   - retries the original request once on `401`

4. MPP payment path remains the same for transaction signing:
   - `signTransaction` still used for payment tx construction
   - topup API request itself uses bearer auth, not signed wallet request headers

### Public SDK behavior

Users should still be able to initialize the SDK with the same high-level auth input:

```ts
createSetu({
  auth: { privateKey: '...' }
})
```

or

```ts
createSetu({
  auth: {
    signer: {
      walletAddress,
      signNonce,
      signTransaction,
    },
  },
})
```

So the **auth input stays stable**, but the **request auth protocol changes internally**.

---

## Recommended scope

### In scope

- migrate request auth from per-request signed headers → bearer token exchange
- keep `privateKey` and external signer support
- keep MPP payment tx signing behavior
- update low-level helpers (`createSetuFetch`, `fetchBalance`, payment flow)
- update tests, README, examples, and release notes

### Out of scope

- changing Setu server endpoints further
- changing MPP payment negotiation semantics
- redesigning provider registry/model resolution
- broad package restructuring unrelated to auth flow

---

## Implementation plan

## Phase 1 — introduce a token/session layer

### New file: `packages/ai-sdk/src/token.ts`

Add a small token manager responsible for:

- issuing wallet access tokens from Setu
- caching token + expiry in memory
- concurrency-safe refresh
- optional invalidation on `401`

### Proposed responsibilities

```ts
interface AccessTokenState {
  token: string;
  expiresAt: number; // epoch ms
}

interface AccessTokenManager {
  getToken(forceRefresh?: boolean): Promise<string>;
  invalidate(): void;
}
```

### Required behavior

- exchange endpoint: `POST ${baseURL}/v1/auth/wallet-token`
- signed wallet headers used **only** for this exchange
- refresh slightly before expiry (for example 30–60s skew)
- dedupe concurrent refreshes with a shared in-flight promise

### Why first

This becomes the new core primitive that all other flows depend on.

---

## Phase 2 — refactor auth context around token acquisition

### Update: `packages/ai-sdk/src/auth.ts`

Current `WalletContext` is request-header oriented.

Refactor it into two conceptual responsibilities:

1. **wallet capability**
   - wallet address
   - sign nonce
   - sign payment transaction

2. **request auth capability**
   - get bearer token
   - invalidate token

### Recommended direction

Keep the existing top-level auth inputs (`privateKey`, `signer`) intact.

Replace the current internal pattern:

- `buildHeaders()` → legacy request auth primitive

with:

- `buildWalletAuthHeaders()` → used only for token issuance
- `tokenManager.getToken()` → used for normal API requests

### Public API recommendation

Because this package is published, prefer this approach:

- keep exporting `createWalletContext`
- keep exporting `WalletContext`
- but redefine `WalletContext` to include token-aware behavior
- mark legacy header-oriented assumptions as deprecated in docs

If we want the cleanest code, we can also add a new internal type and leave `WalletContext` as a thinner compatibility wrapper.

### Important note

Even if we preserve the exported symbol names, we should **not** preserve legacy per-request header behavior. The compatibility should be at the API-shape level, not the protocol level.

---

## Phase 3 — switch request paths to bearer auth

### Update: `packages/ai-sdk/src/fetch.ts`

Current behavior:

- always calls `wallet.buildHeaders()`
- injects `x-wallet-*` into every request

New behavior:

- call `tokenManager.getToken()`
- inject `Authorization: Bearer <token>`
- keep body transforms/caching logic exactly as today
- keep 402 handling exactly as today

### Additional logic to add

- if response is `401`:
  - invalidate token
  - refresh token once
  - retry original request once

### Concurrency requirement

If many parallel requests start at once, they should all share one token exchange instead of all calling `/v1/auth/wallet-token` independently.

### Acceptance criteria

- repeated inference requests do not re-sign wallet auth for each request
- bearer token is reused until refresh window
- 401 causes one clean refresh + retry

---

## Phase 4 — switch balance + topup API requests to bearer auth

### Update: `packages/ai-sdk/src/balance.ts`

Current behavior:

- signs `GET /v1/balance` directly with wallet headers

New behavior:

- use bearer token just like inference requests
- keep output mapping unchanged

### Update: `packages/ai-sdk/src/payment.ts`

Current behavior:

- payment transaction is signed correctly
- `POST /v1/topup` also uses wallet headers

New behavior:

- keep payment transaction signing exactly the same
- change the API call to `/v1/topup` to use bearer auth
- do **not** reintroduce signed-wallet request auth in the topup HTTP call

This preserves MPP while matching Setu’s fast-path request auth.

---

## Phase 5 — clean up the public surface

### Files

- `packages/ai-sdk/src/types.ts`
- `packages/ai-sdk/src/index.ts`
- possibly `packages/ai-sdk/src/setu.ts`

### Proposed public-type changes

#### Keep stable

- `SetuAuth`
- `ExternalSigner`
- `SetuConfig`
- `createSetu()`
- `createSetuFetch()`

#### Add

Optional token-related tuning knobs if needed:

```ts
interface AuthOptions {
  tokenRefreshSkewMs?: number;
}
```

But only add this if we actually need configurability. Default behavior is probably enough.

#### Deprecate in docs

- direct reliance on `WalletContext.buildHeaders()` semantics

If `WalletContext` remains exported, document it as an advanced/internal-ish escape hatch rather than the primary integration surface.

### Recommendation

Prefer **minimal public API churn**:

- keep auth config shape stable
- keep exported factory names stable
- change internal protocol behavior

That gives us most of the speed benefit without forcing downstream code changes.

---

## Phase 6 — reduce unnecessary package weight while touching auth

This is optional, but strongly recommended during the same pass.

### Candidate cleanup

The package currently uses `@solana/web3.js` in:

- `src/auth.ts`
- `src/balance.ts`
- tests

For auth-only operations we can likely replace this with:

- `bs58`
- `tweetnacl`

Possible wins:

- smaller published bundle
- less cold-start overhead in browser/serverless consumers
- closer alignment with the optimized Setu server path

### Recommendation

Do this only if it does not complicate the payment path.

If it expands scope too much, defer it to a follow-up PR after the auth migration lands.

---

## Testing plan

## Unit tests to add/update

### `auth/token` tests

- exchanges token successfully using signed nonce
- caches token until refresh window
- refreshes expired token
- dedupes concurrent refreshes
- invalidates token on demand

### `fetch` tests

- attaches bearer token to normal requests
- refreshes and retries once on `401`
- still handles `402` topup flow correctly
- does not trigger multiple token exchanges for parallel requests

### `payment` tests

- payment tx still uses `signTransaction` / private key path correctly
- `/v1/topup` uses bearer token
- approval callbacks still behave exactly as before

### `balance` tests

- `fetchBalance()` uses bearer token and preserves mapping

### existing test to update

- `tests/external-signer.test.ts`
  - today it asserts `buildHeaders()` behavior
  - update it to assert token exchange inputs / signer usage instead

---

## Documentation updates required

### `packages/ai-sdk/README.md`

Update these sections:

1. **Quick Start**
   - keep examples the same at the top-level API
   - explain that the SDK exchanges a wallet-signed token once, then reuses bearer auth

2. **How It Works**
   - replace "inject wallet auth headers into every request" with the new token flow

3. **Payment section**
   - clarify that MPP payment transaction signing still happens with the wallet
   - separate payment tx signing from request authentication

4. **Low-level utilities**
   - if `createWalletContext` remains exported, document its new semantics carefully

### Any example/test snippets

Search/update references to:

- `x-wallet-address`
- `x-wallet-signature`
- `x-wallet-nonce`
- docs claiming request-time wallet signing on every call

---

## Release / publishing plan

Because `@ottocode/ai-sdk` is published, ship this as a deliberate package release.

## Versioning recommendation

### If public constructor/config stays stable

Release as a **minor** bump:

- `0.1.8` → `0.2.0` is reasonable if you want to signal meaningful behavior change
- or `0.1.9` if you want to treat this as an implementation improvement

My recommendation: **`0.2.0`**

Reason:

- request auth behavior changes materially
- low-level exported helpers may shift semantics
- clearer signal to downstream users

### If exported low-level types/functions break

Also use **`0.2.0`**, and note the low-level breakage in release notes.

## Release checklist

- bump `packages/ai-sdk/package.json` manually
- update README examples/descriptions
- run package tests
- smoke-test against live/local Setu
- publish `@ottocode/ai-sdk`
- add release notes with:
  - new bearer-token auth flow
  - no legacy per-request wallet-signing in SDK
  - MPP payment flow unchanged

---

## Suggested work breakdown for the implementation session

### PR 1 — auth core

- add token manager
- refactor auth context
- add token unit tests

### PR 2 — request flow migration

- update `fetch.ts`
- update `balance.ts`
- update `payment.ts`
- add retry/refresh tests

### PR 3 — docs + release prep

- README changes
- example/test updates
- package version bump
- release notes

If you want to do it in one pass, that is also manageable, but splitting it this way reduces publish risk.

---

## Concrete file-by-file change list

### `packages/ai-sdk/src/auth.ts`
- replace request-header-centric context with token-aware auth context
- keep privateKey + external signer support
- restrict signed-wallet header generation to token exchange only

### `packages/ai-sdk/src/token.ts` (new)
- token exchange
- token cache
- refresh/invalidation
- concurrency lock

### `packages/ai-sdk/src/fetch.ts`
- attach bearer token
- retry once on 401 after refresh
- preserve 402/payment flow

### `packages/ai-sdk/src/balance.ts`
- use bearer token for `/v1/balance`

### `packages/ai-sdk/src/payment.ts`
- keep tx signing logic
- use bearer token for `/v1/topup`

### `packages/ai-sdk/src/setu.ts`
- wire token-aware fetch/auth context into `createSetu()`

### `packages/ai-sdk/src/types.ts`
- adjust low-level types if needed
- add any token-related internal/public interfaces carefully

### `packages/ai-sdk/src/index.ts`
- export new primitives only if truly needed
- avoid growing public surface unnecessarily

### `packages/ai-sdk/tests/*`
- rewrite auth tests around token issuance/caching
- add fetch/payment refresh tests

### `packages/ai-sdk/README.md`
- update auth flow docs
- update low-level examples
- add migration notes

---

## Acceptance criteria

The migration is complete when all of the following are true:

- a normal `generateText()` flow signs once to obtain a token, then uses bearer auth
- repeated requests do not sign wallet auth on every call
- MPP auto-topup still works unchanged from the user’s perspective
- external signer integrations still work
- topup/payment tx signing still works
- expired/invalid token refreshes automatically
- README matches actual runtime behavior
- published package release notes clearly explain the auth change

---

## Recommended implementation posture for the live session

When we open a session in the AGI repo, I’d implement this in the following order:

1. token manager
2. auth context refactor
3. fetch path migration
4. balance + payment path migration
5. tests
6. README + version bump

That order keeps the risk contained and gives us quick checkpoints.

---

## Bottom line

The AGI `ai-sdk` package is currently still on the **old Setu auth model**.

The right update is:

- **keep wallet signing for token exchange and MPP transaction signing**
- **stop signing every normal API request**
- **move the SDK to a cached bearer-token request path**

That matches current Setu functionality, improves request latency, and preserves the main user-facing auth API.
