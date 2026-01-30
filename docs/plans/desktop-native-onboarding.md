# Desktop Native Onboarding - Implementation Plan

## Overview

Replicate the web onboarding natively in Tauri so users can set up their wallet and API providers on first launch **without needing a server**. The Rust backend reads/writes the same `~/.agi/` config files the CLI uses, and the React frontend reuses the same step components adapted for Tauri IPC.

---

## Current State of Desktop App

### Existing Rust Commands (src-tauri/src/commands/)
- `project.rs` — open_project_dialog, get/save/remove recent projects, toggle pin
- `server.rs` — start/stop/list servers (manages child processes)
- `github.rs` — token in OS keychain, get user/repos
- `git.rs` — clone, status, commit, push, pull
- `window.rs` — create_new_window

### Existing Frontend (src/)
- `App.tsx` — View state: `picker | workspace`, checks `--project` arg
- `components/ProjectPicker.tsx` — Open folder, clone from GitHub, recent projects
- `components/Workspace.tsx` — Start server, embed iframe
- `hooks/useServer.ts`, `useProjects.ts`, `useGitHub.ts`
- `lib/tauri-bridge.ts` — All Tauri invoke bindings

### Existing Dependencies
- **Rust**: tauri 2, git2, keyring, tokio, serde, reqwest, dirs, chrono
- **JS**: @tauri-apps/api, react 19, tailwindcss 3 (no lucide-react, no zustand, no qrcode.react)

---

## SDK Auth File Format (CRITICAL — must match exactly)

### ~/.agi/.auth.json
```json
{
  "setu": { "type": "wallet", "secret": "base58_private_key_64bytes" },
  "anthropic": { "type": "api", "key": "sk-ant-..." },
  "openai": { "type": "oauth", "access": "...", "refresh": "...", "expires": 1234567890 }
}
```

**Key fields per type:**
- `ApiAuth` = `{ type: "api", key: string }`
- `WalletAuth` = `{ type: "wallet", secret: string }`
- `OAuth` = `{ type: "oauth", access: string, refresh: string, expires: number }`

### ~/.agi/config.json
```json
{
  "onboardingComplete": true,
  "defaults": {
    "agent": "coder",
    "provider": "setu",
    "model": "claude-sonnet-4-20250514",
    "toolApproval": "auto"
  }
}
```

---

## Proposed App Flow

```
App Launch
    │
    ▼
invoke('get_onboarding_status')
    │
    ├─ NOT complete → Show NativeOnboarding
    │   ├─ Step 1: ProviderSetupStep (wallet + API keys)
    │   └─ Step 2: DefaultsStep (provider/model/agent)
    │   └─ invoke('complete_onboarding') → ProjectPicker
    │
    ├─ Complete + --project arg → Workspace
    │
    └─ Complete → ProjectPicker → select project → Workspace
```

---

## File Changes

### New Files

```
apps/desktop/
├── src/
│   ├── components/
│   │   └── onboarding/
│   │       ├── NativeOnboarding.tsx      # Step orchestrator
│   │       ├── ProviderSetupStep.tsx      # Adapted from web-sdk (no OAuth, no QR, no balance)
│   │       └── DefaultsStep.tsx           # Adapted from web-sdk (static catalog, no API)
│   ├── hooks/
│   │   └── useTauriOnboarding.ts          # Hook wrapping Tauri commands
│   ├── lib/
│   │   └── tauri-onboarding.ts            # invoke() bindings
│   └── data/
│       └── model-catalog.ts               # Static provider/model data
└── src-tauri/
    └── src/
        └── commands/
            └── onboarding.rs              # NEW: 6 Tauri commands
```

### Modified Files

```
apps/desktop/src-tauri/src/commands/mod.rs   # Add `pub mod onboarding;`
apps/desktop/src-tauri/src/lib.rs            # Register 6 new commands
apps/desktop/src-tauri/Cargo.toml            # Add ed25519-dalek, bs58, rand
apps/desktop/package.json                    # Add lucide-react dependency
apps/desktop/src/App.tsx                     # Add loading + onboarding views
```

---

## Phase 1: Rust Backend (`commands/onboarding.rs`)

### 1.1 New Cargo Dependencies

```toml
# Add to [dependencies] in Cargo.toml
ed25519-dalek = { version = "2", features = ["rand_core"] }
bs58 = "0.5"
rand = "0.8"
```

### 1.2 Commands to Implement

| Command | Reads | Writes | Notes |
|---------|-------|--------|-------|
| `get_onboarding_status` | config.json, .auth.json | — | Returns full status |
| `generate_wallet` | .auth.json | .auth.json | Ed25519 keypair, Solana format |
| `add_provider` | .auth.json | .auth.json | `{ type: "api", key }` |
| `remove_provider` | .auth.json | .auth.json | Delete entry |
| `set_defaults` | config.json | config.json | Merge into `defaults` |
| `complete_onboarding` | config.json | config.json | Set `onboardingComplete: true` |

### 1.3 Auth File Format (must match SDK exactly)

