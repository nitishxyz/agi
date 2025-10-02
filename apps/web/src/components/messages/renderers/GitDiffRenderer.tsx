import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { DiffView } from './DiffView';

export function GitDiffRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const patch = String(result.patch || '');
	const all = result.all === true;
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => patch && onToggle()}
				className={`flex items-center gap-2 text-purple-400 ${patch ? 'hover:text-purple-300 transition-colors' : ''}`}
			>
				{patch &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!patch && <div className="w-3" />}
				<span className="font-medium">git_diff</span>
				<span className="text-zinc-500">·</span>
				<span className="text-zinc-400">{all ? 'all' : 'staged'}</span>
				<span className="text-zinc-600">· {timeStr}</span>
			</button>
			{isExpanded && patch && (
				<div className="mt-2 ml-5">
					<DiffView patch={patch} />
				</div>
			)}
		</div>
	);
}
