import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function AiSdkConfiguration() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Configuration</h1>
			<p className="text-otto-dim text-sm mb-8">
				Full configuration reference for <code>@ottocode/ai-sdk</code>.
			</p>

			<h2>createSetu Options</h2>
			<CodeBlock>{`const setu = createSetu({
  // Auth: private key (default) or external signer
  auth: { privateKey: "..." },
  // OR use an external signer:
  // auth: {
  //   signer: {
  //     walletAddress: "...",
  //     signNonce: async (nonce) => "...",
  //     signTransaction: async (tx) => signedTx, // raw bytes callback
  //   },
  // },

  // Optional: Setu API base URL (default: https://api.setu.ottocode.io)
  baseURL: "https://api.setu.ottocode.io",

  // Optional: Solana RPC URL (default: https://api.mainnet-beta.solana.com)
  rpcURL: "https://api.mainnet-beta.solana.com",

  // Optional: Payment callbacks (see below)
  callbacks: { /* ... */ },

  // Optional: Cache configuration (see Caching docs)
  cache: { /* ... */ },

  // Optional: Payment options (see below)
  payment: { /* ... */ },

  // Optional: Custom model→provider mappings
  modelMap: { "my-custom-model": "openai" },

  // Optional: Register custom providers
  providers: [
    { id: "my-provider", apiFormat: "openai-chat", modelPrefix: "myp-" },
  ],
});`}</CodeBlock>

			<h2>Payment Options</h2>
			<CodeBlock>{`const setu = createSetu({
  auth: { privateKey: "..." },
  payment: {
    // "auto" (default) — pay automatically
    // "approval" — call onPaymentApproval before each payment
    topupApprovalMode: "auto",

    // Auto-pay without approval if wallet USDC balance >= threshold
    autoPayThresholdUsd: 5.0,

    // Max retries for a single API request (default: 3)
    maxRequestAttempts: 3,

    // Max total payment attempts per wallet (default: 20)
    maxPaymentAttempts: 20,
  },
});`}</CodeBlock>

			<h2>Payment Callbacks</h2>
			<p>Monitor and control the payment lifecycle:</p>
			<CodeBlock>{`const setu = createSetu({
  auth: { privateKey: "..." },
  callbacks: {
    onPaymentRequired: (amountUsd, currentBalance) => {
      console.log(\`Payment required: $\${amountUsd}\`);
    },
    onPaymentSigning: () => {
      console.log("Signing payment...");
    },
    onPaymentComplete: ({ amountUsd, newBalance, transactionId }) => {
      console.log(\`Paid $\${amountUsd}, balance: $\${newBalance}\`);
    },
    onPaymentError: (error) => {
      console.error("Payment failed:", error);
    },
    onBalanceUpdate: ({ costUsd, balanceRemaining, inputTokens, outputTokens }) => {
      console.log(\`Cost: $\${costUsd}, remaining: $\${balanceRemaining}\`);
    },
    onPaymentApproval: async ({ amountUsd, currentBalance }) => {
      // return "crypto" to pay, "fiat" for fiat flow, "cancel" to abort
      return "crypto";
    },
  },
});`}</CodeBlock>

			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Callback</th>
							<th>When</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>onPaymentRequired(amountUsd, currentBalance)</code>
							</td>
							<td>402 received, payment about to start</td>
						</tr>
						<tr>
							<td>
								<code>onPaymentSigning()</code>
							</td>
							<td>Building and signing the USDC transaction</td>
						</tr>
						<tr>
							<td>
								<code>
									onPaymentComplete({'{ amountUsd, newBalance, transactionId }'}
									)
								</code>
							</td>
							<td>Payment settled successfully</td>
						</tr>
						<tr>
							<td>
								<code>onPaymentError(error)</code>
							</td>
							<td>Payment failed</td>
						</tr>
						<tr>
							<td>
								<code>
									onPaymentApproval({'{ amountUsd, currentBalance }'})
								</code>
							</td>
							<td>Approval mode: asks user to approve/cancel/choose fiat</td>
						</tr>
						<tr>
							<td>
								<code>onBalanceUpdate({'{ costUsd, balanceRemaining }'})</code>
							</td>
							<td>
								After each request with cost info (streaming & non-streaming)
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Extended Thinking (Anthropic)</h2>
			<CodeBlock>{`const { text } = await generateText({
  model: setu.model("claude-sonnet-4-20250514"),
  prompt: "Solve this complex math problem...",
  providerOptions: {
    anthropic: {
      thinking: { type: "enabled", budgetTokens: 16000 },
    },
  },
});`}</CodeBlock>

			<h2>Environment Variables</h2>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Variable</th>
							<th>Required</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>SETU_PRIVATE_KEY</code>
							</td>
							<td>Yes*</td>
							<td>
								Base58-encoded Solana private key (* not required when using
								external signer)
							</td>
						</tr>
						<tr>
							<td>
								<code>SETU_BASE_URL</code>
							</td>
							<td>No</td>
							<td>
								Override API URL (default:{' '}
								<code>https://api.setu.ottocode.io</code>)
							</td>
						</tr>
						<tr>
							<td>
								<code>SETU_SOLANA_RPC_URL</code>
							</td>
							<td>No</td>
							<td>
								Custom Solana RPC (default:{' '}
								<code>https://api.mainnet-beta.solana.com</code>)
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Using with otto</h2>
			<p>otto has built-in Setu support via the AI SDK:</p>
			<CodeBlock>{`# Login with Setu (generates or imports a Solana wallet)
otto auth login setu

# Or set the private key directly
export SETU_PRIVATE_KEY="your-base58-private-key"

# Use Setu as default provider
otto setup  # select "setu"

# Or per-request
otto ask "hello" --provider setu --model claude-sonnet-4-20250514`}</CodeBlock>
		</DocPage>
	);
}
