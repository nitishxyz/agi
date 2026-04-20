import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';

export function Configuration() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Configuration</h1>
			<p className="text-otto-dim text-sm mb-8">
				Settings, config files, auth storage, and environment variables.
			</p>

			<h2>Configuration Priority</h2>
			<p>otto resolves values in this order:</p>
			<ol>
				<li>
					<strong>Injected config</strong> —{' '}
					<code>createEmbeddedApp({'{...}'})</code>
				</li>
				<li>
					<strong>Environment variables</strong>
				</li>
				<li>
					<strong>Project config</strong> — <code>.otto/</code>
				</li>
				<li>
					<strong>Global config</strong> — <code>~/.config/otto/</code>
				</li>
				<li>
					<strong>Built-in defaults</strong>
				</li>
			</ol>
			<p>
				Auth secrets are special: they live in secure OS-specific storage, not
				in the global config directory.
			</p>

			<h2>Directory Structure</h2>
			<CodeBlock>{`~/.config/otto/
├── config.json
├── agents.json
├── agents/
├── commands/
├── tools/
└── skills/

.otto/
├── otto.sqlite
├── config.json
├── agents.json
├── agents/
│   ├── <name>.md
│   └── <name>.txt
├── commands/
│   ├── <command>.json
│   ├── <command>.md
│   └── <command>.txt
├── tools/
│   └── <tool-name>/
│       ├── tool.js
│       └── tool.mjs
└── skills/`}</CodeBlock>

			<h2>Secure Auth Storage</h2>
			<table>
				<thead>
					<tr>
						<th>Platform</th>
						<th>Auth path</th>
						<th>OAuth directory</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>macOS</td>
						<td>
							<code>~/Library/Application Support/otto/auth.json</code>
						</td>
						<td>
							<code>~/Library/Application Support/otto/oauth/</code>
						</td>
					</tr>
					<tr>
						<td>Linux</td>
						<td>
							<code>$XDG_STATE_HOME/otto/auth.json</code> or{' '}
							<code>~/.local/state/otto/auth.json</code>
						</td>
						<td>
							<code>$XDG_STATE_HOME/otto/oauth/</code> or{' '}
							<code>~/.local/state/otto/oauth/</code>
						</td>
					</tr>
					<tr>
						<td>Windows</td>
						<td>
							<code>%APPDATA%/otto/auth.json</code>
						</td>
						<td>
							<code>%APPDATA%/otto/oauth/</code>
						</td>
					</tr>
				</tbody>
			</table>

			<h2>Config Files</h2>

			<h3>Global config</h3>
			<CodeBlock>{`{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4",
    "agent": "build"
  }
}`}</CodeBlock>

			<h3>Project config</h3>
			<CodeBlock>{`{
  "defaults": {
    "provider": "openai",
    "model": "gpt-4o",
    "agent": "build"
  },
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true },
    "google": { "enabled": false }
  }
}`}</CodeBlock>

			<h3>Agent customization</h3>
			<CodeBlock>{`{
  "build": {
    "appendTools": ["git_diff", "glob"]
  },
  "reviewer": {
    "tools": ["read", "ls", "tree", "ripgrep", "update_todos"],
    "prompt": ".otto/agents/reviewer.md",
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  }
}`}</CodeBlock>

			<h2>Environment Variables</h2>
			<CodeBlock>{`OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...
OPENCODE_API_KEY=...
OTTOROUTER_PRIVATE_KEY=...
MOONSHOT_API_KEY=...
MINIMAX_API_KEY=...
ZAI_API_KEY=...
ZAI_CODING_API_KEY=...`}</CodeBlock>

			<h2>MCP Configuration</h2>
			<p>MCP servers can be configured in either project or global config.</p>
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
        "name": "linear",
        "transport": "http",
        "url": "https://mcp.linear.app/mcp"
      }
    ]
  }
}`}</CodeBlock>
		</DocPage>
	);
}
