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
				className={`flex items-center gap-2 text-cyan-700 dark:text-cyan-300 transition-colors ${entries.length > 0 ? 'hover:text-cyan-600 dark:hover:text-cyan-200' : ''}`}
			>
				{entries.length > 0 &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{entries.length === 0 && <div className="w-3" />}
				<span className="font-medium">ls</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70 truncate max-w-xs">{path}</span>
				<span className="text-muted-foreground/80">
					· {entries.length} items · {timeStr}
				</span>
			</button>
			{isExpanded && entries.length > 0 && (
				<div className="mt-2 ml-5 space-y-0.5 max-w-full overflow-hidden">
					{entries.slice(0, 50).map((e) => (
						<div
							key={`${e.name}-${e.type}`}
							className="text-muted-foreground truncate"
						>
							{e.type === 'dir' ? '📁' : '📄'} {e.name}
						</div>
					))}
					{entries.length > 50 && (
						<div className="text-muted-foreground/80">
							... and {entries.length - 50} more
						</div>
					)}
				</div>
			)}
		</div>
	);
}
