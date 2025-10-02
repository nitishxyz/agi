import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { DiffView } from './DiffView';

export function ApplyPatchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const artifact = contentJson.artifact;
	const patch = artifact?.patch ? String(artifact.patch) : '';
	const summary = artifact?.summary;
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
				<span className="font-medium">apply_patch</span>
				{summary && (
					<>
						<span className="text-zinc-500">·</span>
						<span className="text-zinc-400">{summary.files || 0} files</span>
						{(summary.additions || 0) > 0 && (
							<span className="text-green-400">+{summary.additions}</span>
						)}
						{(summary.deletions || 0) > 0 && (
							<span className="text-red-400">-{summary.deletions}</span>
						)}
					</>
				)}
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