```rust
// SDK uses: { type: "api", key: "..." }  — NOT apiKey
// SDK uses: { type: "wallet", secret: "..." } — NOT privateKey/publicKey
// The Rust AuthInfo enum must serialize to match

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum AuthInfo {
    #[serde(rename = "api")]
    Api { key: String },
    #[serde(rename = "wallet")]
    Wallet { secret: String },
    #[serde(rename = "oauth")]
    OAuth {
        access: String,
        refresh: String,
        expires: i64,
    },
}
```

### 1.4 Wallet Generation (must match SDK's Solana format)

The SDK uses `@solana/web3.js Keypair.generate()` which produces:
- `secretKey`: 64 bytes (32 seed + 32 public), base58-encoded
- `publicKey`: 32 bytes, base58-encoded

```rust
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

let signing_key = SigningKey::generate(&mut OsRng);
let verifying_key = signing_key.verifying_key();

// Solana format: 64 bytes = seed || public
let mut full_secret = [0u8; 64];
full_secret[..32].copy_from_slice(signing_key.as_bytes());
full_secret[32..].copy_from_slice(verifying_key.as_bytes());

let secret = bs58::encode(&full_secret).into_string();  // stored as "secret"
let public_key = bs58::encode(verifying_key.as_bytes()).into_string();  // returned to UI
```

