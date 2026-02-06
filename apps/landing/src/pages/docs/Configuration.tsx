import { CodeBlock } from '../../components/CodeBlock';
export function Configuration() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Configuration</h1>
			<p className="text-otto-dim text-sm mb-8">
				Settings, config files, and environment variables.
			</p>

			<h2>Configuration Priority</h2>
			<p>otto checks in this order:</p>
			<ol>
				<li>
					<strong>Injected config</strong> —{' '}
					<code>createEmbeddedApp({'{...}'})</code> (highest)
				</li>
				<li>
					<strong>Environment variables</strong> — <code>OPENAI_API_KEY</code>,
					etc.
				</li>
				<li>
					<strong>Config files</strong> — <code>~/.config/otto/</code>,{' '}
					<code>.otto/</code>
				</li>
				<li>
					<strong>Built-in defaults</strong>
				</li>
			</ol>

			<h2>Directory Structure</h2>
			<CodeBlock>{`~/.config/otto/           # Global configuration
├── auth.json            # API keys (0600 permissions)
└── config.json          # Global defaults

.otto/                    # Project-specific
├── otto.sqlite           # Local conversation history
├── config.json          # Project configuration
├── agents.json          # Agent customizations
├── agents/              # Custom agent prompts
│   └── <agent-name>/
│       └── agent.md
├── commands/            # Custom command definitions
├── tools/               # Custom tool implementations
└── artifacts/           # Large outputs`}</CodeBlock>

			<h2>Configuration Files</h2>

			<h3>Global Auth</h3>
			<p>
				<code>~/.config/otto/auth.json</code> — API keys stored securely (file
				permissions: 0600):
			</p>
			<CodeBlock>{`{
  "openai": {
    "type": "api",
    "key": "sk-..."
  },
  "anthropic": {
    "type": "api",
    "key": "sk-ant-..."
  }
}`}</CodeBlock>

			<h3>Global Config</h3>
			<p>
				<code>~/.config/otto/config.json</code> — User-wide defaults:
			</p>
			<CodeBlock>{`{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4",
    "agent": "general"
  }
}`}</CodeBlock>

			<h3>Project Config</h3>
			<p>
				<code>.otto/config.json</code> — Project-specific overrides:
			</p>
			<CodeBlock>{`{
  "defaults": {
    "provider": "openai",
    "model": "gpt-4",
    "agent": "build"
  }
}`}</CodeBlock>

			<h3>Agent Customization</h3>
			<p>
				<code>.otto/agents.json</code>:
			</p>
			<CodeBlock>{`{
  "build": {
    "tools": ["read", "write", "bash", "git_*"],
    "prompt": ".otto/agents/build/agent.md"
  },
  "test": {
    "tools": ["read", "bash"],
    "appendTools": ["progress_update"]
  }
}`}</CodeBlock>

			<h2>Environment Variables</h2>
			<CodeBlock>{`# Provider API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...

# Optional: Default provider/model/agent
OTTO_PROVIDER=openai
OTTO_MODEL=gpt-4
OTTO_AGENT=build`}</CodeBlock>

			<h2>Configuration Scenarios</h2>
			<table>
				<thead>
					<tr>
						<th>Mode</th>
						<th>Injected</th>
						<th>Env Vars</th>
						<th>Files</th>
						<th>Use Case</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>CLI</td>
						<td>-</td>
						<td>-</td>
						<td>Yes</td>
						<td>Desktop development</td>
					</tr>
					<tr>
						<td>CI/CD</td>
						<td>-</td>
						<td>Yes</td>
						<td>-</td>
						<td>GitHub Actions, Docker</td>
					</tr>
					<tr>
						<td>Embedded</td>
						<td>Yes</td>
						<td>-</td>
						<td>-</td>
						<td>VSCode extension, SaaS</td>
					</tr>
					<tr>
						<td>Hybrid</td>
						<td>Partial</td>
						<td>API keys</td>
						<td>Defaults</td>
						<td>Mix of all</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
