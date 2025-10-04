import type { GitDiffResponse } from '../../types/api';

interface GitDiffViewerProps {
	diff: GitDiffResponse;
}

interface DiffLine {
	oldLineNumber: number | null;
	newLineNumber: number | null;
	content: string;
	type: 'header' | 'hunk' | 'add' | 'delete' | 'context' | 'meta';
}

export function GitDiffViewer({ diff }: GitDiffViewerProps) {
	// Parse the diff into lines with line numbers
	const lines = diff.diff.split('\n');
	const diffLines: DiffLine[] = [];

	let oldLineNum = 0;
	let newLineNum = 0;

	for (const line of lines) {
		if (line.startsWith('@@')) {
			// Parse hunk header to get starting line numbers
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			if (match) {
				oldLineNum = parseInt(match[1], 10);
				newLineNum = parseInt(match[2], 10);
			}
			diffLines.push({
				oldLineNumber: null,
				newLineNumber: null,
				content: line,
				type: 'hunk',
			});
		} else if (
			line.startsWith('diff') ||
			line.startsWith('index') ||
			line.startsWith('---') ||
			line.startsWith('+++')
		) {
			diffLines.push({
				oldLineNumber: null,
				newLineNumber: null,
				content: line,
				type: 'meta',
			});
		} else if (line.startsWith('+')) {
			diffLines.push({
				oldLineNumber: null,
				newLineNumber: newLineNum,
				content: line,
				type: 'add',
			});
			newLineNum++;
		} else if (line.startsWith('-')) {
			diffLines.push({
				oldLineNumber: oldLineNum,
				newLineNumber: null,
				content: line,
				type: 'delete',
			});
			oldLineNum++;
		} else {
			// Context line
			diffLines.push({
				oldLineNumber: oldLineNum,
				newLineNumber: newLineNum,
				content: line,
				type: 'context',
			});
			oldLineNum++;
			newLineNum++;
		}
	}

	// Render a single diff line
	const renderLine = (diffLine: DiffLine, index: number) => {
		let contentClassName =
			'flex-1 px-4 py-0.5 font-mono text-xs overflow-x-auto';
		let lineNumberClassName =
			'flex-shrink-0 w-20 px-2 py-0.5 text-xs font-mono text-muted-foreground select-none border-r border-border';

		if (diffLine.type === 'hunk') {
			contentClassName +=
				' bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold';
			lineNumberClassName += ' bg-blue-500/10';
		} else if (diffLine.type === 'add') {
			contentClassName += ' bg-green-500/10 text-green-700 dark:text-green-400';
			lineNumberClassName +=
				' bg-green-500/10 text-green-700 dark:text-green-400';
		} else if (diffLine.type === 'delete') {
			contentClassName += ' bg-red-500/10 text-red-600 dark:text-red-400';
			lineNumberClassName += ' bg-red-500/10 text-red-600 dark:text-red-400';
		} else if (diffLine.type === 'meta') {
			contentClassName += ' text-muted-foreground';
		} else {
			contentClassName += ' text-foreground/70';
		}

		const oldNum =
			diffLine.oldLineNumber !== null ? diffLine.oldLineNumber.toString() : '';
		const newNum =
			diffLine.newLineNumber !== null ? diffLine.newLineNumber.toString() : '';

		return (
			<div key={index} className="flex hover:bg-muted/20">
				<div className={lineNumberClassName}>
					<div className="flex justify-between gap-2">
						<span className="text-right w-8">{oldNum}</span>
						<span className="text-right w-8">{newNum}</span>
					</div>
				</div>
				<div className={contentClassName}>{diffLine.content || ' '}</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full bg-background">
			{/* Header - matches section headers in GitFileList (includes min-height for button alignment) */}
			<div className="px-4 py-2 bg-muted/50 flex items-center justify-between min-h-10">
				<span className="font-mono text-sm text-foreground">{diff.file}</span>
				<div className="flex items-center gap-3 text-xs">
					{diff.binary ? (
						<span className="text-muted-foreground">Binary file</span>
					) : (
						<>
							{diff.insertions > 0 && (
								<span className="text-green-600 dark:text-green-500">
									+{diff.insertions}
								</span>
							)}
							{diff.deletions > 0 && (
								<span className="text-red-600 dark:text-red-500">
									-{diff.deletions}
								</span>
							)}
							<span className="text-muted-foreground">{diff.language}</span>
						</>
					)}
				</div>
			</div>

			{/* Diff content */}
			<div className="flex-1 overflow-auto">
				{diff.binary ? (
					<div className="p-4 text-sm text-muted-foreground">
						Binary file - cannot display diff
					</div>
				) : diff.diff.trim() === '' ? (
					<div className="p-4 text-sm text-muted-foreground">
						No changes to display
					</div>
				) : (
					<div className="min-w-max">{diffLines.map(renderLine)}</div>
				)}
			</div>
		</div>
	);
}
