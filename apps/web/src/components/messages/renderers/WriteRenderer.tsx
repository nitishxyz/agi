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
				className={`flex items-center gap-2 text-green-400 ${patch ? 'hover:text-green-300 transition-colors' : ''}`}
			>
				{patch &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!patch && <div className="w-3" />}
				<span className="font-medium">write</span>
				<span className="text-zinc-500">·</span>
				<span className="text-zinc-300">{path}</span>
				<span className="text-zinc-600">
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
