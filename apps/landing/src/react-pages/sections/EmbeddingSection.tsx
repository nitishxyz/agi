import { Reveal } from '../../components/Reveal';
import { TerminalBlock } from '../../components/TerminalBlock';

export function EmbeddingSection() {
	return (
		<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
			<div className="max-w-[900px] mx-auto">
				<Reveal>
					<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">
						Embedding
					</p>
					<h2 className="text-2xl sm:text-3xl font-bold mb-4 max-w-sm">
						Embed in minutes
					</h2>
					<p className="text-otto-muted text-sm mb-10 max-w-md">
						Full SDK with provider switching, tool execution, and streaming.
					</p>
				</Reveal>

				<Reveal delay={100}>
					<TerminalBlock
						title="server.ts"
						copyText={
							'import { createEmbeddedApp } from "@ottocode/server";\n\nconst app = createEmbeddedApp({\n  provider: "anthropic",\n  model: "claude-sonnet-4",\n  apiKey: process.env.ANTHROPIC_API_KEY,\n  agent: "build",\n});'
						}
					>
						<span className="text-purple-700 dark:text-purple-400">import</span>
						<span className="text-otto-text"> {'{ createEmbeddedApp }'} </span>
						<span className="text-purple-700 dark:text-purple-400">from</span>
						<span className="text-green-700 dark:text-green-400">
							{' '}
							"@ottocode/server"
						</span>
						<span className="text-otto-dim">;</span>
						<br />
						<br />
						<span className="text-purple-700 dark:text-purple-400">const</span>
						<span className="text-blue-700 dark:text-blue-400"> app </span>
						<span className="text-otto-text">= </span>
						<span className="text-yellow-700 dark:text-yellow-300">
							createEmbeddedApp
						</span>
						<span className="text-otto-text">({'{'}</span>
						<br />
						<span className="text-otto-text">{'  '}provider: </span>
						<span className="text-green-700 dark:text-green-400">
							"anthropic"
						</span>
						<span className="text-otto-dim">,</span>
						<br />
						<span className="text-otto-text">{'  '}model: </span>
						<span className="text-green-700 dark:text-green-400">
							"claude-sonnet-4"
						</span>
						<span className="text-otto-dim">,</span>
						<br />
						<span className="text-otto-text">{'  '}apiKey: process.env.</span>
						<span className="text-blue-700 dark:text-blue-400">
							ANTHROPIC_API_KEY
						</span>
						<span className="text-otto-dim">,</span>
						<br />
						<span className="text-otto-text">{'  '}agent: </span>
						<span className="text-green-700 dark:text-green-400">"build"</span>
						<span className="text-otto-dim">,</span>
						<br />
						<span className="text-otto-text">{'}'});</span>
					</TerminalBlock>
				</Reveal>
			</div>
		</section>
	);
}
