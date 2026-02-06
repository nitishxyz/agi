import { CodeBlock } from '../../components/CodeBlock';
export function Embedding() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Embedding Guide</h1>
			<p className="text-otto-dim text-sm mb-8">
				Use otto as a library in your own applications.
			</p>

			<h2>Quick Start</h2>
			<p>
				The simplest way to embed otto is with <code>createEmbeddedApp</code>:
			</p>
			<CodeBlock>{`import { createEmbeddedApp } from "@ottocode/server";

const app = createEmbeddedApp({
  provider: "anthropic",
  model: "claude-sonnet-4",
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: "build",
});

Bun.serve({
  port: 9100,
  fetch: app.fetch,
  idleTimeout: 240,
});`}</CodeBlock>

			<h2>Using the SDK Directly</h2>
			<CodeBlock>{`import {
  generateText,
  resolveModel,
  discoverProjectTools,
} from "@ottocode/sdk";

const model = await resolveModel("anthropic", "claude-sonnet-4");
const tools = await discoverProjectTools(process.cwd());

const result = await generateText({
  model,
  prompt: "List all TypeScript files and count lines",
  tools: Object.fromEntries(
    tools.map((t) => [t.name, t.tool])
  ),
  maxSteps: 10,
});`}</CodeBlock>

			<h2>Embedded App Options</h2>
			<table>
				<thead>
					<tr>
						<th>Option</th>
						<th>Type</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>provider</code>
						</td>
						<td>string</td>
						<td>AI provider name</td>
					</tr>
					<tr>
						<td>
							<code>model</code>
						</td>
						<td>string</td>
						<td>Model identifier</td>
					</tr>
					<tr>
						<td>
							<code>apiKey</code>
						</td>
						<td>string</td>
						<td>Provider API key</td>
					</tr>
					<tr>
						<td>
							<code>agent</code>
						</td>
						<td>string</td>
						<td>Agent to use (build, plan, general, research)</td>
					</tr>
				</tbody>
			</table>

			<h2>Multi-Provider Auth</h2>
			<p>Pass multiple provider keys for provider switching:</p>
			<CodeBlock>{`const app = createEmbeddedApp({
  provider: "anthropic",
  model: "claude-sonnet-4",
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: "build",
  // Additional providers available for switching
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY },
  },
});`}</CodeBlock>

			<h2>Custom Agents</h2>
			<p>Define custom agents when embedding:</p>
			<CodeBlock>{`const app = createEmbeddedApp({
  provider: "anthropic",
  model: "claude-sonnet-4",
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: "custom",
  agents: {
    custom: {
      tools: ["read", "write", "bash", "ripgrep"],
      prompt: "You are a specialized code reviewer...",
    },
  },
});`}</CodeBlock>

			<h2>Serving the Web UI</h2>
			<p>The embedded app can also serve the built-in web UI:</p>
			<CodeBlock>{`import { createStandaloneApp } from "@ottocode/server";

// Includes web UI serving + API
const app = createStandaloneApp({
  provider: "anthropic",
  model: "claude-sonnet-4",
  apiKey: process.env.ANTHROPIC_API_KEY,
});`}</CodeBlock>

			<h2>CORS Configuration</h2>
			<p>For cross-origin requests, configure CORS:</p>
			<CodeBlock>{`const app = createEmbeddedApp({
  // ... provider config
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});`}</CodeBlock>

			<h2>Packages</h2>
			<table>
				<thead>
					<tr>
						<th>Package</th>
						<th>Use Case</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>@ottocode/server</code>
						</td>
						<td>Full HTTP server with routes, SSE streaming, agent runtime</td>
					</tr>
					<tr>
						<td>
							<code>@ottocode/sdk</code>
						</td>
						<td>Core SDK: tools, agents, auth, config, providers</td>
					</tr>
					<tr>
						<td>
							<code>@ottocode/api</code>
						</td>
						<td>Type-safe API client for consuming otto server</td>
					</tr>
					<tr>
						<td>
							<code>@ottocode/web-sdk</code>
						</td>
						<td>React components and hooks for building UIs</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
