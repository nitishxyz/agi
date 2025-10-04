import type { RendererProps } from './types';
import { DiffView } from './DiffView';
import { formatDuration } from './utils';

export function EditRenderer({ contentJson, toolDurationMs }: RendererProps) {
	const artifact = contentJson.artifact;
	const timeStr = formatDuration(toolDurationMs);
	const summary = artifact?.summary || {};
	const files = Number(summary.files || 0);
	const additions = Number(summary.additions || 0);
	const deletions = Number(summary.deletions || 0);
	const patch = artifact?.patch ? String(artifact.patch) : '';

	return (
		<div className="text-xs space-y-2">
			<div className="flex items-center gap-2">
				<span className="font-medium text-purple-700 dark:text-purple-300">
					edit
				</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70">
					{files} {files === 1 ? 'file' : 'files'}
				</span>
				<span className="text-emerald-600 dark:text-emerald-400">
					+{additions}
				</span>
				<span className="text-red-600 dark:text-red-400">-{deletions}</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</div>
			{patch && <DiffView patch={patch} />}
		</div>
	);
}
