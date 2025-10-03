import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

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
	const hasOutput = stdout || stderr;
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => hasOutput && onToggle()}
				className={`flex items-center gap-2 text-muted-foreground ${hasOutput ? 'hover:text-foreground transition-colors' : ''}`}
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
				<span
					className={
						exitCode === 0
							? 'text-emerald-700 dark:text-emerald-300'
							: 'text-red-600 dark:text-red-300'
					}
				>
					exit {exitCode}
				</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && (
				<div className="mt-2 ml-5 space-y-2">
					{stdout && (
						<pre className="text-foreground/80 bg-card/60 border border-border rounded-lg p-3 overflow-x-auto max-h-96 text-xs">
							{stdout.slice(0, 5000)}
							{stdout.length > 5000 && (
								<div className="text-muted-foreground/80 mt-1">...</div>
							)}
						</pre>
					)}
					{stderr && (
						<pre className="text-red-600/80 dark:text-red-300/80 bg-red-100/40 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/30 rounded-lg p-3 overflow-x-auto max-h-64 text-xs">
							{stderr.slice(0, 2000)}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}
