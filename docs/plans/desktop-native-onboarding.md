# Desktop Native Onboarding - Implementation Plan

## Overview

Replicate the web onboarding experience natively in Tauri, eliminating the need to start a server before completing initial setup. This allows users to configure their wallet and providers immediately on first launch.

## Current Web Onboarding Flow

```
App Launch → Server Start → Web UI → checkOnboarding() → OnboardingModal
                                           │
                                           ▼
                                    ProviderSetupStep
                                    - Auto-create Setu wallet
                                    - Add provider API keys
                                    - (Optional) OAuth flow
                                           │
                                           ▼
                                    DefaultsStep
                                    - Select provider/model
                                    - Select agent
                                    - Set tool approval
                                           │
                                           ▼
                                    completeOnboarding()
                                    - Save to ~/.agi/config.json
```

## Proposed Native Flow

```
App Launch → Check ~/.agi/config.json → onboardingComplete?
                                              │
              ┌───────────────────────────────┴───────────────────────────────┐
              │ NO                                                            │ YES
              ▼                                                               ▼
     Native Onboarding (React + Tauri Commands)                      ProjectPicker
     - Same UI components                                                     │
     - Tauri commands instead of API                                          ▼
              │                                                         startServer()
              ▼                                                               │
     Complete → ProjectPicker                                                 ▼
                                                                         Workspace
```

## File Structure

```
apps/desktop/
├── src/
│   ├── App.tsx                          # Add onboarding check
│   ├── components/
│   │   └── onboarding/
│   │       ├── NativeOnboarding.tsx     # Wrapper with Tauri bridge
│   │       ├── ProviderSetupStep.tsx    # Copied/adapted from web-sdk
│   │       └── DefaultsStep.tsx         # Copied/adapted from web-sdk
│   ├── hooks/
│   │   └── useTauriOnboarding.ts        # Tauri commands hook
│   └── lib/
│       └── tauri-onboarding.ts          # Tauri command bindings
└── src-tauri/
    └── src/
        └── commands/
            └── onboarding.rs            # NEW: Native onboarding commands
```

## Data Files

| File | Purpose | Onboarding Actions |
|------|---------|-------------------|
| `~/.agi/config.json` | Global config | Read/write `onboardingComplete`, `defaults` |
| `~/.agi/.auth.json` | Auth credentials | Read/write wallet, provider keys |

### config.json Structure
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

### .auth.json Structure
```json
{
  "setu": {
    "type": "wallet",
    "privateKey": "base58...",
    "publicKey": "base58..."
  },
  "anthropic": {
    "type": "api",
    "apiKey": "sk-ant-..."
  },
  "openai": {
    "type": "api",
    "apiKey": "sk-..."
  }
}
```

---

## Phase 1: Rust Commands

### 1.1 Dependencies (Cargo.toml additions)

```toml
# Wallet generation (Solana-compatible ed25519)
ed25519-dalek = { version = "2", features = ["rand_core"] }
bs58 = "0.5"
rand = "0.8"
```

### 1.2 Onboarding Commands (src-tauri/src/commands/onboarding.rs)

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn get_agi_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or("No home directory".to_string())
        .map(|h| h.join(".agi"))
}

fn get_config_path() -> Result<PathBuf, String> {
    get_agi_dir().map(|d| d.join("config.json"))
}

fn get_auth_path() -> Result<PathBuf, String> {
    get_agi_dir().map(|d| d.join(".auth.json"))
}

