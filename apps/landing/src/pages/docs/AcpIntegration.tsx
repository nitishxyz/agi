import { CodeBlock } from '../../components/CodeBlock';
export function AcpIntegration() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">ACP Integration</h1>
			<p className="text-otto-dim text-sm mb-8">
				Agent Client Protocol — use otto as a headless AI agent in any editor.
			</p>

			<h2>What is ACP?</h2>
			<p>
				The <strong>Agent Client Protocol</strong> is an open protocol (Apache
				2.0) created by Zed Industries that standardizes communication between
				code editors (Clients) and AI coding agents (Agents). Think of it as{' '}
				<strong>&ldquo;LSP but for AI agents.&rdquo;</strong>
			</p>
			<ul>
				<li>
					<strong>Protocol:</strong> JSON-RPC 2.0 over stdio
				</li>
				<li>
					<strong>Version:</strong> 1 (integer-based, only bumped on breaking
					changes)
				</li>
				<li>
					<strong>SDK:</strong> <code>@agentclientprotocol/sdk</code> on npm
				</li>
				<li>
					<strong>No TUI required</strong> — the editor provides the entire UI
				</li>
			</ul>

			<h2>How It Works</h2>
			<p>
				Otto runs as a <strong>headless subprocess</strong> that communicates
				with the editor via JSON-RPC over stdin/stdout. The editor handles all
				UI rendering including messages, diffs, tool calls, permission prompts,
				and terminal management.
			</p>
			<CodeBlock>{`┌──────────────────────┐      stdio (JSON-RPC)      ┌──────────────────────┐
│      Client          │ ─────────────────────────▶ │      Agent           │
│  (Zed, JetBrains,   │ ◀───────────────────────── │  (otto)              │
│   Neovim, VS Code)  │                            │                      │
│                      │                            │  - Calls LLMs        │
│  - UI rendering      │                            │  - Runs tools        │
│  - File system       │                            │  - Sends updates     │
│  - Terminal mgmt     │                            │  - Requests perms    │
│  - Permission prompts│                            │                      │
└──────────────────────┘                            └──────────────────────┘`}</CodeBlock>

			<h2>Supported Editors</h2>
			<table>
				<thead>
					<tr>
						<th>Editor</th>
						<th>Support</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Zed</td>
						<td>Native (primary)</td>
					</tr>
					<tr>
						<td>JetBrains IDEs</td>
						<td>Native</td>
					</tr>
					<tr>
						<td>Neovim</td>
						<td>CodeCompanion, agentic.nvim, avante.nvim</td>
					</tr>
					<tr>
						<td>VS Code</td>
						<td>ACP Client extension</td>
					</tr>
					<tr>
						<td>Emacs</td>
						<td>agent-shell.el</td>
					</tr>
				</tbody>
			</table>

			<h2>Protocol Flow</h2>

			<h3>1. Initialization</h3>
			<p>
				The client spawns otto as a subprocess and sends <code>initialize</code>{' '}
				with protocol version, client capabilities, and client info. Otto
				responds with its agent capabilities, info, and authentication methods.
			</p>

			<h3>2. Authentication</h3>
			<p>
				If otto requires authentication (API keys, OAuth), the client calls{' '}
				<code>authenticate</code>.
			</p>

			<h3>3. Session Setup</h3>
			<p>
				The client calls <code>session/new</code> with the working directory and
				optional MCP server configurations. Otto responds with a session ID,
				available models, and available modes.
			</p>

			<h3>4. Prompt Turn</h3>
			<ol>
				<li>
					Client sends <code>session/prompt</code> with user message (text,
					images, files)
				</li>
				<li>
					Otto streams back via <code>session/update</code> notifications:
					<ul>
						<li>
							<code>agent_message_chunk</code> — text responses
						</li>
						<li>
							<code>agent_thought_chunk</code> — reasoning
						</li>
						<li>
							<code>tool_call</code> / <code>tool_call_update</code> — tool
							invocations and progress
						</li>
						<li>
							<code>plan</code> — TODO list entries
						</li>
					</ul>
				</li>
				<li>
					Otto may call client methods like <code>fs/read_text_file</code>,{' '}
					<code>fs/write_text_file</code>, <code>terminal/create</code>, and{' '}
					<code>session/request_permission</code>
				</li>
				<li>
					Turn ends with <code>session/prompt</code> response containing a{' '}
					<code>stopReason</code>
				</li>
			</ol>

			<h3>5. Cancellation</h3>
			<p>
				The client sends <code>session/cancel</code>; otto stops and responds
				with a <code>cancelled</code> stop reason.
			</p>

			<h2>Package Structure</h2>
			<CodeBlock>{`packages/acp/
├── package.json          # @ottocode/acp
├── src/
│   ├── index.ts          # CLI entry point (stdio setup)
│   ├── agent.ts          # OttoAcpAgent implements Agent
│   └── utils.ts          # Helpers
└── tsconfig.json`}</CodeBlock>

			<h2>Usage</h2>

			<h3>Option A: ACP Registry</h3>
			<p>
				The preferred distribution method. Once registered, otto becomes
				available in Zed, JetBrains, and all ACP-compatible clients with
				one-click install and auto-updates.
			</p>

			<h3>Option B: Manual Configuration</h3>
			<p>
				Add otto as a custom agent in your editor settings. For example, in
				Zed&rsquo;s <code>settings.json</code>:
			</p>
			<CodeBlock>{`{
  "agent_servers": {
    "Otto": {
      "type": "custom",
      "command": "otto",
      "args": ["--acp"],
      "env": {}
    }
  }
}`}</CodeBlock>

			<h2>Implementation Details</h2>
			<ul>
				<li>
					<strong>stdio transport:</strong> stdout is reserved for JSON-RPC
					messages only — all logging goes to stderr
				</li>
				<li>
					<strong>File operations:</strong> When the client supports{' '}
					<code>fs.readTextFile</code> / <code>fs.writeTextFile</code>, otto
					delegates file I/O through the editor for better UX (inline diffs,
					etc.)
				</li>
				<li>
					<strong>Terminal operations:</strong> Delegated to the client when{' '}
					<code>terminal</code> capability is present
				</li>
				<li>
					<strong>MCP support:</strong> Connects to MCP servers provided by the
					client during session setup
				</li>
				<li>
					<strong>Tool permissions:</strong> Uses{' '}
					<code>client.requestPermission()</code> before executing destructive
					operations
				</li>
			</ul>

			<h2>Dependencies</h2>
			<CodeBlock>{`{
  "@agentclientprotocol/sdk": "0.14.1"
}`}</CodeBlock>
			<p>
				The SDK handles JSON-RPC framing, message types, and transport.
				Everything else is powered by otto&rsquo;s existing SDK and server
				infrastructure.
			</p>
		</div>
	);
}
