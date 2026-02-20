import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function OpenClawSetu() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">OpenClaw + Setu</h1>
			<p className="text-otto-dim text-sm mb-8">
				Use Setu as a provider in{' '}
				<a
					href="https://github.com/openclaw/openclaw"
					target="_blank"
					rel="noopener noreferrer"
				>
					OpenClaw
				</a>{' '}
				— pay for 30+ AI models with Solana USDC. No API keys, no accounts, just
				a wallet.
			</p>

			<h2>How It Works</h2>
			<p>
				The <code>@ottocode/openclaw-setu</code> plugin runs a local proxy that
				handles Solana wallet signing transparently. OpenClaw talks to the proxy
				like any other OpenAI-compatible provider.
			</p>
			<CodeBlock>{`OpenClaw → localhost:8403 (Setu proxy) → api.setu.ottocode.io → LLM provider`}</CodeBlock>
			<ol>
				<li>
					The plugin auto-generates a Solana wallet (or you import your own)
				</li>
				<li>You fund the wallet with USDC on Solana</li>
				<li>
					Each LLM request is signed with your wallet — payment{' '}
					<strong>is</strong> authentication
				</li>
				<li>
					Access models from Anthropic, OpenAI, Google, DeepSeek, and more
				</li>
			</ol>

			<h2>Quick Start</h2>
			<p>Two commands to get started:</p>
			<CodeBlock>{`# Install the plugin
bun add @ottocode/openclaw-setu

# Interactive setup — generates wallet, injects config
bunx openclaw-setu setup`}</CodeBlock>
			<p>The setup wizard will:</p>
			<ul>
				<li>
					Generate a new Solana wallet (or let you import an existing one)
				</li>
				<li>
					Store the private key at <code>~/.openclaw/setu/wallet.key</code>{' '}
					(mode 0600)
				</li>
				<li>
					Inject the Setu provider into <code>~/.openclaw/openclaw.json</code>
				</li>
				<li>Print your wallet address for funding</li>
			</ul>

			<p>Then start the proxy and restart OpenClaw:</p>
			<CodeBlock>{`# Fund your wallet with USDC on Solana (address shown during setup)

# Start the local proxy
bunx openclaw-setu start

# Restart OpenClaw to pick up the new provider
openclaw gateway restart`}</CodeBlock>

			<p>
				That's it. Your OpenClaw instance now has access to all Setu models.
				Select any <code>setu/</code> model in your OpenClaw conversations.
			</p>

			<hr />

			<h2>Available Models</h2>
			<p>
				During setup, the plugin fetches the full model catalog from Setu's API
				(currently 49 models). Here are highlights from each provider:
			</p>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Provider</th>
							<th>Context</th>
							<th>Features</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>claude-sonnet-4-6</code>
							</td>
							<td>Anthropic</td>
							<td>200K</td>
							<td>Text, Image, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>claude-opus-4-6</code>
							</td>
							<td>Anthropic</td>
							<td>200K</td>
							<td>Text, Image, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5.1-codex</code>
							</td>
							<td>OpenAI</td>
							<td>400K</td>
							<td>Text, Image, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>gpt-5</code>
							</td>
							<td>OpenAI</td>
							<td>400K</td>
							<td>Text, Image, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>gemini-3-pro-preview</code>
							</td>
							<td>Google</td>
							<td>1M</td>
							<td>Text, Image, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>kimi-k2.5</code>
							</td>
							<td>Moonshot</td>
							<td>256K</td>
							<td>Text, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>glm-5</code>
							</td>
							<td>Z.AI</td>
							<td>200K</td>
							<td>Text, Reasoning</td>
						</tr>
						<tr>
							<td>
								<code>MiniMax-M2.5</code>
							</td>
							<td>MiniMax</td>
							<td>200K</td>
							<td>Text, Reasoning</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-otto-dim text-sm">
				Full catalog: 18 Anthropic models, 18 OpenAI models, 2 Google, 6
				Moonshot, 3 Z.AI, 2 MiniMax. Run{' '}
				<code>curl https://api.setu.ottocode.io/v1/models</code> to see all
				available models with pricing.
			</p>

			<hr />

			<h2>CLI Reference</h2>
			<p>
				The plugin includes a full CLI for managing your wallet and
				configuration.
			</p>

			<h3>Setup & Server</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Command</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>openclaw-setu setup</code>
							</td>
							<td>Interactive setup — wallet generation + config injection</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu start</code>
							</td>
							<td>Start the local proxy server (port 8403)</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu start -v</code>
							</td>
							<td>Start with verbose logging (shows per-request costs)</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Wallet Management</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Command</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>openclaw-setu wallet generate</code>
							</td>
							<td>Generate a new Solana wallet</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu wallet import</code>
							</td>
							<td>Import an existing private key (base58)</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu wallet export</code>
							</td>
							<td>Print your private key</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu wallet info</code>
							</td>
							<td>
								Show wallet address, Setu balance, and on-chain USDC balance
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>Configuration</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Command</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>openclaw-setu config inject</code>
							</td>
							<td>
								Add Setu provider to <code>openclaw.json</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu config remove</code>
							</td>
							<td>
								Remove Setu provider from <code>openclaw.json</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>openclaw-setu config status</code>
							</td>
							<td>Check if Setu is configured</td>
						</tr>
					</tbody>
				</table>
			</div>

			<hr />

			<h2>OpenClaw Plugin Features</h2>
			<p>
				When OpenClaw loads the plugin (via <code>openclaw.extensions</code> in
				package.json), it automatically registers:
			</p>
			<ul>
				<li>
					<strong>Provider</strong> — <code>setu</code> appears in OpenClaw's
					auth wizard with wallet setup
				</li>
				<li>
					<strong>Service</strong> — <code>setu-proxy</code> auto-starts with
					the gateway
				</li>
				<li>
					<strong>Commands</strong>:
					<ul>
						<li>
							<code>/wallet</code> — Show your wallet address and balances
							inline
						</li>
						<li>
							<code>/setu-status</code> — Check plugin configuration status
						</li>
					</ul>
				</li>
			</ul>

			<hr />

			<h2>How Is This Different from ClawRouter?</h2>
			<p>
				<a
					href="https://github.com/BlockRunAI/ClawRouter"
					target="_blank"
					rel="noopener noreferrer"
				>
					ClawRouter
				</a>{' '}
				is another payment plugin for OpenClaw that uses USDC on Base (EVM) via
				the x402 protocol. Setu uses USDC on Solana instead.
			</p>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th></th>
							<th>Setu</th>
							<th>ClawRouter</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<strong>Chain</strong>
							</td>
							<td>Solana</td>
							<td>Base (EVM)</td>
						</tr>
						<tr>
							<td>
								<strong>Token</strong>
							</td>
							<td>USDC (SPL)</td>
							<td>USDC (ERC-20)</td>
						</tr>
						<tr>
							<td>
								<strong>Protocol</strong>
							</td>
							<td>Solana wallet signatures</td>
							<td>x402 / EIP-712</td>
						</tr>
						<tr>
							<td>
								<strong>Proxy Port</strong>
							</td>
							<td>8403</td>
							<td>8402</td>
						</tr>
						<tr>
							<td>
								<strong>Auth</strong>
							</td>
							<td>Solana wallet (base58)</td>
							<td>EVM wallet (0x hex)</td>
						</tr>
						<tr>
							<td>
								<strong>Wallet Storage</strong>
							</td>
							<td>
								<code>~/.openclaw/setu/wallet.key</code>
							</td>
							<td>
								<code>~/.openclaw/blockrun/wallet.key</code>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p>
				Both achieve the same goal: pay-per-token AI with no API keys. Choose
				based on which chain you prefer. You can even run both simultaneously —
				they use different ports.
			</p>

			<hr />

			<h2>Importing an Existing Wallet</h2>
			<p>If you already use otto with Setu, you can reuse the same wallet:</p>
			<CodeBlock>{`# Export from otto
otto auth login setu  # if not already set up

# Import into OpenClaw plugin
openclaw-setu wallet import
# Paste your base58 private key when prompted`}</CodeBlock>
			<p>
				Or set the <code>SETU_PRIVATE_KEY</code> environment variable — the
				plugin checks it as a fallback.
			</p>

			<hr />

			<h2>Environment Variables</h2>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Variable</th>
							<th>Default</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>SETU_PROXY_PORT</code>
							</td>
							<td>8403</td>
							<td>Local proxy port</td>
						</tr>
						<tr>
							<td>
								<code>SETU_PRIVATE_KEY</code>
							</td>
							<td>—</td>
							<td>Alternative to wallet file (base58 Solana private key)</td>
						</tr>
					</tbody>
				</table>
			</div>

			<hr />

			<h2>Troubleshooting</h2>

			<h3>Proxy won't start</h3>
			<p>
				Make sure you've run <code>openclaw-setu setup</code> first. The proxy
				needs a wallet to sign requests.
			</p>

			<h3>402 Payment Required errors</h3>
			<p>Your Setu balance is low. Fund your wallet with USDC on Solana:</p>
			<CodeBlock>{`# Check your balance and wallet address
openclaw-setu wallet info

# Send USDC to the wallet address shown`}</CodeBlock>

			<h3>Models not showing in OpenClaw</h3>
			<p>Verify the config was injected, then restart the gateway:</p>
			<CodeBlock>{`openclaw-setu config status
openclaw gateway restart`}</CodeBlock>

			<h3>Port conflict</h3>
			<p>If port 8403 is in use, set a custom port:</p>
			<CodeBlock>{`SETU_PROXY_PORT=8404 openclaw-setu start`}</CodeBlock>
			<p>
				Then re-inject the config to update the port in{' '}
				<code>openclaw.json</code>:
			</p>
			<CodeBlock>{`SETU_PROXY_PORT=8404 openclaw-setu config inject`}</CodeBlock>
		</DocPage>
	);
}
