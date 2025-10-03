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
				className={`flex items-center gap-2 text-purple-700 dark:text-purple-300 transition-colors ${patch ? 'hover:text-purple-600 dark:hover:text-purple-200' : ''}`}
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
						<span className="text-muted-foreground/70">·</span>
						<span className="text-muted-foreground">{summary.files || 0} files</span>
						{(summary.additions || 0) > 0 && (
							<span className="text-emerald-700 dark:text-emerald-300">+{summary.additions}</span>
						)}
						{(summary.deletions || 0) > 0 && (
							<span className="text-red-600 dark:text-red-300">-{summary.deletions}</span>
						)}
					</>
				)}
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && patch && (
				<div className="mt-2 ml-5">
					<DiffView patch={patch} />
				</div>
			)}
		</div>
	);
}
