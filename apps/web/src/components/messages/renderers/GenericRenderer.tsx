import { ChevronRight, AlertCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { GenericRendererProps } from './types';
import { formatDuration } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function GenericRenderer({
	toolName,
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: GenericRendererProps) {
	const result = contentJson.result;
	const timeStr = formatDuration(toolDurationMs);
	const hasResult = result && Object.keys(result).length > 0;

	// Check for errors
	const hasError =
		contentJson.error ||
		(result &&
			typeof result === 'object' &&
			'ok' in result &&
			result.ok === false);
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

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className={`flex items-center gap-2 transition-colors w-full ${
					hasError
						? 'text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200'
						: 'text-foreground hover:text-foreground/80'
				}`}
			>
				<ChevronRight
					className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
				/>
				{hasError && (
					<AlertCircle className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
				)}
				<span className="font-medium flex-shrink-0">
					{toolName}
					{hasError ? ' error' : ''}
				</span>
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				<span className="text-muted-foreground/80 flex-shrink-0">
					{timeStr}
				</span>
			</button>
			{isExpanded && hasError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} stack={errorStack} showStack />
			)}
			{isExpanded && !hasError && hasResult && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
					<div className="overflow-x-auto max-w-full">
						<SyntaxHighlighter
							language="json"
							style={vscDarkPlus}
							customStyle={{
								margin: 0,
								padding: '0.75rem',
								fontSize: '0.75rem',
								lineHeight: '1.5',
								background: 'transparent',
								maxWidth: '100%',
							}}
							wrapLines
							wrapLongLines
						>
							{JSON.stringify(result, null, 2)}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
