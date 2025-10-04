interface DiffViewProps {
	patch: string;
}

interface DiffLine {
	content: string;
	type: 'add' | 'remove' | 'context' | 'meta' | 'header';
	oldLineNum?: number;
	newLineNum?: number;
}

function parseDiff(patch: string): DiffLine[] {
	const lines = patch.split('\n');
	const result: DiffLine[] = [];
	let oldLineNum = 0;
	let newLineNum = 0;
	let inHunk = false;

	for (const line of lines) {
		// Parse hunk header to get starting line numbers
		// Format: @@ -oldStart,oldCount +newStart,newCount @@
		const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (hunkMatch) {
			oldLineNum = parseInt(hunkMatch[1], 10);
			newLineNum = parseInt(hunkMatch[2], 10);
			inHunk = true;
			result.push({
				content: line,
				type: 'header',
			});
			continue;
		}

		// Check if it's a diff metadata line
		if (
			line.startsWith('***') ||
			line.startsWith('diff ') ||
			line.startsWith('index ') ||
			line.startsWith('---') ||
			line.startsWith('+++')
		) {
			result.push({
				content: line,
				type: 'meta',
			});
			continue;
		}

		// Process actual diff lines
		if (inHunk) {
			if (line.startsWith('+')) {
				result.push({
					content: line,
					type: 'add',
					newLineNum: newLineNum++,
				});
			} else if (line.startsWith('-')) {
				result.push({
					content: line,
					type: 'remove',
					oldLineNum: oldLineNum++,
				});
			} else if (line.startsWith(' ') || line === '') {
				result.push({
					content: line,
					type: 'context',
					oldLineNum: oldLineNum++,
					newLineNum: newLineNum++,
				});
			} else {
				// Handle lines that don't start with +, -, or space (edge case)
				result.push({
					content: line,
					type: 'context',
				});
			}
		} else {
			// Lines before any hunk
			result.push({
				content: line,
				type: 'meta',
			});
		}
	}

	return result;
}

export function DiffView({ patch }: DiffViewProps) {
	const diffLines = parseDiff(patch);

	return (
		<div className="bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 max-w-full">
			<div className="overflow-x-auto overflow-y-auto max-h-96 text-xs font-mono">
				{diffLines.map((line, i) => {
					const key = `line-${i}-${line.content.slice(0, 20)}`;

					// For meta and header lines, span the full width without line numbers
					if (line.type === 'meta' || line.type === 'header') {
						return (
							<div
								key={key}
								className={`px-3 py-0.5 whitespace-pre-wrap break-all ${
									line.type === 'header'
										? 'text-muted-foreground/80 bg-muted/20'
										: 'text-muted-foreground/80'
								}`}
							>
								{line.content}
							</div>
						);
					}

					// For diff lines, show line numbers in gutter
					let lineClass = '';
					let bgClass = '';
					switch (line.type) {
						case 'add':
							lineClass = 'text-emerald-700 dark:text-emerald-300';
							bgClass = 'bg-emerald-500/10';
							break;
						case 'remove':
							lineClass = 'text-red-600 dark:text-red-300';
							bgClass = 'bg-red-500/10';
							break;
						default:
							lineClass = 'text-muted-foreground';
					}

					return (
						<div key={key} className={`flex ${bgClass}`}>
							{/* Old line number */}
							<div className="px-2 py-0.5 text-right text-muted-foreground/40 select-none w-12 flex-shrink-0">
								{line.oldLineNum || ''}
							</div>
							{/* New line number */}
							<div className="px-2 py-0.5 text-right text-muted-foreground/40 select-none w-12 flex-shrink-0 border-r border-border/50">
								{line.newLineNum || ''}
							</div>
							{/* Line content */}
							<div className={`px-3 py-0.5 flex-1 min-w-0 whitespace-pre-wrap break-all ${lineClass}`}>
								{line.content}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
