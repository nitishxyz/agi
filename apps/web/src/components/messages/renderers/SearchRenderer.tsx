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
				className={`flex items-center gap-2 text-amber-600 dark:text-amber-300 transition-colors ${resultList.length > 0 ? 'hover:text-amber-500 dark:hover:text-amber-200' : ''}`}
			>
				{resultList.length > 0 &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{resultList.length === 0 && <div className="w-3" />}
				<span className="font-medium">{toolName}</span>
				<span className="text-muted-foreground/80">
					· {resultList.length} matches · {timeStr}
				</span>
			</button>
			{isExpanded && resultList.length > 0 && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-w-full">
					<div className="p-3 overflow-x-auto overflow-y-auto max-h-96 max-w-full">
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
												className="font-mono text-xs break-all"
											>
												<span className="text-muted-foreground">
													{match.file}
												</span>
												{match.line !== undefined && (
													<span className="text-muted-foreground/80">
														:{match.line}
													</span>
												)}
												{match.text && (
													<span className="text-muted-foreground ml-2 break-words">
														{match.text}
													</span>
												)}
											</div>
										);
									}
								}
								const key = typeof item === 'string' ? item : `item-${idx}`;
								return (
									<div
										key={key}
										className="text-muted-foreground font-mono text-xs break-all"
									>
										{typeof item === 'string' ? item : JSON.stringify(item)}
									</div>
								);
							})}
							{resultList.length > 50 && (
								<div className="text-muted-foreground/80 text-xs mt-2">
									... and {resultList.length - 50} more
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
