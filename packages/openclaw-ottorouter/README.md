# @ottocode/openclaw

Setu provider plugin for [OpenClaw](https://github.com/openclaw/openclaw) — pay for AI with Solana USDC.

No API keys. No accounts. Just a Solana wallet with USDC.

## How It Works

```
OpenClaw → localhost:8403 (Setu proxy) → api.ottorouter.org → LLM provider
```

1. Auto-generates a Solana wallet (or import your own)
2. Fund the wallet with USDC on Solana
3. Each LLM request is signed with your wallet — payment IS authentication
4. Access 30+ models across Anthropic, OpenAI, Google, DeepSeek, and more

## Quick Start

No project installation needed — this is a global tool.

```bash
# Option 1: Zero-install with bunx (recommended)
bunx @ottocode/openclaw setup

# Option 2: Global install
bun install -g @ottocode/openclaw
openclaw setup
```

```bash
# Fund your wallet with USDC on Solana (address shown during setup)

# Start the proxy
bunx @ottocode/openclaw start

# Restart OpenClaw
openclaw gateway restart
```

## CLI Commands

```
openclaw setup              Interactive setup (wallet + config)
openclaw start              Start the local proxy server

openclaw wallet generate    Generate a new Solana wallet
openclaw wallet import      Import an existing private key
openclaw wallet export      Export your private key
openclaw wallet info        Show wallet address and balances

openclaw config inject      Inject Setu provider into openclaw.json
openclaw config remove      Remove Setu provider from openclaw.json
openclaw config status      Check if Setu is configured
```

All commands work with `bunx @ottocode/openclaw <command>` (no install required).

## As an OpenClaw Plugin

If OpenClaw loads the plugin automatically (via `openclaw.extensions` in package.json), Setu registers:

- **Provider**: `setu` — appears in OpenClaw's auth wizard
- **Service**: `setu-proxy` — auto-starts the local proxy with the gateway
- **Commands**: `/wallet` (show balances), `/setu-status` (check config)

## Wallet Storage

- Private key: `~/.openclaw/setu/wallet.key` (mode 0600)
- OpenClaw config: `~/.openclaw/openclaw.json`

## Environment Variables

- `OTTOROUTER_PROXY_PORT` — Proxy port (default: 8403)
- `OTTOROUTER_PRIVATE_KEY` — Alternative to wallet file

## How is this different from ClawRouter?

| | Setu | ClawRouter |
|---|---|---|
| Chain | Solana | Base (EVM) |
| Token | USDC (SPL) | USDC (ERC-20) |
| Protocol | Solana wallet signatures | x402 / EIP-712 |
| Proxy port | 8403 | 8402 |

Both achieve the same goal: pay-per-token AI with no API keys. Choose based on which chain you prefer.
