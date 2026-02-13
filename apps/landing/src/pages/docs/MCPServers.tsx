import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function MCPServers() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">MCP Servers</h1>
			<p className="text-otto-dim text-sm mb-8">
				Connect to external tools via the Model Context Protocol.
			</p>

			<p>
				otto supports <strong>MCP (Model Context Protocol)</strong> — the open
				standard for connecting AI agents to external tools and data sources.
				Add local or remote MCP servers to extend your agent with tools like
				GitHub, Linear, Notion, Helius, databases, and more.
			</p>

			<h2>Quick Start</h2>

			<h3>From the Web UI</h3>
			<ol>
				<li>
					Open the <strong>MCP panel</strong> in the right sidebar (blocks icon)
				</li>
				<li>
					Click <strong>+</strong> to add a server
				</li>
				<li>
					Choose <strong>Local (stdio)</strong> or{' '}
					<strong>Remote (HTTP)</strong>
				</li>
				<li>
					Fill in the details and click <strong>Add Server</strong>
				</li>
				<li>Click ▶ to start — tools become available to the agent</li>
			</ol>

			<h3>From the CLI</h3>
			<CodeBlock>{`# Add a local server
otto mcp add github --command npx --args -y @modelcontextprotocol/server-github

# Add a remote server
otto mcp add linear --transport http --url https://mcp.linear.app/mcp

# List / test / status
otto mcp list
otto mcp test github
otto mcp status

# Authenticate with an OAuth server
otto mcp auth linear

# Remove a server
otto mcp remove github`}</CodeBlock>

			<h3>From Config</h3>
			<p>
				Add servers to <code>.otto/config.json</code> (project) or{' '}
				<code>~/.config/otto/config.json</code> (global):
			</p>
			<CodeBlock>{`{
  "mcp": {
    "servers": [
      {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "\${GITHUB_TOKEN}" }
      },
      {
        "name": "helius",
        "command": "npx",
        "args": ["-y", "helius-mcp@latest"],
        "env": { "HELIUS_API_KEY": "your-key-here" }
      },
      {
        "name": "linear",
        "transport": "http",
        "url": "https://mcp.linear.app/mcp"
      }
    ]
  }
}`}</CodeBlock>

			<h2>Transports</h2>
			<table>
				<thead>
					<tr>
						<th>Transport</th>
						<th>Type</th>
						<th>Use Case</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>stdio</code>
						</td>
						<td>Local</td>
						<td>Servers that run as a child process (npx, node, python)</td>
					</tr>
					<tr>
						<td>
							<code>http</code>
						</td>
						<td>Remote</td>
						<td>Servers over Streamable HTTP (recommended)</td>
					</tr>
					<tr>
						<td>
							<code>sse</code>
						</td>
						<td>Remote</td>
						<td>Servers over Server-Sent Events (legacy)</td>
					</tr>
				</tbody>
			</table>

			<h3>Local Servers (stdio)</h3>
			<p>
				Local servers are spawned as child processes. The server communicates
				over stdin/stdout using JSON-RPC.
			</p>
			<CodeBlock>{`{
  "name": "filesystem",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
}`}</CodeBlock>

			<h3>Remote Servers (HTTP/SSE)</h3>
			<p>
				Remote servers connect over the network. Use <code>http</code> for
				modern servers, <code>sse</code> for legacy.
			</p>
			<CodeBlock>{`{
  "name": "linear",
  "transport": "http",
  "url": "https://mcp.linear.app/mcp"
}`}</CodeBlock>
			<p>For servers with API key auth, pass static headers:</p>
			<CodeBlock>{`{
  "name": "my-server",
  "transport": "http",
  "url": "https://mcp.example.com",
  "headers": {
    "Authorization": "Bearer sk-xxx"
  }
}`}</CodeBlock>

			<h2>OAuth Authentication</h2>
			<p>
				Remote servers like Linear, Notion, and Sentry use OAuth. otto handles
				the full OAuth 2.0 + PKCE flow automatically.
			</p>

			<h3>How It Works</h3>
			<ol>
				<li>
					<strong>Start</strong> a remote server → server returns 401
				</li>
				<li>otto detects auth is required → yellow lock icon in sidebar</li>
				<li>Browser opens automatically with the OAuth authorization URL</li>
				<li>
					You authorize → provider redirects to{' '}
					<code>localhost:8090/callback</code>
				</li>
				<li>otto receives the code, exchanges for tokens, and reconnects</li>
				<li>Server turns green — tools are now available</li>
			</ol>

			<h3>CLI Auth</h3>
			<CodeBlock>{`# Start the OAuth flow
otto mcp auth linear

# Check auth status
otto mcp auth linear --status

# Revoke stored credentials
otto mcp auth linear --revoke`}</CodeBlock>

			<h3>OAuth Config</h3>
			<p>For servers that need custom OAuth settings:</p>
			<CodeBlock>{`{
  "name": "linear",
  "transport": "http",
  "url": "https://mcp.linear.app/mcp",
  "oauth": {
    "clientId": "your-client-id",
    "callbackPort": 8090,
    "scopes": ["read", "write"]
  }
}`}</CodeBlock>
			<p>
				Tokens are stored in <code>~/.config/otto/oauth/</code> with{' '}
				<code>0600</code> permissions and refresh automatically.
			</p>

			<h2>How Tools Work</h2>
			<p>When an MCP server is started, otto:</p>
			<ol>
				<li>Connects to the server (stdio/HTTP/SSE)</li>
				<li>
					Calls <code>tools/list</code> to discover available tools
				</li>
				<li>Converts each tool to an AI SDK-compatible format</li>
				<li>
					Registers tools as <code>servername__toolname</code>
				</li>
			</ol>
			<p>
				For example, starting the <code>helius</code> server exposes:
			</p>
			<ul>
				<li>
					<code>helius__getBalance</code>
				</li>
				<li>
					<code>helius__searchAssets</code>
				</li>
				<li>
					<code>helius__getTransactionHistory</code>
				</li>
			</ul>
			<p>
				These tools are <strong>automatically available to all agents</strong>{' '}
				alongside built-in tools. MCP tools bypass the per-agent tool allowlist
				— any running server's tools are available to every agent.
			</p>

			<h2>Config Reference</h2>
			<table>
				<thead>
					<tr>
						<th>Field</th>
						<th>Type</th>
						<th>Required</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>name</code>
						</td>
						<td>string</td>
						<td>✅</td>
						<td>Unique server name</td>
					</tr>
					<tr>
						<td>
							<code>transport</code>
						</td>
						<td>
							<code>"stdio" | "http" | "sse"</code>
						</td>
						<td>No</td>
						<td>
							Default: <code>"stdio"</code>
						</td>
					</tr>
					<tr>
						<td>
							<code>command</code>
						</td>
						<td>string</td>
						<td>stdio only</td>
						<td>Command to spawn</td>
					</tr>
					<tr>
						<td>
							<code>args</code>
						</td>
						<td>string[]</td>
						<td>No</td>
						<td>Command arguments</td>
					</tr>
					<tr>
						<td>
							<code>env</code>
						</td>
						<td>object</td>
						<td>No</td>
						<td>Environment variables</td>
					</tr>
					<tr>
						<td>
							<code>url</code>
						</td>
						<td>string</td>
						<td>http/sse</td>
						<td>Server URL</td>
					</tr>
					<tr>
						<td>
							<code>headers</code>
						</td>
						<td>object</td>
						<td>No</td>
						<td>Static HTTP headers</td>
					</tr>
					<tr>
						<td>
							<code>oauth</code>
						</td>
						<td>object</td>
						<td>No</td>
						<td>OAuth configuration</td>
					</tr>
					<tr>
						<td>
							<code>disabled</code>
						</td>
						<td>boolean</td>
						<td>No</td>
						<td>Disable without removing</td>
					</tr>
				</tbody>
			</table>

			<h2>Popular MCP Servers</h2>
			<table>
				<thead>
					<tr>
						<th>Server</th>
						<th>Command / URL</th>
						<th>Auth</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>GitHub</td>
						<td>
							<code>npx -y @modelcontextprotocol/server-github</code>
						</td>
						<td>API key</td>
					</tr>
					<tr>
						<td>Filesystem</td>
						<td>
							<code>npx -y @modelcontextprotocol/server-filesystem /path</code>
						</td>
						<td>None</td>
					</tr>
					<tr>
						<td>PostgreSQL</td>
						<td>
							<code>npx -y @modelcontextprotocol/server-postgres</code>
						</td>
						<td>Conn string</td>
					</tr>
					<tr>
						<td>Helius</td>
						<td>
							<code>npx -y helius-mcp@latest</code>
						</td>
						<td>API key</td>
					</tr>
					<tr>
						<td>Linear</td>
						<td>
							<code>https://mcp.linear.app/mcp</code>
						</td>
						<td>OAuth</td>
					</tr>
					<tr>
						<td>Notion</td>
						<td>
							<code>npx -y @modelcontextprotocol/server-notion</code>
						</td>
						<td>API key</td>
					</tr>
				</tbody>
			</table>
			<p>
				Browse more at{' '}
				<a href="https://mcp.run" target="_blank" rel="noopener noreferrer">
					mcp.run
				</a>{' '}
				and{' '}
				<a
					href="https://github.com/punkpeye/awesome-mcp-servers"
					target="_blank"
					rel="noopener noreferrer"
				>
					awesome-mcp-servers
				</a>
				.
			</p>

			<h2>Troubleshooting</h2>

			<h3>Server won't start</h3>
			<ul>
				<li>
					Check the command exists: <code>which npx</code>
				</li>
				<li>
					Check env vars are set — use <code>otto mcp test {'<name>'}</code>
				</li>
				<li>For remote servers, check the URL is reachable</li>
			</ul>

			<h3>Tools not appearing</h3>
			<ul>
				<li>
					Make sure the server is <strong>started</strong> (green dot in
					sidebar)
				</li>
				<li>MCP tools are loaded fresh each session</li>
				<li>
					Use <code>otto mcp status</code> to verify tools are indexed
				</li>
			</ul>

			<h3>OAuth flow not completing</h3>
			<ul>
				<li>Ensure port 8090 is not in use</li>
				<li>Check your browser didn't block the popup</li>
				<li>
					Try <code>otto mcp auth {'<name>'}</code> from CLI for details
				</li>
				<li>
					Use <code>otto mcp auth {'<name>'} --revoke</code> and retry
				</li>
			</ul>
		</DocPage>
	);
}
