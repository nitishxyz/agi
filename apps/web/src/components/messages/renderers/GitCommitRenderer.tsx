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
				className={`flex items-center gap-2 text-emerald-400 ${commitResult ? 'hover:text-emerald-300 transition-colors' : ''}`}
			>
				{commitResult &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!commitResult && <div className="w-3" />}
				<span className="font-medium">git_commit</span>
				<span className="text-zinc-500">·</span>
				<span className="text-zinc-300 truncate max-w-2xl">{firstLine}</span>
				<span className="text-zinc-600 flex-shrink-0">· {timeStr}</span>
			</button>
			{isExpanded && commitResult && (
				<pre className="mt-2 ml-5 text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto text-xs">
					{commitResult}
				</pre>
			)}
		</div>
	);
}
