import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function TreeRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const tree = String(result.tree || '');
	const path = String(result.path || '.');
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => tree && onToggle()}
				className={`flex items-center gap-2 text-cyan-700 dark:text-cyan-300 transition-colors ${tree ? 'hover:text-cyan-600 dark:hover:text-cyan-200' : ''}`}
			>
				{tree &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!tree && <div className="w-3" />}
				<span className="font-medium">tree</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70 truncate max-w-xs">{path}</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && tree && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-w-full">
					<pre className="text-xs text-muted-foreground p-3 overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
						{tree}
					</pre>
				</div>
			)}
		</div>
	);
}
