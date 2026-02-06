import { Reveal } from '../../components/Reveal';
import { TerminalBlock } from '../../components/TerminalBlock';

export function ArchitectureSection() {
	return (
		<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
			<div className="max-w-[900px] mx-auto">
				<Reveal>
					<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">
						Architecture
					</p>
					<h2 className="text-2xl sm:text-3xl font-bold mb-4 max-w-sm">
						Clean layers
					</h2>
					<p className="text-otto-muted text-sm mb-10 max-w-md">
						Bun workspace monorepo. 6 apps, 7 packages. SST infrastructure.
					</p>
				</Reveal>

				<Reveal delay={100}>
					<TerminalBlock
						title="dependency graph"
						copyText="L0  install — zero deps
L1  sdk — auth, config, providers, tools
L2  database → sdk
L3  server → sdk, database
L4  web-sdk → api, sdk
L5  cli → sdk, server, database"
					>
						<div className="space-y-0.5">
							<div>
								<span className="text-otto-dim">L0</span>
								<span className="text-otto-muted"> install, api, web-ui</span>
							</div>
							<div>
								<span className="text-otto-dim">L1</span>
								<span className="text-blue-700 dark:text-blue-400"> sdk</span>
								<span className="text-otto-dim">
									{' '}
									— auth, config, providers, tools
								</span>
							</div>
							<div>
								<span className="text-otto-dim">L2</span>
								<span className="text-green-700 dark:text-green-400">
									{' '}
									database
								</span>
								<span className="text-otto-dim"> → sdk</span>
							</div>
							<div>
								<span className="text-otto-dim">L3</span>
								<span className="text-yellow-400"> server</span>
								<span className="text-otto-dim"> → sdk, database</span>
							</div>
							<div>
								<span className="text-otto-dim">L4</span>
								<span className="text-purple-700 dark:text-purple-400">
									{' '}
									web-sdk
								</span>
								<span className="text-otto-dim"> → api, sdk</span>
							</div>
							<div>
								<span className="text-otto-dim">L5</span>
								<span className="text-red-700 dark:text-red-400"> cli</span>
								<span className="text-otto-dim"> → sdk, server, database</span>
							</div>
						</div>
					</TerminalBlock>
				</Reveal>
			</div>
		</section>
	);
}
