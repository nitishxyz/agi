import { useState } from 'react';
import {
	ChevronDown,
	ChevronRight,
	Search,
	Globe,
	ExternalLink,
	AlertCircle,
	FileText,
	Hash,
} from 'lucide-react';
import type { RendererProps } from './types';

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

interface WebSearchResultSearch {
	query: string;
	results: SearchResult[];
	count: number;
}

interface WebSearchResultFetch {
	url: string;
	content: string;
	contentLength: number;
	truncated: boolean;
	contentType: string;
}

interface WebSearchResultError {
	error: string;
	query?: string;
	suggestion?: string;
}

type WebSearchResult =
	| WebSearchResultSearch
	| WebSearchResultFetch
	| WebSearchResultError;

function isSearchResult(
	result: unknown,
): result is WebSearchResultSearch {
	return (
		typeof result === 'object' &&
		result !== null &&
		'results' in result &&
		'query' in result
	);
}

function isFetchResult(result: unknown): result is WebSearchResultFetch {
	return (
		typeof result === 'object' &&
		result !== null &&
		'content' in result &&
		'url' in result
	);
}

function isErrorResult(result: unknown): result is WebSearchResultError {
	return typeof result === 'object' && result !== null && 'error' in result;
}

function SearchResultCard({ result }: { result: SearchResult }) {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div className="border border-border rounded-lg overflow-hidden hover:border-border/80 transition-colors">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full text-left p-3 hover:bg-card/60 transition-colors"
			>
				<div className="flex items-start gap-2">
					<div className="flex-shrink-0 mt-1">
						{isExpanded ? (
							<ChevronDown className="w-4 h-4 text-muted-foreground" />
						) : (
							<ChevronRight className="w-4 h-4 text-muted-foreground" />
						)}
					</div>
					<div className="flex-1 min-w-0">
						<h4 className="font-medium text-xs text-foreground line-clamp-2">
							{result.title}
						</h4>
						{!isExpanded && result.snippet && (
							<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
								{result.snippet}
							</p>
						)}
					</div>
					<a
						href={result.url}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						className="flex-shrink-0 p-1 rounded hover:bg-card/80 transition-colors"
						title="Open in new tab"
					>
						<ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
					</a>
				</div>
			</button>

			{isExpanded && (
				<div className="px-3 pb-3 space-y-2 border-t border-border bg-card/40">
					{result.snippet && (
						<div className="pt-2">
							<p className="text-xs text-muted-foreground whitespace-pre-wrap">
								{result.snippet}
							</p>
						</div>
					)}
					<div className="flex items-center gap-1.5 text-xs">
						<Globe className="w-3 h-3 text-muted-foreground" />
						<a
							href={result.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted-foreground hover:underline truncate"
							title={result.url}
						>
							{result.url}
						</a>
					</div>
				</div>
			)}
		</div>
	);
}

