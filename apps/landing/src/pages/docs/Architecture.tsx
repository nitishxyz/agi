import { CodeBlock } from '../../components/CodeBlock';
export function Architecture() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Architecture</h1>
			<p className="text-otto-dim text-sm mb-8">
				Monorepo structure, packages, and infrastructure.
			</p>

			<h2>Overview</h2>
			<p>
				otto is a <strong>Bun workspace monorepo</strong> with 6 apps, 7
				packages, and SST infrastructure.
			</p>
			<ol>
				<li>
					<strong>CLI binary</strong> starts a local HTTP server (Hono) with an
					embedded web UI
				</li>
				<li>
					<strong>Server</strong> manages sessions, persists messages to SQLite,
					and streams AI responses via SSE
				</li>
				<li>
					<strong>SDK</strong> handles provider resolution, tool execution,
					agent prompts, and authentication
				</li>
				<li>
					<strong>Web UI</strong> (or desktop app) is a client that talks to the
					local server API
				</li>
			</ol>
			<p>
				The CLI binary is self-contained — built with{' '}
				<code>bun build --compile</code>, it bundles everything into a single
				executable.
			</p>

			<h2>Project Structure</h2>
			<CodeBlock>{`otto/
├── apps/
│   ├── cli/              # CLI binary (Commander, bun build --compile)
│   ├── web/              # Web UI (React + Vite + TanStack)
│   ├── desktop/          # Desktop app (Tauri v2)
│   ├── setu/             # AI provider proxy (Solana payments)
│   ├── preview-api/      # Session sharing API
│   └── preview-web/      # Public session viewer (Astro)
├── packages/
│   ├── sdk/              # Core SDK: tools, agents, auth, config
│   ├── server/           # HTTP API server (Hono)
│   ├── database/         # SQLite + Drizzle ORM
│   ├── api/              # Type-safe API client
│   ├── web-sdk/          # React components, hooks, stores
│   ├── web-ui/           # Pre-built static web UI assets
│   └── install/          # npm installer package
├── infra/                # SST infrastructure (AWS + Cloudflare)
├── tests/                # bun:test suites
└── scripts/              # Build and utility scripts`}</CodeBlock>

			<h2>Apps</h2>

			<h3>apps/cli</h3>
			<p>
				Main CLI application. Compiles to a self-contained binary (~61MB) via{' '}
				<code>bun build --compile</code>.
			</p>
			<ul>
				<li>
					<strong>Framework:</strong> Commander for argument parsing
				</li>
				<li>
					<strong>Dependencies:</strong> @ottocode/sdk, @ottocode/server,
					@ottocode/database
				</li>
			</ul>

			<h3>apps/web</h3>
			<p>Web UI client for the otto server.</p>
			<ul>
				<li>
					<strong>Stack:</strong> React 19, Vite, TanStack Router + Query,
					Tailwind CSS, Zustand
				</li>
				<li>
					<strong>Features:</strong> Real-time chat via SSE, session management,
					syntax highlighting
				</li>
			</ul>

			<h3>apps/desktop</h3>
			<p>Desktop application via Tauri v2. Embeds CLI binary and web UI.</p>
			<ul>
				<li>
					<strong>Platforms:</strong> macOS (dmg), Linux (deb), Windows
					(msi)
				</li>
			</ul>

			<h2>Packages</h2>

			<h3>@ottocode/sdk</h3>
			<p>Core SDK. Tree-shakable.</p>
			<ul>
				<li>
					<code>agent/</code> — Agent type definitions
				</li>
				<li>
					<code>auth/</code> — OAuth flows, wallet auth, API key management
				</li>
				<li>
					<code>config/</code> — Configuration loading, path resolution
				</li>
				<li>
					<code>core/</code> — Built-in tools (15+), streaming, terminal
					management
				</li>
				<li>
					<code>prompts/</code> — System prompts for agents and providers
				</li>
				<li>
					<code>providers/</code> — Provider catalog, client factories, model
					resolution
				</li>
			</ul>

			<h3>@ottocode/server</h3>
			<p>HTTP API server built on Hono.</p>
			<ul>
				<li>
					<strong>Routes:</strong> ask (SSE), sessions, messages, files, auth,
					git, terminals, config
				</li>
				<li>
					<strong>Exports:</strong> <code>createApp</code>,{' '}
					<code>createEmbeddedApp</code>, <code>createStandaloneApp</code>
				</li>
			</ul>

			<h3>@ottocode/database</h3>
			<p>SQLite persistence with Drizzle ORM.</p>
			<ul>
				<li>
					<strong>Schema:</strong> sessions, messages, messageParts, artifacts
				</li>
				<li>
					<strong>Features:</strong> Auto-migrations on startup
				</li>
			</ul>

			<h3>@ottocode/api</h3>
			<p>
				Type-safe API client generated from OpenAPI spec via{' '}
				<code>@hey-api/openapi-ts</code>.
			</p>

			<h3>@ottocode/web-sdk</h3>
			<p>
				Reusable React components, hooks, and Zustand stores for building otto
				web interfaces.
			</p>

			<h2>Dependency Graph</h2>
			<CodeBlock>{`Level 0 (no deps)    install, api, web-ui
Level 1              sdk (auth, config, providers, tools)
Level 2              database (depends on sdk)
Level 3              server (depends on sdk, database)
Level 4              web-sdk (depends on api, sdk)
Level 5              cli (depends on sdk, server, database)`}</CodeBlock>

			<h2>Infrastructure (SST)</h2>
			<p>
				All infra defined as code using SST with AWS and Cloudflare providers.
			</p>

			<table>
				<thead>
					<tr>
						<th>Resource</th>
						<th>Platform</th>
						<th>Domain</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Setu</td>
						<td>Cloudflare Worker</td>
						<td>setu.ottocode.io</td>
					</tr>
					<tr>
						<td>Preview API</td>
						<td>Cloudflare Worker + D1</td>
						<td>api.share.ottocode.io</td>
					</tr>
					<tr>
						<td>Preview Web</td>
						<td>AWS (Astro SSR)</td>
						<td>share.ottocode.io</td>
					</tr>
					<tr>
						<td>Install Script</td>
						<td>Cloudflare Worker</td>
						<td>install.ottocode.io</td>
					</tr>
				</tbody>
			</table>

			<h2>Tech Stack</h2>
			<table>
				<thead>
					<tr>
						<th>Layer</th>
						<th>Technology</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Runtime</td>
						<td>Bun</td>
					</tr>
					<tr>
						<td>AI</td>
						<td>AI SDK v6</td>
					</tr>
					<tr>
						<td>Server</td>
						<td>Hono</td>
					</tr>
					<tr>
						<td>Database</td>
						<td>SQLite + Drizzle ORM</td>
					</tr>
					<tr>
						<td>Web UI</td>
						<td>React 19, Vite, TanStack, Tailwind CSS, Zustand</td>
					</tr>
					<tr>
						<td>Desktop</td>
						<td>Tauri v2</td>
					</tr>
					<tr>
						<td>Infrastructure</td>
						<td>SST (AWS + Cloudflare)</td>
					</tr>
					<tr>
						<td>Linting</td>
						<td>Biome</td>
					</tr>
					<tr>
						<td>Testing</td>
						<td>bun:test</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
