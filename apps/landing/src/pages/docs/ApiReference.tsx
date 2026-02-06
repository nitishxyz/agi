import { CodeBlock } from '../../components/CodeBlock';
export function ApiReference() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">API Reference</h1>
			<p className="text-otto-dim text-sm mb-8">
				REST endpoints and SSE streaming.
			</p>

			<h2>Overview</h2>
			<p>
				otto exposes a local HTTP API via Hono. The server supports both REST
				endpoints and Server-Sent Events (SSE) for streaming.
			</p>
			<p>
				Base URL: <code>http://localhost:{'<port>'}</code>
			</p>

			<h2>Ask (Streaming)</h2>
			<h3>POST /api/ask</h3>
			<p>Send a prompt and stream the response via SSE.</p>
			<CodeBlock>{`POST /api/ask
Content-Type: application/json

{
  "prompt": "explain this error",
  "sessionId": "optional-session-id",
  "agent": "build",
  "provider": "anthropic",
  "model": "claude-sonnet-4"
}`}</CodeBlock>
			<p>Returns an SSE stream with events:</p>
			<ul>
				<li>
					<code>text-delta</code> — text chunk
				</li>
				<li>
					<code>tool-call</code> — tool invocation
				</li>
				<li>
					<code>tool-result</code> — tool execution result
				</li>
				<li>
					<code>finish</code> — stream complete
				</li>
				<li>
					<code>error</code> — error occurred
				</li>
			</ul>

			<h2>Sessions</h2>

			<h3>GET /api/sessions</h3>
			<p>List all sessions.</p>
			<CodeBlock>{`GET /api/sessions?limit=20&offset=0`}</CodeBlock>

			<h3>GET /api/sessions/:id</h3>
			<p>Get a specific session with messages.</p>

			<h3>DELETE /api/sessions/:id</h3>
			<p>Delete a session.</p>

			<h2>Messages</h2>

			<h3>GET /api/sessions/:id/messages</h3>
			<p>Get messages for a session.</p>

			<h2>Configuration</h2>

			<h3>GET /api/config</h3>
			<p>Get current configuration.</p>

			<h3>GET /api/models</h3>
			<p>List available models for a provider.</p>

			<h3>GET /api/agents</h3>
			<p>List available agents.</p>

			<h2>Git</h2>

			<h3>GET /api/git/status</h3>
			<p>Get git status for the current working directory.</p>

			<h3>GET /api/git/diff</h3>
			<p>Get git diff.</p>

			<h2>Files</h2>

			<h3>GET /api/files</h3>
			<p>List files in a directory.</p>

			<h3>GET /api/files/:path</h3>
			<p>Read file contents.</p>

			<h2>Auth</h2>

			<h3>GET /api/auth/providers</h3>
			<p>List configured providers and their auth status.</p>

			<h2>Health</h2>

			<h3>GET /health</h3>
			<p>
				Health check endpoint. Returns <code>200 OK</code>.
			</p>

			<h2>OpenAPI</h2>
			<p>
				Full OpenAPI spec available at <code>/openapi.json</code>.
			</p>

			<h2>TypeScript Client</h2>
			<p>Use the generated type-safe client:</p>
			<CodeBlock>{`import { createClient } from "@ottocode/api";

const client = createClient({
  baseUrl: "http://localhost:9100",
});

const sessions = await client.getSessions();
const models = await client.getModels({ provider: "anthropic" });`}</CodeBlock>
		</div>
	);
}