// ============ Config Types ============

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Defaults {
    pub agent: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub tool_approval: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub onboarding_complete: Option<bool>,
    pub defaults: Option<Defaults>,
    #[serde(flatten)]
    pub other: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WalletInfo {
    pub public_key: String,
    pub private_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AuthInfo {
    #[serde(rename = "wallet")]
    Wallet {
        #[serde(rename = "publicKey")]
        public_key: String,
        #[serde(rename = "privateKey")]
        private_key: String,
    },
    #[serde(rename = "api")]
    Api {
        #[serde(rename = "apiKey")]
        api_key: String,
    },
    #[serde(rename = "oauth")]
    OAuth {
        #[serde(rename = "accessToken")]
        access_token: String,
        #[serde(rename = "refreshToken")]
        refresh_token: Option<String>,
        #[serde(rename = "expiresAt")]
        expires_at: Option<i64>,
    },
}

pub type AuthFile = std::collections::HashMap<String, AuthInfo>;

// ============ Onboarding Status ============

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub configured: bool,
    #[serde(rename = "type")]
    pub auth_type: Option<String>,
    pub label: String,
    pub supports_oauth: bool,
    pub model_count: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetuStatus {
    pub configured: bool,
    pub public_key: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingStatus {
    pub onboarding_complete: bool,
    pub setu: SetuStatus,
    pub providers: std::collections::HashMap<String, ProviderInfo>,
    pub defaults: Defaults,
}

#[tauri::command]
pub async fn get_onboarding_status() -> Result<OnboardingStatus, String> {
    let config = read_config().await?;
    let auth = read_auth().await.unwrap_or_default();
    
    // Build provider status from catalog + auth
    let mut providers = std::collections::HashMap::new();
    
    // Static provider catalog (simplified)
    let provider_list = vec![
        ("openai", "OpenAI", true, 15),
        ("anthropic", "Anthropic", true, 10),
        ("google", "Google", false, 8),
        ("groq", "Groq", false, 12),
        ("xai", "xAI", false, 3),
        ("deepseek", "DeepSeek", false, 4),
        ("openrouter", "OpenRouter", false, 50),
    ];
    
    for (id, label, supports_oauth, model_count) in provider_list {
        let auth_info = auth.get(id);
        providers.insert(id.to_string(), ProviderInfo {
            configured: auth_info.is_some(),
            auth_type: auth_info.map(|a| match a {
                AuthInfo::Api { .. } => "api",
                AuthInfo::OAuth { .. } => "oauth",
                AuthInfo::Wallet { .. } => "wallet",
            }.to_string()),
            label: label.to_string(),
            supports_oauth,
            model_count,
        });
    }
    
    // Setu status
    let setu_auth = auth.get("setu");
    let setu = SetuStatus {
        configured: setu_auth.is_some(),
        public_key: setu_auth.and_then(|a| match a {
            AuthInfo::Wallet { public_key, .. } => Some(public_key.clone()),
            _ => None,
        }),
    };
    
    Ok(OnboardingStatus {
        onboarding_complete: config.onboarding_complete.unwrap_or(false),
        setu,
        providers,
        defaults: config.defaults.unwrap_or_default(),
    })
}

// ============ Wallet Generation ============

#[tauri::command]
pub async fn generate_wallet() -> Result<WalletInfo, String> {
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;
    
    // Check if wallet already exists
    let auth = read_auth().await.unwrap_or_default();
    if let Some(AuthInfo::Wallet { public_key, private_key }) = auth.get("setu") {
        return Ok(WalletInfo {
            public_key: public_key.clone(),
            private_key: private_key.clone(),
        });
    }
    
    // Generate new keypair
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    
    // Solana format: private key is 64 bytes (32 seed + 32 public)
    let mut full_private = [0u8; 64];
    full_private[..32].copy_from_slice(signing_key.as_bytes());
    full_private[32..].copy_from_slice(verifying_key.as_bytes());
    
    let private_key = bs58::encode(&full_private).into_string();
    let public_key = bs58::encode(verifying_key.as_bytes()).into_string();
    
    // Save to auth file
    let mut auth = read_auth().await.unwrap_or_default();
    auth.insert("setu".to_string(), AuthInfo::Wallet {
        public_key: public_key.clone(),
        private_key: private_key.clone(),
    });
    write_auth(&auth).await?;
    
    Ok(WalletInfo { public_key, private_key })
}

// ============ Provider Management ============

#[tauri::command]
pub async fn add_provider(provider: String, api_key: String) -> Result<(), String> {
    let mut auth = read_auth().await.unwrap_or_default();
    auth.insert(provider, AuthInfo::Api { api_key });
    write_auth(&auth).await
}

#[tauri::command]
pub async fn remove_provider(provider: String) -> Result<(), String> {
    let mut auth = read_auth().await.unwrap_or_default();
    auth.remove(&provider);
    write_auth(&auth).await
}

// ============ Defaults ============

#[tauri::command]
pub async fn set_defaults(
    agent: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    tool_approval: Option<String>,
) -> Result<(), String> {
    let mut config = read_config().await?;
    
    let defaults = config.defaults.get_or_insert(Defaults::default());
    if let Some(a) = agent { defaults.agent = Some(a); }
    if let Some(p) = provider { defaults.provider = Some(p); }
    if let Some(m) = model { defaults.model = Some(m); }
    if let Some(t) = tool_approval { defaults.tool_approval = Some(t); }
    
    write_config(&config).await
}

// ============ Complete Onboarding ============

#[tauri::command]
pub async fn complete_onboarding() -> Result<(), String> {
    let mut config = read_config().await?;
    config.onboarding_complete = Some(true);
    write_config(&config).await
}

// ============ File I/O Helpers ============

async fn read_config() -> Result<Config, String> {
    let path = get_config_path()?;
    if !path.exists() {
        return Ok(Config::default());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

async fn write_config(config: &Config) -> Result<(), String> {
    let dir = get_agi_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    
    let path = get_config_path()?;
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

async fn read_auth() -> Result<AuthFile, String> {
    let path = get_auth_path()?;
    if !path.exists() {
        return Ok(AuthFile::new());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

async fn write_auth(auth: &AuthFile) -> Result<(), String> {
    let dir = get_agi_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    
    let path = get_auth_path()?;
    let content = serde_json::to_string_pretty(auth).map_err(|e| e.to_string())?;
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    
    // Set file permissions to 600 (owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

### 1.3 Register Commands (lib.rs)

```rust
mod commands;

use commands::onboarding;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Existing commands...
            onboarding::get_onboarding_status,
            onboarding::generate_wallet,
            onboarding::add_provider,
            onboarding::remove_provider,
            onboarding::set_defaults,
            onboarding::complete_onboarding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Phase 2: TypeScript Bridge

### 2.1 Tauri Onboarding Bridge (src/lib/tauri-onboarding.ts)

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
}

export interface ProviderInfo {
  configured: boolean;
  type?: 'api' | 'oauth' | 'wallet';
  label: string;
  supportsOAuth: boolean;
  modelCount: number;
}

export interface SetuStatus {
  configured: boolean;
  publicKey?: string;
}

export interface Defaults {
  agent?: string;
  provider?: string;
  model?: string;
  toolApproval?: 'auto' | 'dangerous' | 'all';
}

export interface OnboardingStatus {
  onboardingComplete: boolean;
  setu: SetuStatus;
  providers: Record<string, ProviderInfo>;
  defaults: Defaults;
}

export const tauriOnboarding = {
  getStatus: () => invoke<OnboardingStatus>('get_onboarding_status'),
  
  generateWallet: () => invoke<WalletInfo>('generate_wallet'),
  
  addProvider: (provider: string, apiKey: string) => 
    invoke('add_provider', { provider, apiKey }),
  
  removeProvider: (provider: string) => 
    invoke('remove_provider', { provider }),
  
  setDefaults: (defaults: {
    agent?: string;
    provider?: string;
    model?: string;
    toolApproval?: string;
  }) => invoke('set_defaults', defaults),
  
  completeOnboarding: () => invoke('complete_onboarding'),
};
```

### 2.2 Hook (src/hooks/useTauriOnboarding.ts)

```typescript
import { useState, useCallback } from 'react';
import { tauriOnboarding, type OnboardingStatus } from '../lib/tauri-onboarding';

export function useTauriOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tauriOnboarding.getStatus();
      setStatus(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setupWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      const wallet = await tauriOnboarding.generateWallet();
      await fetchStatus();
      return wallet;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const addProvider = useCallback(async (provider: string, apiKey: string) => {
    setIsLoading(true);
    try {
      await tauriOnboarding.addProvider(provider, apiKey);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const removeProvider = useCallback(async (provider: string) => {
    setIsLoading(true);
    try {
      await tauriOnboarding.removeProvider(provider);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const setDefaults = useCallback(async (defaults: {
    agent?: string;
    provider?: string;
    model?: string;
    toolApproval?: string;
  }) => {
    setIsLoading(true);
    try {
      await tauriOnboarding.setDefaults(defaults);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const completeOnboarding = useCallback(async () => {
    setIsLoading(true);
    try {
      await tauriOnboarding.completeOnboarding();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    fetchStatus,
    setupWallet,
    addProvider,
    removeProvider,
    setDefaults,
    completeOnboarding,
  };
}
```

---

## Phase 3: React Components

### Option A: Copy & Adapt Components (Recommended Initially)

Copy `ProviderSetupStep.tsx` and `DefaultsStep.tsx` from `packages/web-sdk/src/components/onboarding/steps/` to `apps/desktop/src/components/onboarding/` and modify:

1. Replace `apiClient` calls with Tauri commands
2. Remove OAuth popup flow (not needed for desktop initially)
3. Remove Setu balance/topup UI (add later)
4. Use static model catalog instead of API fetch

### Option B: Share Components via Package (Future)

1. Create `packages/onboarding-core` with platform-agnostic components
2. Accept `bridge` prop for platform-specific implementations
3. Use in both web-sdk and desktop app

### 3.1 NativeOnboarding.tsx

```tsx
import { useState, useEffect } from 'react';
import { useTauriOnboarding } from '../hooks/useTauriOnboarding';
import { ProviderSetupStep } from './ProviderSetupStep';
import { DefaultsStep } from './DefaultsStep';

type Step = 'wallet' | 'defaults';

interface NativeOnboardingProps {
  onComplete: () => void;
}

export function NativeOnboarding({ onComplete }: NativeOnboardingProps) {
  const [step, setStep] = useState<Step>('wallet');
  const {
    status,
    fetchStatus,
    setupWallet,
    addProvider,
    removeProvider,
    setDefaults,
    completeOnboarding,
  } = useTauriOnboarding();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleComplete = async () => {
    await completeOnboarding();
    onComplete();
  };

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Convert status to AuthStatus format expected by components
  const authStatus = {
    onboardingComplete: status.onboardingComplete,
    setu: status.setu,
    providers: status.providers,
    defaults: {
      agent: status.defaults.agent || 'coder',
      provider: status.defaults.provider || 'setu',
      model: status.defaults.model || 'claude-sonnet-4-20250514',
      toolApproval: status.defaults.toolApproval || 'auto',
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {step === 'wallet' && (
        <ProviderSetupStep
          authStatus={authStatus}
          onSetupWallet={setupWallet}
          onAddProvider={addProvider}
          onRemoveProvider={removeProvider}
          onNext={() => setStep('defaults')}
        />
      )}
      
      {step === 'defaults' && (
        <DefaultsStep
          authStatus={authStatus}
          onSetDefaults={setDefaults}
          onComplete={handleComplete}
          onBack={() => setStep('wallet')}
        />
      )}
    </div>
  );
}
```

### 3.2 Simplified ProviderSetupStep (Desktop Version)

Key differences from web version:
- No OAuth flow (add API keys only)
- No Setu balance display (show wallet address only)
- No topup button
- Static provider list from Rust

### 3.3 Simplified DefaultsStep (Desktop Version)

Key differences from web version:
- Static model catalog bundled in app
- No API calls to fetch config
- Direct Tauri command for saving defaults

---

## Phase 4: App Integration

### 4.1 Updated App.tsx

```tsx
import { useState, useEffect } from 'react';
import { tauriOnboarding } from './lib/tauri-onboarding';
import { NativeOnboarding } from './components/onboarding/NativeOnboarding';
import { ProjectPicker } from './components/ProjectPicker';
import { Workspace } from './components/Workspace';

type View = 'loading' | 'onboarding' | 'picker' | 'workspace';

function App() {
  const [view, setView] = useState<View>('loading');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const status = await tauriOnboarding.getStatus();
      const hasProvider = Object.values(status.providers).some(p => p.configured);
      
      if (!status.onboardingComplete || !status.setu.configured || !hasProvider) {
        setView('onboarding');
      } else {
        setView('picker');
      }
    } catch (err) {
      console.error('Failed to check onboarding:', err);
      setView('onboarding'); // Default to onboarding on error
    }
  };

  const handleOnboardingComplete = () => {
    setView('picker');
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setView('workspace');
  };

  const handleBack = () => {
    setView('picker');
    setSelectedProject(null);
  };

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {view === 'onboarding' && (
        <NativeOnboarding onComplete={handleOnboardingComplete} />
      )}
      {view === 'picker' && (
        <ProjectPicker onSelectProject={handleSelectProject} />
      )}
      {view === 'workspace' && selectedProject && (
        <Workspace project={selectedProject} onBack={handleBack} />
      )}
    </>
  );
}

export default App;
```

---

## Phase 5: Static Model Catalog

Since we can't fetch models without a server, bundle a static catalog:

### 5.1 Static Catalog (src/data/models.ts)

```typescript
export const modelCatalog: Record<string, {
  label: string;
  models: Array<{ id: string; label: string }>;
}> = {
  setu: {
    label: 'Setu',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: 'o1', label: 'o1' },
    ],
  },
  google: {
    label: 'Google',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
  },
  // ... other providers
};

export const agentList = ['coder', 'chat', 'plan'];
```

---

## Implementation Checklist

### Phase 1: Rust Backend
- [ ] Add Cargo dependencies (ed25519-dalek, bs58, rand)
- [ ] Create `commands/onboarding.rs`
- [ ] Implement `get_onboarding_status`
- [ ] Implement `generate_wallet`
- [ ] Implement `add_provider` / `remove_provider`
- [ ] Implement `set_defaults`
- [ ] Implement `complete_onboarding`
- [ ] Register commands in `lib.rs`
- [ ] Test file I/O and permissions

### Phase 2: TypeScript Layer
- [ ] Create `src/lib/tauri-onboarding.ts`
- [ ] Create `src/hooks/useTauriOnboarding.ts`
- [ ] Create static model catalog

### Phase 3: React Components
- [ ] Copy ProviderSetupStep.tsx (simplify for desktop)
- [ ] Copy DefaultsStep.tsx (simplify for desktop)
- [ ] Create NativeOnboarding.tsx wrapper
- [ ] Add necessary shared components (ProviderLogo, etc.)

### Phase 4: Integration
- [ ] Update App.tsx with onboarding check
- [ ] Add loading state
- [ ] Test complete flow
- [ ] Verify config files are created correctly

### Phase 5: Polish
- [ ] Match web UI styling exactly
- [ ] Add error handling/retry
- [ ] Test on macOS, Windows, Linux
- [ ] Handle edge cases (corrupted files, permissions)

---

## Future Enhancements

1. **OAuth Support**: Add browser-based OAuth flow for Anthropic Max / OpenAI
2. **Wallet Import**: Allow importing existing Setu wallet
3. **Balance Display**: Show SOL/USDC balance via RPC
4. **Topup Integration**: Integrate card payment flow
5. **Shared Components**: Extract to `packages/onboarding-core`

---

## Benefits

1. **Zero server dependency** - Onboarding works immediately
2. **Faster startup** - No HTTP overhead
3. **Offline capable** - Works without network for API key setup
4. **Native performance** - Rust file I/O
5. **Same UX** - Identical to web onboarding
6. **Compatible files** - Uses same `~/.agi/` structure as CLI
