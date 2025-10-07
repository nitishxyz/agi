import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function BashRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const args = contentJson.args || {};
	
	// Check for tool execution error (ok: false)
	const hasToolError =
		typeof result === 'object' && 'ok' in result && result.ok === false;
	const errorMessage =
		hasToolError && 'error' in result && typeof result.error === 'string'
			? result.error
			: null;
	const errorStack =
		hasToolError && 'stack' in result && typeof result.stack === 'string'
			? result.stack
			: undefined;

	const stdout = String(result.stdout || '');
	const stderr = String(result.stderr || '');
	const exitCode = Number(result.exitCode ?? 0);
	const cmd = String(args.cmd || '');
	const timeStr = formatDuration(toolDurationMs);

	const hasOutput = stdout.length > 0 || stderr.length > 0;

	const canExpand = hasOutput || hasToolError;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => canExpand && onToggle()}
				className={`flex items-center gap-2 transition-colors w-full min-w-0 ${
					hasToolError
						? 'text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200'
						: canExpand
							? 'text-muted-foreground hover:text-foreground'
							: 'text-muted-foreground'
				}`}
			>
				{canExpand &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3 flex-shrink-0" />
					) : (
						<ChevronRight className="h-3 w-3 flex-shrink-0" />
					))}
				{!canExpand && <div className="w-3 flex-shrink-0" />}
				{hasToolError && (
					<AlertCircle className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
				)}
				<span className="font-medium flex-shrink-0">
					bash{hasToolError ? ' error' : ''}
				</span>
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				<span className="text-foreground/70 truncate min-w-0" title={cmd}>
					{cmd}
				</span>
				{!hasToolError && (
					<span
						className={`flex-shrink-0 whitespace-nowrap ${
							exitCode === 0
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-red-600 dark:text-red-400'
						}`}
					>
						· exit {exitCode} · {timeStr}
					</span>
				)}
				{hasToolError && (
					<span className="text-muted-foreground/80 flex-shrink-0">
						· {timeStr}
					</span>
				)}
			</button>
			{isExpanded && hasToolError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} stack={errorStack} showStack />
			)}
			{isExpanded && !hasToolError && hasOutput && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
					<div className="overflow-x-auto max-w-full">
						{stdout && (
							<div className="mb-2">
								<div className="text-xs text-muted-foreground px-3 py-1 border-b border-border bg-muted/30">
									stdout
								</div>
								<SyntaxHighlighter
									language="bash"
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
									{stdout}
								</SyntaxHighlighter>
							</div>
						)}
						{stderr && (
							<div>
								<div className="text-xs text-red-600 dark:text-red-400 px-3 py-1 border-b border-border bg-red-500/10">
									stderr
								</div>
								<SyntaxHighlighter
									language="bash"
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
									{stderr}
								</SyntaxHighlighter>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
