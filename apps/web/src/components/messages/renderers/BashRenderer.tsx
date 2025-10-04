import { ChevronDown, ChevronRight } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function BashRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const stdout = String(result.stdout || '');
	const stderr = String(result.stderr || '');
	const exitCode = Number(result.exitCode ?? 0);
	const cwd = String(result.cwd || '');
	const timeStr = formatDuration(toolDurationMs);

	const hasOutput = stdout.length > 0 || stderr.length > 0;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => hasOutput && onToggle()}
				className={`flex items-center gap-2 text-muted-foreground transition-colors ${hasOutput ? 'hover:text-foreground' : ''}`}
			>
				{hasOutput &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!hasOutput && <div className="w-3" />}
				<span className="font-medium">bash</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70 truncate max-w-xs">{cwd}</span>
				<span
					className={
						exitCode === 0
							? 'text-emerald-600 dark:text-emerald-400'
							: 'text-red-600 dark:text-red-400'
					}
				>
					· exit {exitCode} · {timeStr}
				</span>
			</button>
			{isExpanded && hasOutput && (
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
