import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function SetuIntegration() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Integration Guide</h1>
			<p className="text-otto-dim text-sm mb-8">
				Integrate Setu into your application using the{' '}
				<code>@ottocode/ai-sdk</code> package or raw HTTP.
			</p>

			<h2>Using @ottocode/ai-sdk</h2>
			<p>
				The recommended way to integrate Setu. The SDK handles wallet
				authentication, automatic 402 payment handling, provider routing, and
				Anthropic prompt caching out of the box.
			</p>
		<p className="text-otto-dim text-sm">
			For comprehensive SDK documentation, see the{' '}
			<a href="/docs/ai-sdk">AI SDK docs</a>.
		</p>

			<h3>Install</h3>
			<CodeBlock>{`bun add @ottocode/ai-sdk ai
# or
npm install @ottocode/ai-sdk ai`}</CodeBlock>

			<h3>Quick Start</h3>
			<p>
				Create a Setu instance with <code>createSetu()</code> and call{' '}
				<code>setu.model()</code> to get an ai-sdk compatible model. The SDK
				auto-resolves which provider to use based on the model name.
			</p>
			<CodeBlock>{`import { createSetu } from "@ottocode/ai-sdk";
import { generateText } from "ai";

const setu = createSetu({
  auth: { privateKey: process.env.SETU_PRIVATE_KEY! },
});

const { text } = await generateText({
  model: setu.model("claude-sonnet-4-6"),
  prompt: "Hello!",
});

console.log(text);`}</CodeBlock>

			<h3>Provider Auto-Resolution</h3>
			<p>
				Models are resolved to providers by prefix — no need to specify{' '}
				<code>providerNpm</code> manually:
			</p>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Prefix</th>
							<th>Provider</th>
							<th>API Format</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>claude-</code>
							</td>
							<td>Anthropic</td>
							<td>
								<code>/v1/messages</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>gpt-</code>, <code>o1</code>, <code>o3</code>,{' '}
								<code>o4</code>, <code>codex-</code>
							</td>
							<td>OpenAI</td>
							<td>
								<code>/v1/responses</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>gemini-</code>
							</td>
							<td>Google</td>
							<td>Google native</td>
						</tr>
						<tr>
							<td>
								<code>kimi-</code>
							</td>
							<td>Moonshot</td>
							<td>
								<code>/v1/chat/completions</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>MiniMax-</code>
							</td>
							<td>MiniMax</td>
							<td>
								<code>/v1/messages</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>z1-</code>
							</td>
							<td>Z.AI</td>
							<td>
								<code>/v1/chat/completions</code>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<CodeBlock>{`setu.model("claude-sonnet-4-6");      // → anthropic
setu.model("gpt-5");                  // → openai
setu.model("gemini-3-flash-preview"); // → google
setu.model("kimi-k2.5");              // → moonshot`}</CodeBlock>

			<h3>Explicit Provider</h3>
			<p>Override auto-resolution when needed:</p>
			<CodeBlock>{`const model = setu.provider("openai").model("gpt-5");
const model = setu.provider("anthropic", "anthropic-messages").model("claude-sonnet-4-6");`}</CodeBlock>

			<h3>Streaming</h3>
			<CodeBlock>{`import { streamText } from "ai";

const result = streamText({
  model: setu.model("claude-sonnet-4-6"),
  prompt: "Write a short story about a robot.",
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}`}</CodeBlock>

			<h3>Tool Calling</h3>
			<CodeBlock>{`import { generateText, tool } from "ai";
import { z } from "zod";

const { text } = await generateText({
  model: setu.model("claude-sonnet-4-6"),
  prompt: "What's the weather in Tokyo?",
  tools: {
    getWeather: tool({
      description: "Get weather for a location",
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        return { temperature: 22, condition: "cloudy" };
      },
    }),
  },
});`}</CodeBlock>

			<h3>Anthropic Prompt Caching</h3>
			<p>
				The SDK automatically injects <code>cache_control</code> on the first
				system block and last message for Anthropic models, saving ~90% on
				cached token costs. You can customize or disable this:
			</p>
			<CodeBlock>{`// Default: auto caching (1 system + 1 message breakpoint)
createSetu({ auth });

// Disable completely
createSetu({ auth, cache: { anthropicCaching: false } });

// Manual: SDK won't inject cache_control — set it yourself
createSetu({ auth, cache: { anthropicCaching: { strategy: "manual" } } });

// Custom breakpoint count
createSetu({
  auth,
  cache: {
    anthropicCaching: {
      systemBreakpoints: 2,
      messageBreakpoints: 3,
      messagePlacement: "last",
    },
  },
});`}</CodeBlock>

			<h3>Extended Thinking (Anthropic)</h3>
			<CodeBlock>{`const { text } = await generateText({
  model: setu.model("claude-sonnet-4-6"),
  prompt: "Solve this complex math problem...",
  providerOptions: {
    anthropic: {
      thinking: { type: "enabled", budgetTokens: 16000 },
    },
  },
});`}</CodeBlock>

			<h3>Configuration</h3>
			<CodeBlock>{`const setu = createSetu({
  // Required: Solana wallet private key (base58)
  auth: { privateKey: "..." },

  // Optional: Setu API base URL (default: https://api.setu.ottocode.io)
  baseURL: "https://api.setu.ottocode.io",

  // Optional: Solana RPC URL (default: https://api.mainnet-beta.solana.com)
  rpcURL: "https://api.mainnet-beta.solana.com",

  // Optional: Payment callbacks (see below)
  callbacks: { /* ... */ },

  // Optional: Cache configuration
  cache: { /* ... */ },

  // Optional: Payment options
  payment: {
    topupApprovalMode: "auto",    // "auto" | "approval"
    autoPayThresholdUsd: 5.0,
    maxRequestAttempts: 3,
    maxPaymentAttempts: 20,
  },

  // Optional: Custom model→provider mappings
  modelMap: { "my-custom-model": "openai" },

  // Optional: Register custom providers
  providers: [
    { id: "my-provider", apiFormat: "openai-chat", modelPrefix: "myp-" },
  ],
});`}</CodeBlock>

			<h3>Payment Callbacks</h3>
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

			<h3>Balance</h3>
			<CodeBlock>{`// Setu account balance
const balance = await setu.balance();
// { walletAddress, balance, totalSpent, totalTopups, requestCount }

// On-chain USDC balance
const wallet = await setu.walletBalance("mainnet");
// { walletAddress, usdcBalance, network }

// Wallet address
console.log(setu.walletAddress);`}</CodeBlock>

			<h3>Low-Level: Custom Fetch</h3>
			<p>Use the x402-aware fetch wrapper directly for full control:</p>
			<CodeBlock>{`const customFetch = setu.fetch();

const response = await customFetch(
  "https://api.setu.ottocode.io/v1/messages",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1024,
    }),
  }
);`}</CodeBlock>

			<h3>Standalone Utilities</h3>
			<CodeBlock>{`import {
  fetchBalance,
  fetchWalletUsdcBalance,
  getPublicKeyFromPrivate,
  addAnthropicCacheControl,
  createSetuFetch,
} from "@ottocode/ai-sdk";

// Get wallet address from private key
const address = getPublicKeyFromPrivate(privateKey);

// Fetch balance without creating a full Setu instance
const balance = await fetchBalance({ privateKey });

// Fetch on-chain USDC
const usdc = await fetchWalletUsdcBalance({ privateKey }, "mainnet");`}</CodeBlock>

			<hr />

			<h2>Raw HTTP Integration</h2>
			<p>
				You can integrate Setu without the SDK by making direct HTTP requests.
			</p>

			<h3>Endpoint Reference</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Endpoint</th>
							<th>Method</th>
							<th>Auth</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>/</code>
							</td>
							<td>GET</td>
							<td>No</td>
							<td>Service info and available endpoints</td>
						</tr>
						<tr>
							<td>
								<code>/health</code>
							</td>
							<td>GET</td>
							<td>No</td>
							<td>Health check</td>
						</tr>
						<tr>
							<td>
								<code>/v1/models</code>
							</td>
							<td>GET</td>
							<td>No</td>
							<td>List all models with pricing</td>
						</tr>
						<tr>
							<td>
								<code>/v1/balance</code>
							</td>
							<td>GET</td>
							<td>Yes</td>
							<td>Check wallet balance</td>
						</tr>
						<tr>
							<td>
								<code>/v1/topup</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>Top up via x402 USDC payment</td>
						</tr>
						<tr>
							<td>
								<code>/v1/topup/polar</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>Create Polar credit card checkout</td>
						</tr>
						<tr>
							<td>
								<code>/v1/responses</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>OpenAI Responses API (passthrough)</td>
						</tr>
						<tr>
							<td>
								<code>/v1/messages</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>Anthropic Messages API (passthrough)</td>
						</tr>
						<tr>
							<td>
								<code>/v1/chat/completions</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>OpenAI-compatible (Moonshot, Z.AI)</td>
						</tr>
						<tr>
							<td>
								<code>/v1/models/{'{model}'}:generateContent</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>Google native Generative AI</td>
						</tr>
						<tr>
							<td>
								<code>/v1/models/{'{model}'}:streamGenerateContent</code>
							</td>
							<td>POST</td>
							<td>Yes</td>
							<td>Google native streaming</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Example: Direct Anthropic Call</h3>
			<CodeBlock>{`import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SETU_PRIVATE_KEY)
);

const nonce = Date.now().toString();
const signature = nacl.sign.detached(
  new TextEncoder().encode(nonce),
  keypair.secretKey
);

const response = await fetch(
  "https://api.setu.ottocode.io/v1/messages",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": keypair.publicKey.toBase58(),
      "x-wallet-signature": bs58.encode(signature),
      "x-wallet-nonce": nonce,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        { role: "user", content: "Hello, Claude!" }
      ],
    }),
  }
);

if (response.status === 402) {
  // Handle payment — see Payments docs
}

const data = await response.json();
console.log(data.content[0].text);`}</CodeBlock>

			<hr />

			<h2>Error Handling</h2>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Status</th>
							<th>Meaning</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>400</code>
							</td>
							<td>Invalid model, missing fields, unsupported amount</td>
							<td>Fix request</td>
						</tr>
						<tr>
							<td>
								<code>401</code>
							</td>
							<td>Missing auth headers, invalid signature, expired nonce</td>
							<td>Re-sign with fresh nonce</td>
						</tr>
						<tr>
							<td>
								<code>402</code>
							</td>
							<td>Balance below $0.05</td>
							<td>Handle payment via x402 or Polar</td>
						</tr>
						<tr>
							<td>
								<code>429</code>
							</td>
							<td>Upstream provider rate limited</td>
							<td>Retry with backoff</td>
						</tr>
						<tr>
							<td>
								<code>503</code>
							</td>
							<td>Upstream provider overloaded or quota issue</td>
							<td>Retry later</td>
						</tr>
						<tr>
							<td>
								<code>500</code>
							</td>
							<td>Server error</td>
							<td>Report issue</td>
						</tr>
					</tbody>
				</table>
			</div>

			<hr />

			<h2>Environment Variables</h2>

			<h3>Client-Side</h3>
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
							<td>Yes</td>
							<td>Base58-encoded Solana private key</td>
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

			<hr />

			<h2>Using with otto</h2>
			<p>otto has built-in Setu support. Set it as your provider:</p>
			<CodeBlock>{`# Login with Setu (generates or imports a Solana wallet)
otto auth login setu

# Or set the private key directly
export SETU_PRIVATE_KEY="your-base58-private-key"

# Use Setu as default provider
otto setup  # select "setu"

# Or per-request
otto ask "hello" --provider setu --model claude-sonnet-4-6`}</CodeBlock>
			<p>
				otto uses <code>@ottocode/ai-sdk</code> under the hood via{' '}
				<code>createSetu()</code>, handling all wallet auth and payment flows
				transparently.
			</p>
		</DocPage>
	);
}