export function WebSearchRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result;
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	// Search mode
	if (isSearchResult(result)) {
		const results = result.results || [];
		const count = result.count || results.length;

		return (
			<div className="text-xs">
				<button
					type="button"
					onClick={() => results.length > 0 && onToggle()}
					className={`flex items-center gap-2 text-amber-600 dark:text-amber-300 transition-colors ${
						results.length > 0
							? 'hover:text-amber-500 dark:hover:text-amber-200'
							: ''
					}`}
				>
					{results.length > 0 &&
						(isExpanded ? (
							<ChevronDown className="h-3 w-3" />
						) : (
							<ChevronRight className="h-3 w-3" />
						))}
					{results.length === 0 && <div className="w-3" />}
					<Search className="h-3 w-3" />
					<span className="font-medium">websearch</span>
					<span className="text-muted-foreground/70">·</span>
					<span className="text-foreground/70 italic">"{result.query}"</span>
					<span className="text-muted-foreground/80">
						· {count} {count === 1 ? 'result' : 'results'} · {timeStr}
					</span>
				</button>

				{isExpanded && results.length > 0 && (
					<div className="mt-2 ml-5 space-y-2">
						{results.map((item, idx) => (
							<SearchResultCard key={idx} result={item} />
						))}
					</div>
				)}

				{results.length === 0 && (
					<div className="mt-2 ml-5 text-xs text-muted-foreground italic p-3 bg-card/60 border border-border rounded">
						No results found
					</div>
				)}
			</div>
		);
	}

	// URL fetch mode
	if (isFetchResult(result)) {
		const lines = result.content?.split('\n').length || 0;
		const displayLength = result.contentLength || result.content?.length || 0;
		const wasTruncated = result.truncated || false;

		// Extract domain from URL
		const domain = (() => {
			try {
				return new URL(result.url).hostname;
			} catch {
				return result.url;
			}
		})();

		return (
			<div className="text-xs">
				<button
					type="button"
					onClick={onToggle}
					className="flex items-center gap-2 text-blue-700 dark:text-blue-300 transition-colors hover:text-blue-600 dark:hover:text-blue-200"
				>
					{isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
					<Globe className="h-3 w-3" />
					<span className="font-medium">websearch</span>
					<span className="text-muted-foreground/70">·</span>
					<span className="text-foreground/70 truncate max-w-md">{domain}</span>
					<span className="text-muted-foreground/80">
						· {displayLength.toLocaleString()} chars · {lines} lines
						{wasTruncated && ' (truncated)'}
						{timeStr && ` · ${timeStr}`}
					</span>
				</button>

				{isExpanded && result.content && (
					<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg p-3 space-y-2">
						{/* Metadata */}
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-3 py-2 bg-card/60 rounded border border-border">
							<div className="flex items-center gap-1">
								<FileText className="w-3 h-3" />
								<span>{result.contentType}</span>
							</div>
							<div className="flex items-center gap-1">
								<Hash className="w-3 h-3" />
								<span>{lines.toLocaleString()} lines</span>
							</div>
							<a
								href={result.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 hover:underline"
							>
								<Globe className="w-3 h-3" />
								<span className="truncate max-w-md" title={result.url}>
									{result.url}
								</span>
								<ExternalLink className="w-3 h-3" />
							</a>
						</div>

						{/* Content */}
						<div className="max-h-96 overflow-auto bg-card border border-border rounded">
							<pre className="p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words">
								{result.content}
							</pre>
						</div>

						{wasTruncated && (
							<div className="text-xs text-muted-foreground italic px-3">
								⚠️ Content was truncated to{' '}
								{displayLength.toLocaleString()} characters
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	// Error mode
	if (isErrorResult(result)) {
		return (
			<div className="text-xs">
				<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
					<div className="w-3" />
					<AlertCircle className="h-3 w-3" />
					<span className="font-medium">websearch</span>
					<span className="text-muted-foreground/80">{timeStr && `· ${timeStr}`}</span>
				</div>
				<div className="mt-2 ml-5 text-red-600 dark:text-red-400 text-xs p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
					<p className="font-medium">{result.error}</p>
					{result.query && (
						<p className="mt-1 text-xs text-red-700 dark:text-red-300">
							Query: "{result.query}"
						</p>
					)}
					{result.suggestion && (
						<p className="mt-1 text-xs text-red-600 dark:text-red-400 italic">
							💡 {result.suggestion}
						</p>
					)}
				</div>
			</div>
		);
	}

	// Fallback (shouldn't happen)
	return (
		<div className="text-xs">
			<div className="flex items-center gap-2 text-muted-foreground">
				<div className="w-3" />
				<span className="font-medium">websearch</span>
				<span className="text-muted-foreground/80">{timeStr && `· ${timeStr}`}</span>
			</div>
			<div className="mt-2 ml-5 text-xs text-muted-foreground p-2 border border-border rounded bg-card/60">
				<code className="text-xs">{JSON.stringify(result, null, 2)}</code>
			</div>
		</div>
	);
}
