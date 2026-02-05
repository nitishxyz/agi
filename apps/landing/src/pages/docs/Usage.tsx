import { CodeBlock } from "../../components/CodeBlock";
export function Usage() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Usage Guide</h1>
			<p className="text-otto-dim text-sm mb-8">Commands and workflows for daily use.</p>

			<h2>Core Commands</h2>

			<h3>Interactive / One-Shot</h3>
			<CodeBlock>{`otto                           # start server + web UI (opens browser)
otto ask "explain this error"  # one-shot question
otto ask "write tests" --agent build
otto ask "follow up" --last    # continue last session`}</CodeBlock>

			<h3>Server Mode</h3>
			<CodeBlock>{`otto serve                     # start HTTP server on random port
otto serve --port 3000         # start on specific port
otto serve --network           # bind to 0.0.0.0 for LAN access`}</CodeBlock>

			<h3>Session Management</h3>
			<CodeBlock>{`otto sessions                  # interactive session picker
otto sessions --list           # list all sessions
otto sessions --json           # output as JSON
otto sessions --limit 10       # limit results`}</CodeBlock>

			<h3>Provider & Model Configuration</h3>
			<CodeBlock>{`otto models                    # interactive provider/model selection
otto switch                    # alias for models command
otto auth login                # configure provider credentials
otto auth list                 # list configured providers
otto auth logout               # remove provider credentials`}</CodeBlock>

			<h3>Agent & Tool Management</h3>
			<CodeBlock>{`otto agents                    # list and configure agents
otto agents --local            # edit local project agents
otto tools                     # list available tools
otto scaffold                  # generate new agents, tools, or commands`}</CodeBlock>

			<h3>Diagnostics</h3>
			<CodeBlock>{`otto doctor                    # check configuration and diagnose
otto --version                 # show version
otto --help                    # show help`}</CodeBlock>

			<h2>Providers & Models</h2>
			<p>Switch providers and models on the fly:</p>
			<CodeBlock>{`otto ask "refactor this" --provider anthropic --model claude-sonnet-4
otto ask "explain generics" --provider openai --model gpt-4o`}</CodeBlock>

			<table>
				<thead>
					<tr>
						<th>Provider</th>
						<th>Models</th>
						<th>Auth</th>
					</tr>
				</thead>
				<tbody>
					<tr><td>Anthropic</td><td>Claude 4.5 Sonnet, Opus</td><td>API key</td></tr>
					<tr><td>OpenAI</td><td>GPT-4o, o1, Codex Mini</td><td>API key</td></tr>
					<tr><td>Google</td><td>Gemini 2.5 Pro, Flash</td><td>API key</td></tr>
					<tr><td>OpenRouter</td><td>100+ models</td><td>API key</td></tr>
					<tr><td>OpenCode</td><td>Free Anthropic access</td><td>OAuth</td></tr>
					<tr><td>Setu</td><td>Proxy with USDC payments</td><td>Solana wallet</td></tr>
				</tbody>
			</table>

			<h2>Agents</h2>
			<p>Use the <code>--agent</code> flag to select a purpose-built agent:</p>
			<CodeBlock>{`otto ask "create auth component" --agent build
otto ask "design API architecture" --agent plan
otto ask "research how this works" --agent research`}</CodeBlock>

			<h2>Sharing Sessions</h2>
			<CodeBlock>{`otto share <session-id>        # share a session publicly`}</CodeBlock>

			<h2>Upgrading</h2>
			<CodeBlock>{`otto upgrade                   # upgrade to latest version`}</CodeBlock>
		</div>
	);
}
