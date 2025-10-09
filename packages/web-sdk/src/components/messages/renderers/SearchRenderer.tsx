import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import type { RendererProps } from './types';
import { formatDuration } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function SearchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const matches = (result.matches as Array<unknown>) || [];
	const files = (result.files as Array<unknown>) || [];
	const timeStr = formatDuration(toolDurationMs);

	// Check for errors
	const hasError =
		contentJson.error ||
		(result &&
			typeof result === 'object' &&
			'ok' in result &&
			result.ok === false) ||
		(result && 'error' in result);
	const errorMessage =
		typeof contentJson.error === 'string'
			? contentJson.error
			: result &&
					typeof result === 'object' &&
					'error' in result &&
					typeof result.error === 'string'
				? result.error
				: null;
	const errorStack =
		result &&
		typeof result === 'object' &&
		'stack' in result &&
		typeof result.stack === 'string'
			? result.stack
			: undefined;

	// Determine what to show - matches for grep/ripgrep, files for glob
	const itemCount = matches.length > 0 ? matches.length : files.length;
	const itemLabel =
		matches.length > 0
			? matches.length === 1
				? 'match'
				: 'matches'
			: files.length === 1
				? 'file'
				: 'files';

	// Extract search term from args
	const searchTerm = (() => {
		const args = contentJson.args as Record<string, unknown> | undefined;
		if (args && typeof args === 'object') {
			if (typeof args.pattern === 'string') return args.pattern;
			if (typeof args.query === 'string') return args.query;
			if (typeof args.filePattern === 'string') return args.filePattern;
		}
		return '';
	})();

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className={`flex items-center gap-2 transition-colors ${
					hasError
						? 'text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200'
						: 'text-amber-700 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-200'
				}`}
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				{hasError && (
					<AlertCircle className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
				)}
				<span className="font-medium">search{hasError ? ' error' : ''}</span>
				{searchTerm && (
					<>
						<span className="text-muted-foreground/70">·</span>
						<span className="font-mono text-foreground/90 text-[11px]">
							"
							{searchTerm.length > 30
								? `${searchTerm.slice(0, 30)}…`
								: searchTerm}
							"
						</span>
					</>
				)}
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70">
					{itemCount} {itemLabel}
				</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && hasError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} stack={errorStack} showStack />
			)}
			{isExpanded && !hasError && matches.length > 0 && (
				<div className="mt-2 ml-5 space-y-1 max-h-96 overflow-y-auto">
					{matches.map((match, i) => {
						const m = match as { file?: string; line?: number; text?: string };
						return (
							<div
								key={`${m.file}-${m.line}-${i}`}
								className="text-xs font-mono bg-card/60 border border-border rounded px-2 py-1"
							>
								<div className="text-blue-600 dark:text-blue-400 truncate">
									{m.file}:{m.line}
								</div>
								<div className="text-foreground/80 truncate">{m.text}</div>
							</div>
						);
					})}
				</div>
			)}
			{isExpanded && !hasError && files.length > 0 && matches.length === 0 && (
				<div className="mt-2 ml-5 space-y-0.5 max-h-96 overflow-y-auto">
					{files.map((file) => (
						<div
							key={String(file)}
							className="text-xs font-mono text-foreground/70 truncate"
						>
							{String(file)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
