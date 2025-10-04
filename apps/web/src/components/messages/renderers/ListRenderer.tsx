import { ChevronDown, ChevronRight } from 'lucide-react';
import { File, Folder } from 'lucide-react';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function ListRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const entries = (result.entries as Array<unknown>) || [];
	const timeStr = formatDuration(toolDurationMs);

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 transition-colors hover:text-cyan-600 dark:hover:text-cyan-200"
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<span className="font-medium">ls</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70">
					{entries.length} {entries.length === 1 ? 'entry' : 'entries'}
				</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && (
				<div className="mt-2 ml-5 space-y-0.5 max-h-96 overflow-y-auto">
					{entries.map((entry, i) => {
						const e = entry as { name?: string; isDirectory?: boolean };
						return (
							<div
								key={i}
								className="flex items-center gap-1.5 text-xs font-mono text-foreground/80"
							>
								{e.isDirectory ? (
									<Folder className="h-3 w-3 text-blue-500" />
								) : (
									<File className="h-3 w-3 text-muted-foreground" />
								)}
								<span>{e.name}</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
