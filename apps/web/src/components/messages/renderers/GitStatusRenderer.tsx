import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function GitStatusRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const staged = Number(result.staged || 0);
	const unstaged = Number(result.unstaged || 0);
	const raw = (result.raw || []) as string[];
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => raw.length > 0 && onToggle()}
				className={`flex items-center gap-2 text-blue-400 ${raw.length > 0 ? 'hover:text-blue-300 transition-colors' : ''}`}
			>
				{raw.length > 0 &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{raw.length === 0 && <div className="w-3" />}
				<span className="font-medium">git_status</span>
				<span className="text-zinc-500">·</span>
				<span className="text-zinc-400">
					{staged} staged, {unstaged} unstaged
				</span>
				<span className="text-zinc-600">· {timeStr}</span>
			</button>
			{isExpanded && raw.length > 0 && (
				<div className="mt-2 ml-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto text-xs font-mono space-y-0.5">
					{raw.map((line) => (
						<div key={line} className="text-zinc-400">
							{line}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
