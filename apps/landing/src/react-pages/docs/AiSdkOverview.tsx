import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function AiSdkOverview() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">AI SDK</h1>
			<p className="text-otto-dim text-sm mb-8">
				Drop-in SDK for accessing AI models through{' '}
				<a href="/docs/setu">Setu</a> with automatic x402 payments via Solana
				USDC.
			</p>

			<h2>Overview</h2>
			<p>
				<code>@ottocode/ai-sdk</code> gives you a single entry point to OpenAI,
				Anthropic, Google, Moonshot, MiniMax, and Z.AI models. All you need is a
				Solana wallet — the SDK handles authentication, payment negotiation, and
				provider routing automatically.
			</p>
			<p>
				It returns{' '}
				<a
					href="https://sdk.vercel.ai"
					target="_blank"
					rel="noopener noreferrer"
				>
					ai-sdk
				</a>{' '}
				compatible model instances that work directly with{' '}
				<code>generateText()</code>, <code>streamText()</code>,{' '}
				<code>generateObject()</code>, and all other ai-sdk functions.
			</p>

			<h2>Install</h2>
			<CodeBlock>{`bun add @ottocode/ai-sdk ai
# or
npm install @ottocode/ai-sdk ai`}</CodeBlock>

			<h2>Quick Start</h2>
			<CodeBlock>{`import { createSetu } from "@ottocode/ai-sdk";
import { generateText } from "ai";

const setu = createSetu({
  auth: { privateKey: process.env.SOLANA_PRIVATE_KEY! },
});

const { text } = await generateText({
  model: setu.model("claude-sonnet-4-20250514"),
  prompt: "Hello!",
});

console.log(text);`}</CodeBlock>

			<h2>External Signer (No Private Key)</h2>
			<p>
				Don't want to share your private key? Use an external signer with
				browser wallets, hardware wallets, or any custom signing logic.
				Framework-agnostic — just provide callbacks for signing.
			</p>
			<CodeBlock>{`const setu = createSetu({
	auth: {
		signer: {
			walletAddress: "YOUR_SOLANA_PUBLIC_KEY",
			signNonce: async (nonce) => await myWallet.signMessage(nonce),
			signTransaction: async (tx) => await myWallet.signTransaction(tx),
		},
	},
});`}</CodeBlock>
			<p className="text-otto-dim text-sm">
				See <a href="/docs/setu/integration">Integration Guide</a> for detailed
				examples with wallet adapters, auth-only mode, and more.
			</p>

			<h2>Provider Auto-Resolution</h2>
			<p>
				Models are resolved to providers by prefix — no need to specify the
				provider manually:
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
							<td>Messages</td>
						</tr>
						<tr>
							<td>
								<code>gpt-</code>, <code>o1</code>, <code>o3</code>,{' '}
								<code>o4</code>, <code>codex-</code>
							</td>
							<td>OpenAI</td>
							<td>Responses</td>
						</tr>
						<tr>
							<td>
								<code>gemini-</code>
							</td>
							<td>Google</td>
							<td>Native</td>
						</tr>
						<tr>
							<td>
								<code>kimi-</code>
							</td>
							<td>Moonshot</td>
							<td>OpenAI Chat</td>
						</tr>
						<tr>
							<td>
								<code>MiniMax-</code>
							</td>
							<td>MiniMax</td>
							<td>Messages</td>
						</tr>
						<tr>
							<td>
								<code>z1-</code>
							</td>
							<td>Z.AI</td>
							<td>OpenAI Chat</td>
						</tr>
					</tbody>
				</table>
			</div>

			<CodeBlock>{`setu.model("claude-sonnet-4-20250514");   // → anthropic
setu.model("gpt-4o");                      // → openai
setu.model("gemini-2.5-pro");             // → google
setu.model("kimi-k2");                    // → moonshot`}</CodeBlock>

			<h3>Explicit Provider</h3>
			<p>Override auto-resolution when needed:</p>
			<CodeBlock>{`const model = setu.provider("openai").model("gpt-4o");
const model = setu.provider("anthropic", "anthropic-messages").model("claude-sonnet-4-20250514");`}</CodeBlock>

			<h2>Streaming</h2>
			<CodeBlock>{`import { streamText } from "ai";

const result = streamText({
  model: setu.model("claude-sonnet-4-20250514"),
  prompt: "Write a short story about a robot.",
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}`}</CodeBlock>

			<h2>Tool Calling</h2>
			<CodeBlock>{`import { generateText, tool } from "ai";
import { z } from "zod";

const { text } = await generateText({
  model: setu.model("claude-sonnet-4-20250514"),
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

			<h2>Balance</h2>
			<CodeBlock>{`// Setu account balance
const balance = await setu.balance();
// { walletAddress, balance, totalSpent, totalTopups, requestCount }

// On-chain USDC balance
const wallet = await setu.walletBalance("mainnet");
// { walletAddress, usdcBalance, network }

// Wallet address
console.log(setu.walletAddress);`}</CodeBlock>

			<h2>Custom Providers</h2>
			<p>Register providers at init or runtime:</p>
			<CodeBlock>{`// At init
const setu = createSetu({
  auth,
  providers: [
    { id: "my-provider", apiFormat: "openai-chat", modelPrefix: "myp-" },
  ],
});

// At runtime
setu.registry.register({
  id: "another-provider",
  apiFormat: "anthropic-messages",
  models: ["specific-model-id"],
});

// Map a specific model to a provider
setu.registry.mapModel("some-model", "openai");`}</CodeBlock>

			<h3>API Formats</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Format</th>
							<th>Description</th>
							<th>Used by</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>openai-responses</code>
							</td>
							<td>OpenAI Responses API</td>
							<td>OpenAI</td>
						</tr>
						<tr>
							<td>
								<code>anthropic-messages</code>
							</td>
							<td>Anthropic Messages API</td>
							<td>Anthropic, MiniMax</td>
						</tr>
						<tr>
							<td>
								<code>openai-chat</code>
							</td>
							<td>OpenAI Chat Completions (compatible)</td>
							<td>Moonshot, Z.AI</td>
						</tr>
						<tr>
							<td>
								<code>google-native</code>
							</td>
							<td>Google GenerativeAI native</td>
							<td>Google</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Low-Level: Custom Fetch</h2>
			<p>Use the x402-aware fetch wrapper directly:</p>
			<CodeBlock>{`const customFetch = setu.fetch();

const response = await customFetch(
  "https://api.setu.ottocode.io/v1/messages",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1024,
    }),
  }
);`}</CodeBlock>

			<h2>Standalone Utilities</h2>
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
const usdc = await fetchWalletUsdcBalance({ privateKey }, "mainnet");

// Create a standalone x402-aware fetch
const setuFetch = createSetuFetch({
  wallet: createWalletContext({ privateKey }),
  baseURL: "https://api.setu.ottocode.io",
});`}</CodeBlock>

			<h2>How It Works</h2>
			<ol>
				<li>
					You call <code>setu.model("claude-sonnet-4-20250514")</code> — the SDK
					resolves this to Anthropic
				</li>
				<li>
					It creates an ai-sdk provider (<code>@ai-sdk/anthropic</code>) pointed
					at the Setu proxy
				</li>
				<li>
					A custom fetch wrapper intercepts all requests to:
					<ul>
						<li>Inject wallet auth headers (address, nonce, signature)</li>
						<li>Inject Anthropic cache control (if enabled)</li>
						<li>Handle 402 responses by signing USDC payments via x402</li>
						<li>Sniff balance/cost info from SSE stream comments</li>
					</ul>
				</li>
				<li>
					The Setu proxy verifies the wallet, checks balance, forwards to the
					real provider, and tracks usage
				</li>
			</ol>

			<h2>Requirements</h2>
			<ul>
				<li>Solana wallet with USDC (for payments)</li>
				<li>
					<code>ai</code> SDK v6+ as a peer dependency
				</li>
				<li>Node.js 18+ or Bun</li>
			</ul>

			<p className="text-otto-dim text-sm mt-8">
				See <a href="/docs/ai-sdk/configuration">Configuration</a> for full
				options, <a href="/docs/ai-sdk/caching">Caching</a> for Anthropic prompt
				caching details, and{' '}
				<a href="/docs/setu/integration">Setu Integration</a> for raw HTTP
				usage.
			</p>
		</DocPage>
	);
}
