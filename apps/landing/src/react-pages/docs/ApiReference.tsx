import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';

export function ApiReference() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">API Reference</h1>
			<p className="text-otto-dim text-sm mb-8">
				Versioned HTTP routes, generated OpenAPI, and SSE streaming.
			</p>

			<h2>Source of truth</h2>
			<p>Use these in order:</p>
			<ol>
				<li>
					<code>packages/api/openapi.json</code>
				</li>
				<li>
					<code>GET /openapi.json</code>
				</li>
				<li>
					<code>@ottocode/api</code>
				</li>
			</ol>
			<p>
				Operational routes live under <code>/v1/*</code>.
			</p>

			<h2>Base routes</h2>
			<ul>
				<li>
					<code>GET /</code> — root response
				</li>
				<li>
					<code>GET /openapi.json</code> — generated OpenAPI spec
				</li>
				<li>
					<code>GET /v1/server/info</code> — server/runtime metadata
				</li>
			</ul>

			<h2>Current route groups</h2>
			<p>
				The generated spec currently includes groups such as <code>ask</code>,{' '}
				<code>auth</code>, <code>config</code>, <code>doctor</code>,{' '}
				<code>files</code>, <code>git</code>, <code>mcp</code>,{' '}
				<code>provider-usage</code>, <code>research</code>,{' '}
				<code>sessions</code>, <code>setu</code>, <code>shares</code>,{' '}
				<code>skills</code>, <code>terminals</code>, and <code>tunnel</code>.
			</p>

			<h2>Representative routes</h2>

			<h3>Ask</h3>
			<CodeBlock>{`POST /v1/ask
Content-Type: application/json

{
  "prompt": "explain this error",
  "sessionId": "optional-session-id",
  "agent": "build",
  "provider": "anthropic",
  "model": "claude-sonnet-4"
}`}</CodeBlock>

			<h3>Sessions</h3>
			<ul>
				<li>
					<code>GET /v1/sessions</code>
				</li>
				<li>
					<code>POST /v1/sessions</code>
				</li>
				<li>
					<code>GET /v1/sessions/{'{sessionId}'}</code>
				</li>
				<li>
					<code>POST /v1/sessions/{'{id}'}/messages</code>
				</li>
				<li>
					<code>GET /v1/sessions/{'{id}'}/stream</code>
				</li>
			</ul>

			<h3>Config</h3>
			<ul>
				<li>
					<code>GET /v1/config</code>
				</li>
				<li>
					<code>GET /v1/config/defaults</code>
				</li>
				<li>
					<code>GET /v1/config/providers</code>
				</li>
				<li>
					<code>GET /v1/config/models</code>
				</li>
				<li>
					<code>GET /v1/config/agents</code>
				</li>
			</ul>

			<h3>Files</h3>
			<ul>
				<li>
					<code>GET /v1/files</code>
				</li>
				<li>
					<code>POST /v1/files/read</code>
				</li>
				<li>
					<code>POST /v1/files/tree</code>
				</li>
			</ul>

			<h3>Git</h3>
			<ul>
				<li>
					<code>GET /v1/git/status</code>
				</li>
				<li>
					<code>POST /v1/git/diff</code>
				</li>
				<li>
					<code>POST /v1/git/commit</code>
				</li>
			</ul>

			<h3>Skills</h3>
			<ul>
				<li>
					<code>GET /v1/skills</code>
				</li>
				<li>
					<code>GET /v1/skills/{'{name}'}</code>
				</li>
				<li>
					<code>POST /v1/skills/validate</code>
				</li>
			</ul>

			<h2>SSE streaming</h2>
			<p>
				Streaming is used for ask/session workflows, especially{' '}
				<code>GET /v1/sessions/{'{id}'}/stream</code>.
			</p>
			<p>Common event types include:</p>
			<ul>
				<li>
					<code>assistant.delta</code>
				</li>
				<li>
					<code>assistant</code>
				</li>
				<li>
					<code>tool.call</code>
				</li>
				<li>
					<code>tool.result</code>
				</li>
				<li>
					<code>tool.approval.required</code>
				</li>
				<li>
					<code>finish-step</code>
				</li>
				<li>
					<code>usage</code>
				</li>
				<li>
					<code>error</code>
				</li>
			</ul>

			<h2>Updating the API contract</h2>
			<ol>
				<li>
					Add/update routes in <code>packages/server/src/routes/</code>
				</li>
				<li>
					Update <code>packages/server/src/openapi/spec.ts</code>
				</li>
				<li>
					Regenerate the API package with{' '}
					<code>bun run --filter @ottocode/api generate</code>
				</li>
				<li>
					Use the regenerated methods from <code>@ottocode/api</code>
				</li>
			</ol>

			<h2>Type-safe client</h2>
			<CodeBlock>{`import { ask, client, listSessions } from "@ottocode/api";

client.setConfig({
  baseURL: "http://localhost:3000",
});

const response = await ask({
  body: {
    prompt: "Hello, AI!",
    agent: "build",
  },
});

const sessions = await listSessions();`}</CodeBlock>
		</DocPage>
	);
}
