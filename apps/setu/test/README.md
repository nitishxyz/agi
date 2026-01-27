# Router Test Scripts

## Setup

1. **Generate a Solana keypair:**
   ```bash
   solana-keygen new -o test-wallet.json
   ```

2. **Get devnet SOL:**
   ```bash
   solana airdrop 1 $(solana-keygen pubkey test-wallet.json) --url devnet
   ```

3. **Get devnet USDC:**
   - Use a devnet USDC faucet, or
   - Transfer from another funded wallet

## Running Tests

### Basic Client Test
```bash
# Start the router first
bun run dev

# In another terminal, run the test
bun run test/client.ts "Your prompt here"

# Or with SST dev mode (secrets auto-linked)
sst dev -- bun run test/client.ts "Hello world"
```

### AI SDK Test
```bash
# Uses @ai-sdk/openai-compatible
bun run test/ai-sdk-client.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTER_URL` | `http://localhost:4002` | Router base URL |
| `RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `KEYPAIR_PATH` | `./test-wallet.json` | Path to Solana keypair |

## Expected Output

```
🚀 Setu Router Test Client
================================
📡 Router URL: http://localhost:4002
🔗 RPC URL: https://api.devnet.solana.com

🔑 Wallet: ABC123...

📋 Available Models:
  OPENAI:
    - gpt-4o-mini ($0.15/$0.60 per 1M)
    - gpt-4o ($2.50/$10.00 per 1M)
    ...

💵 Current Balance: $0.50000000

💬 Sending chat request (model: gpt-4o-mini)...
📝 Response: Hello there, how are you?

📊 Usage: 15 prompt + 6 completion
💰 Cost: $0.00001234
💵 Balance: $0.49998766

✅ Test complete!
```

## Troubleshooting

**"Payment required" error:**
- Your wallet needs USDC balance
- The test client will attempt auto-topup if you have USDC

**"Authentication failed" error:**
- Check your keypair path is correct
- Ensure the keypair file is valid JSON

**"Unsupported model" error:**
- Run `curl http://localhost:4002/v1/models` to see available models
- Update your catalog: `bun run update-catalog`
