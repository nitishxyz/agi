interface DiffViewProps {
	patch: string;
}

export function DiffView({ patch }: DiffViewProps) {
	const lines = patch.split('\n');

	return (
		<div className="bg-card/60 border border-border rounded-lg p-3 overflow-x-auto max-h-96 text-xs font-mono">
			{lines.map((line, i) => {
				const key = `line-${i}-${line.slice(0, 20)}`;
				if (line.startsWith('+') && !line.startsWith('+++')) {
					return (
						<div key={key} className="text-emerald-700 dark:text-emerald-300">
							{line}
						</div>
					);
				}
				if (line.startsWith('-') && !line.startsWith('---')) {
					return (
						<div key={key} className="text-red-600 dark:text-red-300">
							{line}
						</div>
					);
				}
				if (
					line.startsWith('***') ||
					line.startsWith('diff ') ||
					line.startsWith('index ') ||
					line.startsWith('---') ||
					line.startsWith('+++') ||
					line.startsWith('@@ ')
				) {
					return (
						<div key={key} className="text-muted-foreground/80">
							{line}
						</div>
					);
				}
				return (
					<div key={key} className="text-muted-foreground">
						{line}
					</div>
				);
			})}
		</div>
	);
}
