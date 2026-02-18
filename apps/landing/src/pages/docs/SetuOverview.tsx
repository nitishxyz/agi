import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function SetuOverview() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Setu</h1>
			<p className="text-otto-dim text-sm mb-8">
				AI inference proxy powered by Solana USDC payments. No API keys — just a
				wallet.
			</p>

			<h2>What is Setu?</h2>
			<p>
				Setu is an AI inference proxy that lets any developer access models from
				OpenAI, Anthropic, Google, and Moonshot using a single Solana wallet.
				Instead of managing separate API keys and billing accounts with each
				provider, you top up a USDC balance and Setu routes your requests to the
				right provider.
			</p>
			<ul>
				<li>
					<strong>No API keys needed</strong> — authenticate with your Solana
					wallet
				</li>
				<li>
					<strong>Pay with USDC</strong> — top up via on-chain USDC transfers or
					credit card (Polar)
				</li>
				<li>
					<strong>Pure passthrough</strong> — request bodies are forwarded
					unchanged, preserving full feature parity with native APIs
				</li>
				<li>
					<strong>Pay-as-you-go</strong> — per-token billing with a 0.5% markup
					over base provider rates
				</li>
			</ul>

			<h2>Architecture</h2>
			<CodeBlock>{`Client (with Solana wallet)
  │
  ├─ Signs request with wallet private key
  │
  ▼
Setu Router (Cloudflare Worker)
  │
  ├─ Verifies wallet signature (auth middleware)
  ├─ Checks USDC balance (balance-check middleware)
  ├─ If balance < $0.05 → returns 402 with x402 payment options
  │
  ├─ Routes by model:
  │   ├─ OpenAI models    → /v1/responses     → api.openai.com
  │   ├─ Anthropic models → /v1/messages       → api.anthropic.com
  │   ├─ Google models    → /v1/models/{model} → generativelanguage.googleapis.com
  │   ├─ Moonshot models  → /v1/chat/completions → api.moonshot.ai
  │   └─ Google (compat)  → /v1/chat/completions → Google OpenAI-compat endpoint
  │
  ├─ Tracks token usage from provider response
  ├─ Deducts cost from user balance
  └─ Returns response with cost metadata`}</CodeBlock>

			<h2>Supported Providers</h2>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Provider</th>
							<th>Endpoint</th>
							<th>API Format</th>
							<th>Features</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>OpenAI</td>
							<td>
								<code>/v1/responses</code>
							</td>
							<td>OpenAI Responses API</td>
							<td>
								Reasoning, tool calling, vision, streaming, background mode (Pro
								models)
							</td>
						</tr>
						<tr>
							<td>Anthropic</td>
							<td>
								<code>/v1/messages</code>
							</td>
							<td>Anthropic Messages API</td>
							<td>
								Prompt caching, extended thinking, tool calling, vision,
								streaming
							</td>
						</tr>
						<tr>
							<td>Google</td>
							<td>
								<code>/v1/models/{'{model}'}:generateContent</code>
							</td>
							<td>Google Generative AI (native)</td>
							<td>Tool calling, reasoning, streaming</td>
						</tr>
						<tr>
							<td>Google</td>
							<td>
								<code>/v1/chat/completions</code>
							</td>
							<td>OpenAI-compatible</td>
							<td>Tool calling, reasoning, streaming</td>
						</tr>
						<tr>
							<td>Moonshot</td>
							<td>
								<code>/v1/chat/completions</code>
							</td>
							<td>OpenAI-compatible</td>
							<td>Tool calling, reasoning, streaming</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Available Models</h2>

			<h3>OpenAI</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Input $/1M</th>
							<th>Output $/1M</th>
							<th>Cache Read</th>
							<th>Context</th>
							<th>Max Output</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>codex-mini-latest</code>
							</td>
							<td>$1.50</td>
							<td>$6.00</td>
							<td>$0.375</td>
							<td>200K</td>
							<td>100K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5</code>
							</td>
							<td>$1.25</td>
							<td>$10.00</td>
							<td>$0.125</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5-mini</code>
							</td>
							<td>$0.25</td>
							<td>$2.00</td>
							<td>$0.025</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5-nano</code>
							</td>
							<td>$0.05</td>
							<td>$0.40</td>
							<td>$0.005</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5-pro</code>
							</td>
							<td>$15.00</td>
							<td>$120.00</td>
							<td>—</td>
							<td>400K</td>
							<td>272K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5-codex</code>
							</td>
							<td>$1.25</td>
							<td>$10.00</td>
							<td>$0.125</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5.1</code>
							</td>
							<td>$1.25</td>
							<td>$10.00</td>
							<td>$0.13</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5.1-codex</code>
							</td>
							<td>$1.25</td>
							<td>$10.00</td>
							<td>$0.125</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5.2</code>
							</td>
							<td>$1.75</td>
							<td>$14.00</td>
							<td>$0.175</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5.2-pro</code>
							</td>
							<td>$21.00</td>
							<td>$168.00</td>
							<td>—</td>
							<td>400K</td>
							<td>128K</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Anthropic</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Input $/1M</th>
							<th>Output $/1M</th>
							<th>Cache Read</th>
							<th>Cache Write</th>
							<th>Context</th>
							<th>Max Output</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>claude-sonnet-4-5</code>
							</td>
							<td>$3.00</td>
							<td>$15.00</td>
							<td>$0.30</td>
							<td>$3.75</td>
							<td>200K</td>
							<td>64K</td>
						</tr>
						<tr>
							<td>
								<code>claude-sonnet-4-0</code>
							</td>
							<td>$3.00</td>
							<td>$15.00</td>
							<td>$0.30</td>
							<td>$3.75</td>
							<td>200K</td>
							<td>64K</td>
						</tr>
						<tr>
							<td>
								<code>claude-opus-4-5</code>
							</td>
							<td>$5.00</td>
							<td>$25.00</td>
							<td>$0.50</td>
							<td>$6.25</td>
							<td>200K</td>
							<td>64K</td>
						</tr>
						<tr>
							<td>
								<code>claude-opus-4-1</code>
							</td>
							<td>$15.00</td>
							<td>$75.00</td>
							<td>$1.50</td>
							<td>$18.75</td>
							<td>200K</td>
							<td>32K</td>
						</tr>
						<tr>
							<td>
								<code>claude-opus-4-0</code>
							</td>
							<td>$15.00</td>
							<td>$75.00</td>
							<td>$1.50</td>
							<td>$18.75</td>
							<td>200K</td>
							<td>32K</td>
						</tr>
						<tr>
							<td>
								<code>claude-haiku-4-5</code>
							</td>
							<td>$1.00</td>
							<td>$5.00</td>
							<td>$0.10</td>
							<td>$1.25</td>
							<td>200K</td>
							<td>64K</td>
						</tr>
						<tr>
							<td>
								<code>claude-3-5-haiku-latest</code>
							</td>
							<td>$0.80</td>
							<td>$4.00</td>
							<td>$0.08</td>
							<td>$1.00</td>
							<td>200K</td>
							<td>8K</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Google</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Input $/1M</th>
							<th>Output $/1M</th>
							<th>Cache Read</th>
							<th>Context</th>
							<th>Max Output</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>gemini-3-flash-preview</code>
							</td>
							<td>$0.50</td>
							<td>$3.00</td>
							<td>$0.05</td>
							<td>1M</td>
							<td>65K</td>
						</tr>
						<tr>
							<td>
								<code>gemini-3-pro-preview</code>
							</td>
							<td>$2.00</td>
							<td>$12.00</td>
							<td>$0.20</td>
							<td>1M</td>
							<td>64K</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Moonshot (Kimi)</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Input $/1M</th>
							<th>Output $/1M</th>
							<th>Cache Read</th>
							<th>Context</th>
							<th>Max Output</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>kimi-k2.5</code>
							</td>
							<td>$0.60</td>
							<td>$3.00</td>
							<td>$0.10</td>
							<td>256K</td>
							<td>256K</td>
						</tr>
						<tr>
							<td>
								<code>kimi-k2-thinking</code>
							</td>
							<td>$0.60</td>
							<td>$2.50</td>
							<td>$0.15</td>
							<td>256K</td>
							<td>256K</td>
						</tr>
						<tr>
							<td>
								<code>kimi-k2-thinking-turbo</code>
							</td>
							<td>$1.15</td>
							<td>$8.00</td>
							<td>$0.15</td>
							<td>256K</td>
							<td>256K</td>
						</tr>
						<tr>
							<td>
								<code>kimi-k2-turbo-preview</code>
							</td>
							<td>$2.40</td>
							<td>$10.00</td>
							<td>$0.60</td>
							<td>256K</td>
							<td>256K</td>
						</tr>
						<tr>
							<td>
								<code>kimi-k2-0905-preview</code>
							</td>
							<td>$0.60</td>
							<td>$2.50</td>
							<td>$0.15</td>
							<td>256K</td>
							<td>256K</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-otto-dim text-xs mt-2">
				All prices are base rates. Setu applies a 0.5% markup. Live pricing
				available at <code>GET /v1/models</code>.
			</p>

			<h2>Environments</h2>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Environment</th>
							<th>Network</th>
							<th>USDC Mint</th>
							<th>Min Top-up</th>
							<th>Top-up Options</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Development</td>
							<td>
								<code>solana-devnet</code>
							</td>
							<td>
								<code>4zMMC9...TDt1v</code>
							</td>
							<td>$0.10</td>
							<td>$0.10, $1, $5, $10</td>
						</tr>
						<tr>
							<td>Production</td>
							<td>
								<code>solana</code> (mainnet)
							</td>
							<td>
								<code>EPjFWdd5...TDt1v</code>
							</td>
							<td>$5.00</td>
							<td>$5, $10, $25, $50</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Base URL</h2>
			<CodeBlock>{`https://api.setu.ottocode.io`}</CodeBlock>
			<p>
				All endpoints are prefixed with <code>/v1</code>.
			</p>

			<h2>Client SDK</h2>
			<p>
				The <code>@ottocode/ai-sdk</code> package is the recommended way to
				integrate with Setu. It handles wallet auth, x402 payments, provider
				routing, and Anthropic prompt caching automatically.
			</p>
			<CodeBlock>{`bun add @ottocode/ai-sdk ai`}</CodeBlock>
			<p>
				See the{' '}
				<a href="/docs/setu/integration">Integration Guide</a>{' '}
				for full usage examples.
			</p>
		</DocPage>
	);
}
