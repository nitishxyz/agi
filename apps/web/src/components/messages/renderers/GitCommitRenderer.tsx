import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function GitCommitRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const commitResult = String(result.result || result.output || '');
	const firstLine = commitResult.split('\n')[0] || 'committed';
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => commitResult && onToggle()}
				className={`flex items-center gap-2 text-emerald-700 dark:text-emerald-300 transition-colors ${commitResult ? 'hover:text-emerald-600 dark:hover:text-emerald-200' : ''}`}
			>
				{commitResult &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!commitResult && <div className="w-3" />}
				<span className="font-medium">git_commit</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70 truncate max-w-2xl">
					{firstLine}
				</span>
				<span className="text-muted-foreground/80 flex-shrink-0">
					· {timeStr}
				</span>
			</button>
			{isExpanded && commitResult && (
				<pre className="mt-2 ml-5 text-xs text-muted-foreground bg-card/60 border border-border rounded-lg p-3 overflow-x-auto">
					{commitResult}
				</pre>
			)}
		</div>
	);
}
