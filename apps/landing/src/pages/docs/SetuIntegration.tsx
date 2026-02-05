import { CodeBlock } from "../../components/CodeBlock";
export function SetuIntegration() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Integration Guide</h1>
			<p className="text-otto-dim text-sm mb-8">Integrate Setu into your application using the AI SDK or raw HTTP.</p>

			<h2>Using the Vercel AI SDK</h2>
			<p>The recommended way to integrate Setu. The SDK client handles wallet authentication, automatic 402 payment handling, and provider routing.</p>

			<h3>Install Dependencies</h3>
			<CodeBlock>{`bun add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openai-compatible
bun add @solana/web3.js tweetnacl bs58 x402`}</CodeBlock>

			<h3>createSetuModel</h3>
			<p>Creates an AI SDK-compatible model that routes through Setu. Provider is determined by <code>providerNpm</code>:</p>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th><code>providerNpm</code></th>
							<th>Models</th>
							<th>Setu Endpoint</th>
						</tr>
					</thead>
					<tbody>
						<tr><td><code>@ai-sdk/openai</code> (default)</td><td>GPT-5, Codex, etc.</td><td><code>/v1/responses</code></td></tr>
						<tr><td><code>@ai-sdk/anthropic</code></td><td>Claude Sonnet, Opus, Haiku</td><td><code>/v1/messages</code></td></tr>
						<tr><td><code>@ai-sdk/google</code></td><td>Gemini 3 Flash, Pro</td><td><code>/v1/chat/completions</code></td></tr>
						<tr><td><code>@ai-sdk/openai-compatible</code></td><td>Kimi K2, K2.5</td><td><code>/v1/chat/completions</code></td></tr>
					</tbody>
				</table>
			</div>

			<h3>OpenAI Models</h3>
			<CodeBlock>{`import { createSetuModel } from "./setu-client";
import { generateText } from "ai";

const model = createSetuModel(
  "gpt-5-mini",
  { privateKey: process.env.SETU_PRIVATE_KEY },
  { providerNpm: "@ai-sdk/openai" }
);

const { text } = await generateText({
  model,
  prompt: "Explain quantum computing in one sentence.",
});`}</CodeBlock>

			<h3>Anthropic Models</h3>
			<CodeBlock>{`const model = createSetuModel(
  "claude-sonnet-4-5",
  { privateKey: process.env.SETU_PRIVATE_KEY },
  { providerNpm: "@ai-sdk/anthropic" }
);

const { text } = await generateText({
  model,
  prompt: "Write a haiku about TypeScript.",
});`}</CodeBlock>

			<h3>Moonshot Models</h3>
			<CodeBlock>{`const model = createSetuModel(
  "kimi-k2.5",
  { privateKey: process.env.SETU_PRIVATE_KEY },
  { providerNpm: "@ai-sdk/openai-compatible" }
);

const { text } = await generateText({
  model,
  prompt: "Explain the Rust borrow checker.",
});`}</CodeBlock>

			<h3>Google Models</h3>
			<CodeBlock>{`const model = createSetuModel(
  "gemini-3-flash-preview",
  { privateKey: process.env.SETU_PRIVATE_KEY },
  { providerNpm: "@ai-sdk/google" }
);

const { text } = await generateText({
  model,
  prompt: "Summarize this document...",
});`}</CodeBlock>

			<h3>Streaming</h3>
			<CodeBlock>{`import { streamText } from "ai";

const result = streamText({
  model,
  prompt: "Write a short story about a robot.",
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}`}</CodeBlock>

			<h3>Tool Calling</h3>
			<CodeBlock>{`import { generateText, tool } from "ai";
import { z } from "zod";

const { text } = await generateText({
  model,
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
			<p>Setu passes request bodies unchanged, so Anthropic's <code>cache_control</code> works natively:</p>
			<CodeBlock>{`const { text } = await generateText({
  model, // anthropic model via Setu
  messages: [{
    role: "user",
    content: [{
      type: "text",
      text: veryLongDocument,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    }],
  }],
});`}</CodeBlock>

			<h3>Extended Thinking (Anthropic)</h3>
			<CodeBlock>{`const { text } = await generateText({
  model,
  prompt: "Solve this complex math problem...",
  providerOptions: {
    anthropic: {
      thinking: { type: "enabled", budgetTokens: 16000 },
    },
  },
});`}</CodeBlock>

			<h3>createSetuFetch</h3>
			<p>For lower-level control, <code>createSetuFetch</code> returns a drop-in <code>fetch</code> replacement that adds wallet auth and handles 402 payments automatically:</p>
			<CodeBlock>{`import { createSetuFetch } from "./setu-client";

const setuFetch = createSetuFetch(
  { privateKey: process.env.SETU_PRIVATE_KEY },
  {
    baseURL: "https://api.setu.ottocode.io",
    maxRequestAttempts: 3,
    maxPaymentAttempts: 20,
    callbacks: {
      onPaymentRequired: (amountUsd) => {
        console.log("Payment required:", amountUsd);
      },
      onPaymentComplete: ({ amountUsd, newBalance }) => {
        console.log("Paid", amountUsd, "Balance:", newBalance);
      },
      onPaymentError: (error) => {
        console.error("Payment error:", error);
      },
    },
  }
);

// Use as a drop-in fetch replacement
const response = await setuFetch(
  "https://api.setu.ottocode.io/v1/messages",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1024,
    }),
  }
);`}</CodeBlock>

			<h3>Payment Callbacks</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Callback</th>
							<th>When</th>
						</tr>
					</thead>
					<tbody>
						<tr><td><code>onPaymentRequired(amountUsd, currentBalance)</code></td><td>402 received, payment about to start</td></tr>
						<tr><td><code>onPaymentSigning()</code></td><td>Building and signing the USDC transaction</td></tr>
						<tr><td><code>onPaymentComplete({"{ amountUsd, newBalance, transactionId }"})</code></td><td>Payment settled successfully</td></tr>
						<tr><td><code>onPaymentError(error)</code></td><td>Payment failed</td></tr>
						<tr><td><code>onPaymentApproval({"{ amountUsd, currentBalance }"})</code></td><td>Approval mode: asks user to approve/cancel/choose fiat</td></tr>
					</tbody>
				</table>
			</div>

			<h3>Options</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Option</th>
							<th>Default</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr><td><code>baseURL</code></td><td><code>https://api.setu.ottocode.io</code></td><td>Setu API base URL</td></tr>
						<tr><td><code>rpcURL</code></td><td><code>https://api.mainnet-beta.solana.com</code></td><td>Solana RPC for payment transactions</td></tr>
						<tr><td><code>maxRequestAttempts</code></td><td><code>3</code></td><td>Max retries per API request (including payment cycles)</td></tr>
						<tr><td><code>maxPaymentAttempts</code></td><td><code>20</code></td><td>Max total payment attempts across the session</td></tr>
						<tr><td><code>topupApprovalMode</code></td><td><code>auto</code></td><td><code>auto</code> pays immediately, <code>approval</code> calls <code>onPaymentApproval</code></td></tr>
						<tr><td><code>providerNpm</code></td><td><code>@ai-sdk/openai</code></td><td>AI SDK provider package to use</td></tr>
					</tbody>
				</table>
			</div>

			<hr />

			<h2>Raw HTTP Integration</h2>
			<p>You can integrate Setu without the AI SDK by making direct HTTP requests.</p>

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
						<tr><td><code>/</code></td><td>GET</td><td>No</td><td>Service info and available endpoints</td></tr>
						<tr><td><code>/health</code></td><td>GET</td><td>No</td><td>Health check</td></tr>
						<tr><td><code>/v1/models</code></td><td>GET</td><td>No</td><td>List all models with pricing</td></tr>
						<tr><td><code>/v1/balance</code></td><td>GET</td><td>Yes</td><td>Check wallet balance</td></tr>
						<tr><td><code>/v1/topup</code></td><td>POST</td><td>Yes</td><td>Top up via x402 USDC payment</td></tr>
						<tr><td><code>/v1/topup/polar</code></td><td>POST</td><td>Yes</td><td>Create Polar credit card checkout</td></tr>
						<tr><td><code>/v1/topup/polar/estimate</code></td><td>GET</td><td>No</td><td>Estimate Polar fees</td></tr>
						<tr><td><code>/v1/topup/polar/status</code></td><td>GET</td><td>No</td><td>Check Polar checkout status</td></tr>
						<tr><td><code>/v1/responses</code></td><td>POST</td><td>Yes</td><td>OpenAI Responses API (passthrough)</td></tr>
						<tr><td><code>/v1/messages</code></td><td>POST</td><td>Yes</td><td>Anthropic Messages API (passthrough)</td></tr>
						<tr><td><code>/v1/chat/completions</code></td><td>POST</td><td>Yes</td><td>OpenAI-compatible (Moonshot, Google)</td></tr>
						<tr><td><code>/v1/models/{"{model}"}:generateContent</code></td><td>POST</td><td>Yes</td><td>Google native Generative AI</td></tr>
						<tr><td><code>/v1/models/{"{model}"}:streamGenerateContent</code></td><td>POST</td><td>Yes</td><td>Google native streaming</td></tr>
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
      model: "claude-sonnet-4-5",
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
console.log(data.content[0].text);
console.log("Cost:", response.headers.get("x-cost-usd"));
console.log("Balance:", response.headers.get("x-balance-remaining"));`}</CodeBlock>

			<h3>Example: Direct OpenAI Call</h3>
			<CodeBlock>{`const response = await fetch(
  "https://api.setu.ottocode.io/v1/responses",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": walletAddress,
      "x-wallet-signature": signature,
      "x-wallet-nonce": nonce,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: "What is 2 + 2?",
    }),
  }
);`}</CodeBlock>

			<h3>Handling 402 Responses</h3>
			<p>A complete payment handler for raw HTTP integration:</p>
			<CodeBlock>{`import { createPaymentHeader } from "x402/client";
import { svm } from "x402/shared";

async function handlePaymentRequired(
  body: any,
  keypair: Keypair,
  rpcUrl: string
) {
  if (!body.accepts?.length) {
    throw new Error("No payment options available");
  }

  const requirement = body.accepts[0];
  const signer = await svm.createSignerFromBase58(
    bs58.encode(keypair.secretKey)
  );

  const header = await createPaymentHeader(
    signer,
    1,
    requirement,
    { svmConfig: { rpcUrl } }
  );

  const decoded = JSON.parse(
    Buffer.from(header, "base64").toString("utf-8")
  );

  const nonce = Date.now().toString();
  const sig = nacl.sign.detached(
    new TextEncoder().encode(nonce),
    keypair.secretKey
  );

  const topupResponse = await fetch(
    "https://api.setu.ottocode.io/v1/topup",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": keypair.publicKey.toBase58(),
        "x-wallet-signature": bs58.encode(sig),
        "x-wallet-nonce": nonce,
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 1,
          scheme: "exact",
          network: requirement.network,
          payload: { transaction: decoded.payload.transaction },
        },
        paymentRequirement: requirement,
      }),
    }
  );

  if (!topupResponse.ok) {
    throw new Error("Top-up failed: " + topupResponse.status);
  }

  return topupResponse.json();
}`}</CodeBlock>

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
						<tr><td><code>400</code></td><td>Invalid model, missing fields, unsupported amount</td><td>Fix request</td></tr>
						<tr><td><code>401</code></td><td>Missing auth headers, invalid signature, expired nonce</td><td>Re-sign with fresh nonce</td></tr>
						<tr><td><code>402</code></td><td>Balance below $0.05</td><td>Handle payment via x402 or Polar</td></tr>
						<tr><td><code>429</code></td><td>Upstream provider rate limited</td><td>Retry with backoff</td></tr>
						<tr><td><code>503</code></td><td>Upstream provider overloaded or quota issue</td><td>Retry later</td></tr>
						<tr><td><code>500</code></td><td>Server error</td><td>Report issue</td></tr>
					</tbody>
				</table>
			</div>

			<h3>Error Response Format</h3>
			<CodeBlock>{`{
  "error": "Error message here",
  "code": "provider_rate_limited",
  "details": "Optional additional information"
}`}</CodeBlock>
			<p>Upstream provider errors are sanitized — Setu never exposes internal API keys or billing details in error responses.</p>

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
						<tr><td><code>SETU_PRIVATE_KEY</code></td><td>Yes</td><td>Base58-encoded Solana private key</td></tr>
						<tr><td><code>SETU_BASE_URL</code></td><td>No</td><td>Override API URL (default: <code>https://api.setu.ottocode.io</code>)</td></tr>
						<tr><td><code>SETU_SOLANA_RPC_URL</code></td><td>No</td><td>Custom Solana RPC (default: <code>https://api.mainnet-beta.solana.com</code>)</td></tr>
					</tbody>
				</table>
			</div>

			<h3>Server-Side (Self-Hosting)</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Variable</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr><td><code>OPENAI_API_KEY</code></td><td>OpenAI API key</td></tr>
						<tr><td><code>ANTHROPIC_API_KEY</code></td><td>Anthropic API key</td></tr>
						<tr><td><code>GOOGLE_AI_API_KEY</code></td><td>Google Generative AI API key</td></tr>
						<tr><td><code>MOONSHOT_AI_API_KEY</code></td><td>Moonshot API key</td></tr>
						<tr><td><code>PLATFORM_WALLET</code></td><td>Solana wallet to receive USDC payments</td></tr>
						<tr><td><code>DATABASE_URL</code></td><td>Neon Postgres connection string</td></tr>
						<tr><td><code>STAGE</code></td><td><code>prod</code> for mainnet, anything else for devnet</td></tr>
						<tr><td><code>POLAR_ACCESS_TOKEN</code></td><td>Polar API token (for credit card top-ups)</td></tr>
						<tr><td><code>POLAR_WEBHOOK_SECRET</code></td><td>Polar webhook verification secret</td></tr>
						<tr><td><code>POLAR_PRODUCT_ID</code></td><td>Polar product ID for checkout sessions</td></tr>
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
otto ask "hello" --provider setu --model claude-sonnet-4-5`}</CodeBlock>
			<p>otto's SDK automatically uses <code>createSetuModel</code> under the hood, handling all wallet auth and payment flows transparently.</p>
		</div>
	);
}
