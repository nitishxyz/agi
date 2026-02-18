import { ChevronRight, AlertCircle, BookOpen } from 'lucide-react';
import type { RendererProps } from './types';
import { formatDuration } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function SkillRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
	compact,
}: RendererProps) {
	const result = contentJson.result || {};
	const timeStr = formatDuration(toolDurationMs);

	const hasToolError =
		typeof result === 'object' && 'ok' in result && result.ok === false;
	const errorMessage =
		hasToolError && 'error' in result && typeof result.error === 'string'
			? result.error
			: null;

	const name = (result as Record<string, unknown>).name as string | undefined;
	const description = (result as Record<string, unknown>).description as
		| string
		| undefined;
	const content = (result as Record<string, unknown>).content as
		| string
		| undefined;
	const scope = (result as Record<string, unknown>).scope as
		| string
		| undefined;

	const canExpand = !!content || hasToolError;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => canExpand && onToggle()}
				className={`flex items-center gap-2 transition-colors w-full min-w-0 ${
					hasToolError
						? 'text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200'
						: canExpand
							? 'text-violet-700 dark:text-violet-300 hover:text-violet-600 dark:hover:text-violet-200'
							: 'text-violet-700 dark:text-violet-300'
				}`}
			>
				{canExpand ? (
					<ChevronRight
						className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
					/>
				) : (
					<div className="w-3 flex-shrink-0" />
				)}
				{hasToolError && (
					<AlertCircle className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
				)}
				<BookOpen className="h-3 w-3 flex-shrink-0" />
				<span className="font-medium flex-shrink-0">
					skill{hasToolError ? ' error' : ''}
				</span>
				{name && !compact && (
					<>
						<span className="text-muted-foreground/70 flex-shrink-0">·</span>
						<span className="text-foreground/70 truncate">{name}</span>
					</>
				)}
				{scope && !compact && (
					<span className="text-muted-foreground/80 flex-shrink-0">
						· {scope}
					</span>
				)}
				{timeStr && !compact && (
					<span className="text-muted-foreground/80 flex-shrink-0">
						· {timeStr}
					</span>
				)}
			</button>
			{isExpanded && hasToolError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} />
			)}
			{isExpanded && !hasToolError && content && (
				<div className="mt-2 ml-5">
					{description && (
						<p className="text-muted-foreground mb-2 italic">{description}</p>
					)}
					<div className="bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
						<div className="p-3 whitespace-pre-wrap font-mono text-xs leading-relaxed">
							{content}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
