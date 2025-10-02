import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function SearchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const matches = (result.matches || []) as unknown[];
	const files = (result.files || []) as unknown[];
	const resultList = matches.length > 0 ? matches : files;
	const toolName = contentJson.name || 'search';
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => resultList.length > 0 && onToggle()}
				className={`flex items-center gap-2 text-yellow-400 ${resultList.length > 0 ? 'hover:text-yellow-300 transition-colors' : ''}`}
			>
				{resultList.length > 0 &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{resultList.length === 0 && <div className="w-3" />}
				<span className="font-medium">{toolName}</span>
				<span className="text-zinc-600">
					· {resultList.length} matches · {timeStr}
				</span>
			</button>
			{isExpanded && resultList.length > 0 && (
				<div className="mt-2 ml-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto max-h-96 overflow-y-auto">
					<div className="space-y-1">
						{resultList.slice(0, 50).map((item: unknown, idx: number) => {
							if (typeof item === 'object' && item !== null) {
								const match = item as {
									file?: string;
									line?: number;
									text?: string;
								};
								if (match.file) {
									return (
										<div
											key={`${match.file}-${match.line || idx}`}
											className="font-mono text-xs"
										>
											<span className="text-zinc-500">{match.file}</span>
											{match.line !== undefined && (
												<span className="text-zinc-600">:{match.line}</span>
											)}
											{match.text && (
												<span className="text-zinc-400 ml-2">{match.text}</span>
											)}
										</div>
									);
								}
							}
							const key = typeof item === 'string' ? item : `item-${idx}`;
							return (
								<div key={key} className="text-zinc-400 font-mono text-xs">
									{typeof item === 'string' ? item : JSON.stringify(item)}
								</div>
							);
						})}
						{resultList.length > 50 && (
							<div className="text-zinc-600 text-xs mt-2">
								... and {resultList.length - 50} more
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
