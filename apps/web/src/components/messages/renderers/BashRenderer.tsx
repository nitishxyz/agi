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
				className={`flex items-center gap-2 text-zinc-400 ${hasOutput ? 'hover:text-zinc-300 transition-colors' : ''}`}
			>
				{hasOutput &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!hasOutput && <div className="w-3" />}
				<span className="font-medium">bash</span>
				<span className="text-zinc-500">·</span>
				<span className={exitCode === 0 ? 'text-green-400' : 'text-red-400'}>
					exit {exitCode}
				</span>
				<span className="text-zinc-600">· {timeStr}</span>
			</button>
			{isExpanded && (
				<div className="mt-2 ml-5 space-y-2">
					{stdout && (
						<pre className="text-zinc-300 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto max-h-96 text-xs">
							{stdout.slice(0, 5000)}
							{stdout.length > 5000 && (
								<div className="text-zinc-600 mt-1">...</div>
							)}
						</pre>
					)}
					{stderr && (
						<pre className="text-red-400/80 bg-red-950/20 border border-red-900/30 rounded-lg p-3 overflow-x-auto max-h-64 text-xs">
							{stderr.slice(0, 2000)}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}
