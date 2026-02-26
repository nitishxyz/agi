import { Reveal } from '../../components/Reveal';

const TECH = [
	'Bun',
	'TypeScript',
	'AI SDK',
	'Hono',
	'SQLite',
	'Drizzle',
	'React',
	'Vite',
	'TanStack',
	'Tailwind',
	'Tauri v2',
	'SST',
	'Biome',
];

export function StackSection() {
	return (
		<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
			<div className="max-w-[1100px] mx-auto">
				<Reveal>
					<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">
						Stack
					</p>
					<h2 className="text-2xl sm:text-3xl font-bold mb-12">Built with</h2>
				</Reveal>

				<Reveal delay={80}>
					<div className="flex flex-wrap gap-2">
						{TECH.map((t) => (
							<span
								key={t}
								className="px-3 py-1.5 text-xs text-otto-muted bg-otto-surface border border-otto-border rounded"
							>
								{t}
							</span>
						))}
					</div>
				</Reveal>
			</div>
		</section>
	);
}
