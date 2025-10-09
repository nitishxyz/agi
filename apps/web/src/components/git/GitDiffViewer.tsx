import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
	oneLight,
	vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { GitDiffResponse } from '../../types/api';

interface GitDiffViewerProps {
	diff: GitDiffResponse;
}

interface DiffLine {
	oldLineNumber: number | null;
	newLineNumber: number | null;
	content: string;
	codeContent: string; // Content without +/- prefix
	type: 'header' | 'hunk' | 'add' | 'delete' | 'context' | 'meta';
}

export function GitDiffViewer({ diff }: GitDiffViewerProps) {
	// Parse the diff into lines with line numbers
	const lines = diff.diff.split('\n');
	const diffLines: DiffLine[] = [];
	const syntaxTheme =
		typeof document !== 'undefined' &&
		document.documentElement.classList.contains('dark')
			? vscDarkPlus
			: oneLight;

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
				codeContent: line,
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
				codeContent: line,
				type: 'meta',
			});
		} else if (line.startsWith('+')) {
			diffLines.push({
				oldLineNumber: null,
				newLineNumber: newLineNum,
				content: line,
				codeContent: line.slice(1), // Remove + prefix for syntax highlighting
				type: 'add',
			});
			newLineNum++;
		} else if (line.startsWith('-')) {
			diffLines.push({
				oldLineNumber: oldLineNum,
				newLineNumber: null,
				content: line,
				codeContent: line.slice(1), // Remove - prefix for syntax highlighting
				type: 'delete',
			});
			oldLineNum++;
		} else {
			// Context line
			diffLines.push({
				oldLineNumber: oldLineNum,
				newLineNumber: newLineNum,
				content: line,
				codeContent: line,
				type: 'context',
			});
			oldLineNum++;
			newLineNum++;
		}
	}

	// Render a single diff line with syntax highlighting
	const renderLine = (diffLine: DiffLine, index: number) => {
		let rowClassName = 'flex hover:bg-muted/20';
		let lineNumberClassName =
			'flex-shrink-0 w-20 px-2 py-0.5 text-xs font-mono select-none border-r border-border';
		let contentClassName =
			'flex-1 px-4 py-0.5 font-mono text-xs overflow-x-auto';

		// Apply background colors for add/delete/hunk
		if (diffLine.type === 'hunk') {
			rowClassName += ' bg-blue-500/10';
			lineNumberClassName += ' text-blue-600 dark:text-blue-400';
			contentClassName += ' text-blue-600 dark:text-blue-400 font-semibold';
		} else if (diffLine.type === 'add') {
			rowClassName += ' bg-green-500/10';
			lineNumberClassName += ' text-green-700 dark:text-green-400';
			contentClassName += ' text-green-700 dark:text-green-400';
		} else if (diffLine.type === 'delete') {
			rowClassName += ' bg-red-500/10';
			lineNumberClassName += ' text-red-600 dark:text-red-400';
			contentClassName += ' text-red-600 dark:text-red-400';
		} else if (diffLine.type === 'meta') {
			contentClassName += ' text-muted-foreground';
			lineNumberClassName += ' text-muted-foreground';
		} else {
			contentClassName += ' text-foreground/80';
			lineNumberClassName += ' text-muted-foreground';
		}

		const oldNum =
			diffLine.oldLineNumber !== null ? diffLine.oldLineNumber.toString() : '';
		const newNum =
			diffLine.newLineNumber !== null ? diffLine.newLineNumber.toString() : '';

		// For code lines (not meta/hunk), apply syntax highlighting
		let renderedContent: React.ReactNode = diffLine.content || ' ';

		if (
			diffLine.type !== 'meta' &&
			diffLine.type !== 'hunk' &&
			diff.language !== 'plaintext' &&
			diffLine.codeContent.trim()
		) {
			renderedContent = (
				<SyntaxHighlighter
					language={diff.language}
					style={syntaxTheme}
					customStyle={{
						margin: 0,
						padding: 0,
						background: 'transparent',
						display: 'inline',
						fontSize: 'inherit',
						lineHeight: 'inherit',
					}}
					codeTagProps={{
						style: {
							fontFamily: 'inherit',
							background: 'transparent',
						},
					}}
					PreTag="span"
				>
					{diffLine.codeContent}
				</SyntaxHighlighter>
			);

			// Add back the +/- prefix if it was an add/delete
			if (diffLine.type === 'add') {
				renderedContent = (
					<>
						<span className="select-none">+</span>
						{renderedContent}
					</>
				);
			} else if (diffLine.type === 'delete') {
				renderedContent = (
					<>
						<span className="select-none">-</span>
						{renderedContent}
					</>
				);
			}
		}

		return (
			<div key={index} className={rowClassName}>
				<div className={lineNumberClassName}>
					<div className="flex justify-between gap-2">
						<span className="text-right w-8">{oldNum}</span>
						<span className="text-right w-8">{newNum}</span>
					</div>
				</div>
				<div className={contentClassName}>{renderedContent}</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full bg-background">
			{/* Header with full file path */}
			<div className="px-4 py-2 bg-muted/50 flex items-center justify-between min-h-10">
				<span className="font-mono text-sm text-foreground" title={diff.file}>
					{diff.file}
				</span>
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
