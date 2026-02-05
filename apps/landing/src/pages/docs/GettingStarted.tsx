import { CodeBlock } from "../../components/CodeBlock";
export function GettingStarted() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Getting Started</h1>
			<p className="text-otto-dim text-sm mb-8">Install otto and start coding with AI in under a minute.</p>

			<h2>Install</h2>

			<h3>Recommended: One-Liner</h3>
			<CodeBlock>{`curl -fsSL https://install.ottocode.io | sh`}</CodeBlock>
			<p>Detects your OS and architecture, downloads the prebuilt binary, and installs to <code>~/.local/bin</code>.</p>
			<p>Pin a specific version:</p>
			<CodeBlock>{`OTTO_VERSION=v0.1.175 curl -fsSL https://install.ottocode.io | sh`}</CodeBlock>

			<h3>Alternative: npm or Bun</h3>
			<CodeBlock>{`bun install -g @ottocode/install`}</CodeBlock>
			<p>The postinstall script downloads the correct binary for your platform.</p>
			<p><strong>Supported platforms:</strong> macOS (x64, ARM64), Linux (x64, ARM64)</p>

			<h3>From Source</h3>
			<p>Requires <a href="https://bun.sh">Bun</a> v1.0+.</p>
			<CodeBlock>{`git clone https://github.com/nitishxyz/otto.git
cd otto
bun install
bun run compile    # builds to dist/otto`}</CodeBlock>

			<h2>Setup</h2>

			<h3>1. Configure a Provider</h3>
			<CodeBlock>{`otto setup`}</CodeBlock>
			<p>Walks you through provider selection and authentication interactively.</p>
			<p>Or set API keys via environment variables:</p>
			<CodeBlock>{`export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."`}</CodeBlock>

			<h3>2. Start Using otto</h3>
			<CodeBlock>{`otto                           # start server + web UI (opens browser)
otto ask "explain this error"  # one-shot question
otto ask "write tests" --agent build
otto ask "follow up" --last    # continue last session`}</CodeBlock>

			<h3>3. Verify Installation</h3>
			<CodeBlock>{`otto --version                 # check version
otto doctor                    # check configuration
otto agents                    # list available agents
otto models                    # list available models`}</CodeBlock>

			<h2>How It Works</h2>
			<p>When you run <code>otto</code>, it:</p>
			<ol>
				<li>Checks if the desktop app is installed — if so, opens it</li>
				<li>Otherwise, starts a local HTTP server (API + web UI)</li>
				<li>Opens the web UI in your browser</li>
			</ol>
			<p>All AI interactions, session storage, and tool execution happen locally on your machine.</p>
			<p>For one-shot usage (<code>otto ask "question"</code>), it starts the server in the background, sends the prompt, streams the response, and exits.</p>

			<h2>Server Mode</h2>
			<CodeBlock>{`otto serve                     # start on a random port, open browser
otto serve --port 3000         # specific port
otto serve --network           # bind to 0.0.0.0 for LAN access
otto serve --no-open           # don't open browser`}</CodeBlock>
			<p>The server exposes:</p>
			<ul>
				<li><strong>API</strong> on the specified port (e.g., <code>http://localhost:3000</code>)</li>
				<li><strong>Web UI</strong> on port + 1 (e.g., <code>http://localhost:3001</code>)</li>
			</ul>

			<h2>Troubleshooting</h2>

			<h3><code>otto</code> not found after installation</h3>
			<CodeBlock>{`echo $PATH | tr ':' '\\n' | grep local

# If not present, add it:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc`}</CodeBlock>

			<h3>Provider authentication issues</h3>
			<CodeBlock>{`otto auth login                # reconfigure credentials
otto doctor                    # check what's configured`}</CodeBlock>

			<h3>Binary not executable</h3>
			<CodeBlock>{`chmod +x $(which otto)`}</CodeBlock>
		</div>
	);
}
