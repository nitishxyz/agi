import type { RendererProps } from './types';
import { formatDuration, isToolError, getErrorMessage } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';
import {
	ToolHeader,
	ToolHeaderSeparator,
	ToolHeaderDetail,
	ToolHeaderMeta,
} from './shared';

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

	const hasError = isToolError(result) || !!contentJson.error;
	const errorMessage =
		getErrorMessage(result) ||
		(typeof contentJson.error === 'string' ? contentJson.error : null);
	const errorStack =
		result && typeof result === 'object' && 'stack' in result
			? String(result.stack)
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

	const canExpand = itemCount > 0 || hasError;

	return (
		<div className="text-xs">
			<ToolHeader
				toolName="search"
				isExpanded={isExpanded}
				onToggle={onToggle}
				isError={hasError}
				colorVariant="amber"
				canExpand={canExpand}
			>
				{searchTerm && (
					<>
						<ToolHeaderSeparator />
						<span className="font-mono text-foreground/90 text-[11px]">
							"
							{searchTerm.length > 30
								? `${searchTerm.slice(0, 30)}…`
								: searchTerm}
							"
						</span>
					</>
				)}
				<ToolHeaderSeparator />
				<ToolHeaderDetail>
					{itemCount} {itemLabel}
				</ToolHeaderDetail>
				<ToolHeaderSeparator />
				<ToolHeaderMeta>{timeStr}</ToolHeaderMeta>
			</ToolHeader>
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
