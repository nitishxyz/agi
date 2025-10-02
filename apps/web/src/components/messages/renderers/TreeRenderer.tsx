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
				className={`flex items-center gap-2 text-cyan-400 ${tree ? 'hover:text-cyan-300 transition-colors' : ''}`}
			>
				{tree &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!tree && <div className="w-3" />}
				<span className="font-medium">tree</span>
				<span className="text-zinc-500">·</span>
				<span className="text-zinc-300">{path}</span>
				<span className="text-zinc-600">· {timeStr}</span>
			</button>
			{isExpanded && tree && (
				<pre className="mt-2 ml-5 text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto max-h-96 text-xs">
					{tree}
				</pre>
			)}
		</div>
	);
}
