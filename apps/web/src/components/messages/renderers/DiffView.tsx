interface DiffViewProps {
	patch: string;
}

export function DiffView({ patch }: DiffViewProps) {
	const lines = patch.split('\n');

	return (
		<div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto max-h-96 text-xs font-mono">
			{lines.map((line, i) => {
				const key = `line-${i}-${line.slice(0, 20)}`;
				if (line.startsWith('+') && !line.startsWith('+++')) {
					return (
						<div key={key} className="text-green-400">
							{line}
						</div>
					);
				}
				if (line.startsWith('-') && !line.startsWith('---')) {
					return (
						<div key={key} className="text-red-400">
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
						<div key={key} className="text-zinc-600">
							{line}
						</div>
					);
				}
				return (
					<div key={key} className="text-zinc-400">
						{line}
					</div>
				);
			})}
		</div>
	);
}
