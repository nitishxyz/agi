import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function ListRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const entries = (result.entries || []) as Array<{
		name: string;
		type: string;
	}>;
	const path = String(result.path || '.');
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => entries.length > 0 && onToggle()}
				className={`flex items-center gap-2 text-cyan-400 ${entries.length > 0 ? 'hover:text-cyan-300 transition-colors' : ''}`}
			>
				{entries.length > 0 &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{entries.length === 0 && <div className="w-3" />}
				<span className="font-medium">ls</span>
				<span className="text-zinc-500">·</span>
				<span className="text-zinc-300">{path}</span>
				<span className="text-zinc-600">
					· {entries.length} items · {timeStr}
				</span>
			</button>
			{isExpanded && entries.length > 0 && (
				<div className="mt-2 ml-5 space-y-0.5">
					{entries.slice(0, 50).map((e) => (
						<div key={`${e.name}-${e.type}`} className="text-zinc-400">
							{e.type === 'dir' ? '📁' : '📄'} {e.name}
						</div>
					))}
					{entries.length > 50 && (
						<div className="text-zinc-600">
							... and {entries.length - 50} more
						</div>
					)}
				</div>
			)}
		</div>
	);
}
