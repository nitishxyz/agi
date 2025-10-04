import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function SearchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const matches = (result.matches as Array<unknown>) || [];
	const timeStr = formatDuration(toolDurationMs);

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-amber-700 dark:text-amber-300 transition-colors hover:text-amber-600 dark:hover:text-amber-200"
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<span className="font-medium">search</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70">
					{matches.length} {matches.length === 1 ? 'match' : 'matches'}
				</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && (
				<div className="mt-2 ml-5 space-y-1 max-h-96 overflow-y-auto">
					{matches.map((match, i) => {
						const m = match as { file?: string; line?: number; text?: string };
						return (
							<div
								key={i}
								className="text-xs font-mono bg-card/60 border border-border rounded px-2 py-1"
							>
								<div className="text-blue-600 dark:text-blue-400 truncate">
									{m.file}:{m.line}
								</div>
								<div className="text-foreground/80 truncate">{m.text}</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
