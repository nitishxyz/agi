import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function BashRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const args = (contentJson as { args?: unknown }).args;
	const stdout = String(result.stdout || '');
	const stderr = String(result.stderr || '');
	const exitCodeRaw = result.exitCode;
	const exitCode =
		exitCodeRaw === null || exitCodeRaw === undefined
			? null
			: Number(exitCodeRaw || 0);
	const hasOutput = Boolean(stdout || stderr);
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';
	const command = (() => {
		const fromArgs =
			(() => {
				if (!args || typeof args !== 'object') return null;
				const rec = args as Record<string, unknown>;
				for (const key of ['cmd', 'command', 'script', 'input']) {
					const value = rec[key];
					if (typeof value === 'string' && value.trim().length > 0) {
						return value.trim();
					}
				}
				return null;
			})() ??
			(() => {
				if (!result || typeof result !== 'object') return null;
				const rec = result as Record<string, unknown>;
				for (const key of ['cmd', 'command', 'script', 'input']) {
					const value = rec[key];
					if (typeof value === 'string' && value.trim().length > 0) {
						return value.trim();
					}
				}
				return null;
			})();
		return fromArgs ?? '';
	})();

	const exitLabel = exitCode === null ? 'exit ?' : `exit ${exitCode}`;
	const exitClass =
		exitCode === null || exitCode === 0
			? 'text-emerald-700 dark:text-emerald-300'
			: 'text-red-600 dark:text-red-300';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => hasOutput && onToggle()}
				className={`flex items-center gap-2 text-foreground/80 transition-colors ${hasOutput ? 'hover:text-foreground' : ''}`}
			>
				{hasOutput &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!hasOutput && <div className="w-3" />}
				<span className="font-medium text-foreground">bash</span>
				{command && (
					<>
						<span className="text-muted-foreground/70">·</span>
						<code className="font-mono text-foreground/90 truncate max-w-md">{command}</code>
					</>
				)}
				{exitLabel && (
					<>
						<span className="text-muted-foreground/70">·</span>
						<span className={exitClass}>{exitLabel}</span>
					</>
				)}
				{timeStr && (
					<>
						<span className="text-muted-foreground/70">·</span>
						<span className="text-muted-foreground/80">{timeStr}</span>
					</>
				)}
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
