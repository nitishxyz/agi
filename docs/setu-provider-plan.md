# Setu Provider Integration Plan

Owner: AGI AI Agent  
Date: 2025-05-17

## Goals

1. Add **Setu** as a first-class provider across SDK, CLI, and Server.
2. Support Solana wallet–based authentication (private key) plus x402 auto-topup flow.
3. Provide a curated model catalog (manual) until Setu exposes a public feed.
4. Ensure prompts, pricing, provider selection, and docs treat Setu like existing providers.

## Constraints & Assumptions

- Wallet secret is provided as a base58 private key (same format required by the Setu client snippets).
- Env fallback: `SETU_PRIVATE_KEY`, optional overrides for RPC/base URL (`SETU_SOLANA_RPC_URL`, `SETU_BASE_URL`, etc.).
- x402 helper packages run under Bun (confirmed by user).
- No automatic catalog feed; we maintain a manual file alongside the generated catalog.
- Minimal surface area changes: avoid rewriting shared auth managers and keep migrations/docs untouched unless needed.

## Work Breakdown

### 1. Types & Configuration

- Extend `ProviderId` union to include `setu`.
- Introduce `WalletAuth` (`{ type: 'wallet'; secret: string }`) in `@agi-cli/sdk` auth types; update guards and storage logic.
- Update default provider config (`packages/sdk/src/config/src/index.ts`) and every provider list/union (CLI, server) to include Setu.
- Expand `providerEnvVar` map and related helpers to support `SETU_PRIVATE_KEY`.
- Adjust `isAuthorized`/`ensureEnv` to treat wallet auth like API keys.

### 2. Manual Catalog & Utilities

- Create `packages/sdk/src/providers/src/catalog-manual.ts` (or similar) describing Setu models (clone used OpenAI/Anthropic entries with Setu pricing/limits per provided table).
- Export a merged catalog (`catalog.ts` → auto-generated feed + manual entries). Avoid modifying generated file: add `catalog.combined.ts` and re-export merged structure.
- Update `providerIds`, `defaultModelFor`, pricing helpers, and prompt logic (treat Setu like OpenAI for prompt families).

### 3. Setu Client Helper

- Add `packages/sdk/src/providers/src/setu-client.ts`:
  - Accept wallet private key + config (base URL, RPC URL, target top-up amount).
  - Implement authenticated `fetch` wrapper that injects wallet headers, intercepts 402 responses, builds x402 payment payload via `x402/client`, submits to `/v1/topup`, and retries.
  - Expose `createSetuProvider(modelId, options)` returning an AI SDK model (`createOpenAICompatible` with custom fetch).
- Dependencies: `@solana/web3.js`, `bs58`, `tweetnacl`, `x402` packages. Add to root package.json.

### 4. Runtime Wiring (SDK + Server + CLI)

- **SDK Resolver (`packages/sdk/src/core/src/providers/resolver.ts`):** add Setu branch using helper, pulling secrets from env/auth.
- **Server Runtime (`packages/server/src/runtime/provider.ts` & selection):** same integration, ensuring background refresh uses stored wallet secret or env var.
- **CLI Auth Flow:** update prompts to show Setu, explain wallet requirements, request private key via password prompt, store as `WalletAuth`, and hint at env var fallback.
- **CLI Commands:** include Setu in `models`, `setup`, `doctor`, `ensureSomeAuth`, default provider toggles, and credentials listing.
- **Ask Service:** ensure injected credentials and `skipFileConfig` path can accept `SETU_PRIVATE_KEY`, not just `_API_KEY`.

### 5. Docs & Tests

- Update `AGENTS.md`, `README.md`, and `docs/architecture.md` with Setu details, env vars, and wallet auth instructions.
- Add focused tests:
  - Provider prompt fallback recognizes Setu.
  - `isAuthorized` returns true when wallet auth exists.
  - Setu catalog merge includes expected models.
- Run `bun lint` + `bun test`.

## Open Questions

1. Default Solana network/RPC? (Assume devnet for now, make configurable via env).
2. Should wallet secrets be encrypted-at-rest? (Current auth store is chmod 600 JSON; matches API key handling).
3. Desired default model + markup? (Copy GPT-4o-mini style initially, adjust later).

## Timeline & Sequencing

1. Types/config/auth updates (unblocks rest).
2. Manual catalog + helper file (keeps providerIds stable).
3. Client helper + resolver integration.
4. CLI/server wiring.
5. Docs/tests + lint/test run.
