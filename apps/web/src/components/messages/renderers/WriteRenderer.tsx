import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { DiffView } from './DiffView';

export function WriteRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const artifact = contentJson.artifact;
	const path = String(result.path || '');
	const bytes = Number(result.bytes || 0);
	const patch = artifact?.patch ? String(artifact.patch) : '';
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => patch && onToggle()}
				className={`flex items-center gap-2 text-emerald-700 dark:text-emerald-300 transition-colors ${patch ? 'hover:text-emerald-600 dark:hover:text-emerald-200' : ''}`}
			>
				{patch &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!patch && <div className="w-3" />}
				<span className="font-medium">write</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70">{path}</span>
				<span className="text-muted-foreground/80">
					· {bytes} bytes · {timeStr}
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
