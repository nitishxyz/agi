import { ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';
import { DiffView } from './DiffView';
import { formatDuration } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function ApplyPatchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const artifact = contentJson.artifact;
	const timeStr = formatDuration(toolDurationMs);
	const summary = artifact?.summary || {};
	const files = Number(summary.files || 0);
	const additions = Number(summary.additions || 0);
	const deletions = Number(summary.deletions || 0);
	const patch = artifact?.patch ? String(artifact.patch) : '';

	// Check for errors
	const hasError =
		contentJson.error ||
		(contentJson.result &&
			'ok' in contentJson.result &&
			contentJson.result.ok === false);
	const errorMessage =
		typeof contentJson.error === 'string'
			? contentJson.error
			: contentJson.result &&
					'error' in contentJson.result &&
					typeof contentJson.result.error === 'string'
				? contentJson.result.error
				: null;
	const errorStack =
		contentJson.result &&
		typeof contentJson.result === 'object' &&
		'stack' in contentJson.result &&
		typeof contentJson.result.stack === 'string'
			? contentJson.result.stack
			: undefined;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className={`flex items-center gap-2 transition-colors w-full ${
					hasError
						? 'text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200'
						: 'text-purple-700 dark:text-purple-300 hover:text-purple-600 dark:hover:text-purple-200'
				}`}
			>
				<ChevronRight
					className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
				/>
				<span className="font-medium flex-shrink-0">
					apply patch{hasError ? ' error' : ''}
				</span>
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				<span className="text-foreground/70 flex-shrink-0">
					{files} {files === 1 ? 'file' : 'files'}
				</span>
				<span className="text-emerald-600 dark:text-emerald-400 flex-shrink-0">
					+{additions}
				</span>
				<span className="text-red-600 dark:text-red-400 flex-shrink-0">
					-{deletions}
				</span>
				<span className="text-muted-foreground/80 flex-shrink-0">
					· {timeStr}
				</span>
			</button>
			{isExpanded && hasError && errorMessage && (
				<div>
					<ToolErrorDisplay error={errorMessage} stack={errorStack} showStack />
					{patch && (
						<div className="mt-2 ml-5">
							<details>
								<summary className="cursor-pointer text-xs text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200">
									Show patch that failed
								</summary>
								<div className="mt-2">
									<DiffView patch={patch} />
								</div>
							</details>
						</div>
					)}
				</div>
			)}
			{isExpanded && !hasError && patch && (
				<div className="mt-2 ml-5">
					<DiffView patch={patch} />
				</div>
			)}
		</div>
	);
}