### 1.5 Return Types

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingStatus {
    pub onboarding_complete: bool,
    pub setu: SetuStatus,
    pub providers: HashMap<String, ProviderStatus>,
    pub defaults: Defaults,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetuStatus {
    pub configured: bool,
    pub public_key: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub configured: bool,
    pub label: String,
    pub model_count: usize,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Defaults {
    pub agent: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub tool_approval: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletResult {
    pub public_key: String,
}
```

### 1.6 File I/O Helpers

Reuse the same `dirs::home_dir().join(".agi")` pattern from `project.rs`. Set `.auth.json` to mode `0o600` on Unix.

---

## Phase 2: TypeScript Bridge

### 2.1 `src/lib/tauri-onboarding.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface OnboardingStatus {
  onboardingComplete: boolean;
  setu: { configured: boolean; publicKey?: string };
  providers: Record<string, { configured: boolean; label: string; modelCount: number }>;
  defaults: { agent?: string; provider?: string; model?: string; toolApproval?: string };
}

export const tauriOnboarding = {
  getStatus: () => invoke<OnboardingStatus>('get_onboarding_status'),
  generateWallet: () => invoke<{ publicKey: string }>('generate_wallet'),
  addProvider: (provider: string, key: string) =>
    invoke('add_provider', { provider, key }),
  removeProvider: (provider: string) =>
    invoke('remove_provider', { provider }),
  setDefaults: (defaults: { agent?: string; provider?: string; model?: string; toolApproval?: string }) =>
    invoke('set_defaults', defaults),
  completeOnboarding: () => invoke('complete_onboarding'),
};
```

### 2.2 `src/hooks/useTauriOnboarding.ts`

React hook that wraps all commands with loading/error state and auto-refreshes status after mutations. Returns:
- `status`, `isLoading`, `error`
- `fetchStatus`, `setupWallet`, `addProvider`, `removeProvider`, `setDefaults`, `completeOnboarding`

---

## Phase 3: React Components

### 3.1 What to copy from `packages/web-sdk/src/components/onboarding/steps/`

| Web Component | Desktop Adaptation |
|---|---|
| `ProviderSetupStep.tsx` (537 lines) | **Remove**: OAuth flow, QRCodeSVG, useSetuBalance, useSetuStore, ProviderLogo import. **Replace**: with inline SVG icons or text labels. **Simplify**: wallet section shows address + copy button only (no QR, no balance, no topup) |
| `DefaultsStep.tsx` (228 lines) | **Remove**: `apiClient.getConfig()`, `apiClient.getAllModels()`, `apiClient.updateDefaults()`. **Replace**: with static model catalog and Tauri `set_defaults` command |

### 3.2 New JS Dependencies Needed

```json
"lucide-react": "^0.475.0"
```

Both web-sdk steps use lucide-react icons (Copy, Check, Loader2, X, Key, ArrowRight, ArrowLeft, Sparkles, ChevronDown, CreditCard, ExternalLink). Desktop app doesn't have this yet.

**Alternative**: Replace with inline SVG to avoid the dependency. But lucide-react is tiny and already used in ProviderSetupStep — easier to add it.

### 3.3 ProviderLogo

Web-sdk's `ProviderLogo` uses SVG strings from `packages/web-sdk/src/assets/provider-logos.ts`. Options:
1. **Copy `provider-logos.ts`** to `apps/desktop/src/data/` (single file, ~10KB of SVG strings)
2. **Create simplified ProviderLogo** that just shows 2-letter abbreviation

**Recommend option 1** — exact same look as web.

### 3.4 `NativeOnboarding.tsx` — Step Orchestrator

```tsx
// Manages step state ('wallet' | 'defaults')
// Calls useTauriOnboarding hook
// On wallet step mount: auto-calls generateWallet if not configured
// On complete: calls completeOnboarding() then onComplete() callback
```

### 3.5 Static Model Catalog (`src/data/model-catalog.ts`)

Since we can't call `GET /v1/config/models` without a server, bundle a static snapshot. Source from `packages/sdk/src/providers/src/catalog.ts` (auto-generated file). Include only the key providers:

```typescript
export const modelCatalog: Record<string, { label: string; models: { id: string; label: string }[] }> = {
  setu: { label: 'Setu', models: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
  ]},
  anthropic: { label: 'Anthropic', models: [...] },
  openai: { label: 'OpenAI', models: [...] },
  google: { label: 'Google', models: [...] },
  groq: { label: 'Groq', models: [...] },
  deepseek: { label: 'DeepSeek', models: [...] },
  xai: { label: 'xAI', models: [...] },
  openrouter: { label: 'OpenRouter', models: [...] },
};

export const agentList = ['coder', 'chat', 'plan'];
```

---

## Phase 4: App.tsx Integration

### Current Flow
```
picker → workspace
```

### New Flow
```
loading → onboarding? → picker → workspace
           (if needed)
```

```tsx
type View = 'loading' | 'onboarding' | 'picker' | 'workspace';

// On mount:
// 1. Check --project arg (existing)
// 2. invoke('get_onboarding_status')
// 3. If !complete || !setu.configured || no providers → 'onboarding'
// 4. Else if --project arg → 'workspace'
// 5. Else → 'picker'
```

---

## Implementation Checklist

### Phase 1: Rust Backend
- [ ] Add `ed25519-dalek`, `bs58`, `rand` to Cargo.toml
- [ ] Create `src/commands/onboarding.rs` with:
  - [ ] `get_onboarding_status` — read config.json + .auth.json
  - [ ] `generate_wallet` — ed25519 keypair, save as `{ type: "wallet", secret }` 
  - [ ] `add_provider` — save as `{ type: "api", key }`
  - [ ] `remove_provider` — delete from .auth.json
  - [ ] `set_defaults` — merge into config.json `defaults`
  - [ ] `complete_onboarding` — set `onboardingComplete: true`
- [ ] Add `pub mod onboarding;` to `commands/mod.rs`
- [ ] Register all 6 commands in `lib.rs` invoke_handler
- [ ] Verify .auth.json output matches SDK format exactly

### Phase 2: TypeScript Bridge
- [ ] Create `src/lib/tauri-onboarding.ts`
- [ ] Create `src/hooks/useTauriOnboarding.ts`
- [ ] Create `src/data/model-catalog.ts` (static provider/model data)
- [ ] Copy `provider-logos.ts` to `src/data/provider-logos.ts`

### Phase 3: React Components
- [ ] Add `lucide-react` to package.json
- [ ] Create `src/components/onboarding/ProviderLogo.tsx` (adapted)
- [ ] Create `src/components/onboarding/ProviderSetupStep.tsx` (adapted from web-sdk)
  - Remove: OAuth, QRCode, balance, topup, useSetuStore, useSetuBalance
  - Keep: wallet address + copy, API key input, add/remove providers
- [ ] Create `src/components/onboarding/DefaultsStep.tsx` (adapted from web-sdk)
  - Remove: apiClient calls
  - Use: static model catalog + Tauri setDefaults command
- [ ] Create `src/components/onboarding/NativeOnboarding.tsx` (step orchestrator)

### Phase 4: Integration
- [ ] Update `App.tsx` — add 'loading' + 'onboarding' views
- [ ] Update `tauri-bridge.ts` if needed (or keep onboarding in separate module)
- [ ] Test: fresh install → onboarding → project picker → workspace
- [ ] Test: already onboarded → skip straight to picker
- [ ] Verify ~/.agi/config.json and ~/.agi/.auth.json match CLI format

### Phase 5: Polish
- [ ] Error handling (corrupted files, permission errors)
- [ ] Loading states match web UI
- [ ] Styling consistent with web onboarding (same Tailwind classes)
- [ ] `bun lint` passes

---

## Key Differences from Web Onboarding

| Feature | Web | Desktop Native |
|---------|-----|---------------|
| **Data source** | HTTP API → server → SDK | Tauri IPC → Rust → filesystem |
| **Wallet generation** | `@solana/web3.js` | `ed25519-dalek` + `bs58` |
| **Auth file writes** | Server routes → SDK `setAuth()` | Rust `std::fs::write()` |
| **Model catalog** | `GET /v1/config/models` (live) | Static TypeScript file |
| **OAuth** | Popup window + code exchange | Not supported (API key only) |
| **Setu balance** | `GET /v1/setu/balance` (live) | Not shown (no server) |
| **QR code** | `qrcode.react` | Not shown (simplified) |
| **Topup** | Card payment modal | Not available (add later) |

---

## Future Enhancements

1. **OAuth in desktop** — use `tauri-plugin-oauth` for Anthropic Max / OpenAI
2. **Balance display** — direct Solana RPC call from Rust (no server needed)
3. **Shared onboarding package** — extract to `packages/onboarding-core` with pluggable bridge
4. **Auto-update catalog** — fetch latest models on app update
