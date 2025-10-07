import { ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { DiffView } from './DiffView';
import { formatDuration } from './utils';

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
	const timeStr = formatDuration(toolDurationMs);

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 transition-colors hover:text-emerald-600 dark:hover:text-emerald-200 min-w-0 w-full"
			>
				<ChevronRight
					className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
				/>
				<span className="font-medium flex-shrink-0">write</span>
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				<span
					className="text-foreground/70 min-w-0 flex-shrink overflow-hidden"
					style={{
						direction: 'rtl',
						textAlign: 'left',
						unicodeBidi: 'plaintext',
					}}
					title={path}
				>
					{path}
				</span>
				<span className="text-muted-foreground/80 whitespace-nowrap flex-shrink-0">
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
