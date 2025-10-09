import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

interface WebContent {
	url: string;
	content: string;
	title?: string;
}

export function WebSearchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const [expandedContent, setExpandedContent] = useState<Set<number>>(
		new Set(),
	);

	const toggleContent = (index: number) => {
		setExpandedContent((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	// Check if it's a search query or URL fetch
	const isSearch = 'results' in result;
	const searchResults = (result.results as SearchResult[]) || [];
	const webContent = result as WebContent;

	if (isSearch) {
		const timeStr = formatDuration(toolDurationMs);

		return (
			<div className="text-xs">
				<button
					type="button"
					onClick={onToggle}
					className="flex items-center gap-2 text-purple-700 dark:text-purple-300 transition-colors hover:text-purple-600 dark:hover:text-purple-200"
				>
					{isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
					<span className="font-medium">web search</span>
					<span className="text-muted-foreground/70">·</span>
					<span className="text-foreground/70">
						{searchResults.length}{' '}
						{searchResults.length === 1 ? 'result' : 'results'}
					</span>
					<span className="text-muted-foreground/80">· {timeStr}</span>
				</button>
				{isExpanded && (
					<div className="mt-2 ml-5 space-y-2 max-h-96 overflow-y-auto">
						{searchResults.map((item, i) => (
							<div
								key={`${item.url}-${i}`}
								className="bg-card/60 border border-border rounded-lg p-3 space-y-1"
							>
								<a
									href={item.url}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
								>
									{item.title}
									<ExternalLink className="h-3 w-3" />
								</a>
								<p className="text-muted-foreground text-xs">{item.snippet}</p>
								<p className="text-xs text-muted-foreground/70 truncate">
									{item.url}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	// URL fetch rendering
	const timeStr = formatDuration(toolDurationMs);
	const displayUrl =
		webContent.url && webContent.url.length > 60
			? `${webContent.url.slice(0, 60)}...`
			: webContent.url;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => toggleContent(0)}
				className="flex items-center gap-2 text-purple-700 dark:text-purple-300 transition-colors hover:text-purple-600 dark:hover:text-purple-200 w-full text-left"
			>
				{expandedContent.has(0) ? (
					<ChevronDown className="h-3 w-3 flex-shrink-0" />
				) : (
					<ChevronRight className="h-3 w-3 flex-shrink-0" />
				)}
				<span className="font-medium flex-shrink-0">web fetch</span>
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				<a
					href={webContent.url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1 min-w-0"
					onClick={(e) => e.stopPropagation()}
				>
					{displayUrl}
				</a>
				<span className="text-muted-foreground/80 flex-shrink-0">
					· {timeStr}
				</span>
			</button>
			{expandedContent.has(0) && webContent.content && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg p-3 max-h-96 overflow-y-auto">
					<div className="text-xs text-foreground/80 whitespace-pre-wrap break-words">
						{webContent.content}
					</div>
				</div>
			)}
		</div>
	);
}
