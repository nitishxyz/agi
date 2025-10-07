import { ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { DiffView } from './DiffView';
import { formatDuration } from './utils';

export function GitDiffRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const patch = String(result.patch || result.diff || '');
	const all = result.all;
	const timeStr = formatDuration(toolDurationMs);

	// Count files, additions, and deletions from patch
	const lines = patch.split('\n');
	let files = 0;
	let additions = 0;
	let deletions = 0;
	for (const line of lines) {
		if (line.startsWith('diff --git')) files += 1;
		else if (line.startsWith('+') && !line.startsWith('+++')) additions += 1;
		else if (line.startsWith('-') && !line.startsWith('---')) deletions += 1;
	}

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-purple-700 dark:text-purple-300 transition-colors hover:text-purple-600 dark:hover:text-purple-200 w-full"
			>
				<ChevronRight
					className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
				/>
				<span className="font-medium flex-shrink-0">git diff</span>
				{all && (
					<span className="text-xs text-muted-foreground/60 flex-shrink-0">
						(all)
					</span>
				)}
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				{files > 0 && (
					<>
						<span className="text-foreground/70 flex-shrink-0">
							{files} {files === 1 ? 'file' : 'files'}
						</span>
						{additions > 0 && (
							<span className="text-emerald-600 dark:text-emerald-400 flex-shrink-0">
								+{additions}
							</span>
						)}
						{deletions > 0 && (
							<span className="text-red-600 dark:text-red-400 flex-shrink-0">
								-{deletions}
							</span>
						)}
					</>
				)}
				<span className="text-muted-foreground/80 flex-shrink-0">
					· {timeStr}
				</span>
			</button>
			{isExpanded && patch && (
				<div className="mt-2 ml-5">
					<DiffView patch={patch} />
				</div>
			)}
		</div>
	);
}
