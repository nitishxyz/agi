import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import DESCRIPTION from './websearch.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';

export function buildWebSearchTool(): {
	name: string;
	tool: Tool;
} {
	const websearch = tool({
		description: DESCRIPTION,
		inputSchema: z
			.object({
				url: z
					.string()
					.optional()
					.describe(
						'URL to fetch content from (mutually exclusive with query)',
					),
				query: z
					.string()
					.optional()
					.describe(
						'Search query to search the web (mutually exclusive with url)',
					),
				maxLength: z
					.number()
					.optional()
					.default(50000)
					.describe(
						'Maximum content length to return (default: 50000 characters)',
					),
			})
			.strict()
			.refine((data) => (data.url ? !data.query : !!data.query), {
				message: 'Must provide either url or query, but not both',
			}),
		async execute({
			url,
			query,
			maxLength,
		}: {
			url?: string;
			query?: string;
			maxLength?: number;
		}): Promise<
			ToolResponse<
				| {
						url: string;
						content: string;
						contentLength: number;
						truncated: boolean;
						contentType: string;
				  }
				| {
						query: string;
						results: Array<{ title: string; url: string; snippet: string }>;
						count: number;
				  }
			>
		> {
			const maxLen = maxLength ?? 50000;

			if (url) {
				// Fetch URL content
				try {
					const response = await fetch(url, {
						headers: {
							'User-Agent':
								'Mozilla/5.0 (compatible; otto-bot/1.0; +https://github.com/anthropics/otto)',
							Accept:
								'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
						},
						redirect: 'follow',
						signal: AbortSignal.timeout(30000), // 30 second timeout
					});

					if (!response.ok) {
						throw new Error(
							`HTTP error! status: ${response.status} ${response.statusText}`,
						);
					}

					const contentType = response.headers.get('content-type') || '';
					let content = '';

					if (
						contentType.includes('text/') ||
						contentType.includes('application/json') ||
						contentType.includes('application/xml') ||
						contentType.includes('application/xhtml')
					) {
						content = await response.text();
					} else {
						return createToolError(
							`Unsupported content type: ${contentType}. Only text-based content can be fetched.`,
							'unsupported',
							{ contentType },
						);
					}

					// Strip HTML tags for better readability (basic cleaning)
					const cleanContent = content
						.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
						.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
						.replace(/<[^>]+>/g, ' ')
						.replace(/\s+/g, ' ')
						.trim();

					const truncated = cleanContent.slice(0, maxLen);
					const wasTruncated = cleanContent.length > maxLen;

					return {
						ok: true,
						url,
						content: truncated,
						contentLength: cleanContent.length,
						truncated: wasTruncated,
						contentType,
					};
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					return createToolError(
						`Failed to fetch URL: ${errorMessage}`,
						'execution',
						{ url },
					);
				}
			}

			if (query) {
				// Web search functionality
				// Use DuckDuckGo's HTML search (doesn't require API key)
				try {
					const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
					const response = await fetch(searchUrl, {
						headers: {
							'User-Agent':
								'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
							Accept: 'text/html',
						},
						redirect: 'follow',
						signal: AbortSignal.timeout(30000),
					});

					if (!response.ok) {
						throw new Error(`Search failed: ${response.status}`);
					}

					const html = await response.text();

					// Parse DuckDuckGo results (basic parsing)
					const results: Array<{
						title: string;
						url: string;
						snippet: string;
					}> = [];

					// Match result blocks
					const resultPattern =
						/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

					let match: RegExpExecArray | null = null;
					match = resultPattern.exec(html);
					while (match !== null && results.length < 10) {
						const url = match[1]?.trim();
						const title = match[2]?.trim();
						let snippet = match[3]?.trim();

						if (url && title) {
							// Clean snippet
							snippet = snippet
								?.replace(/<[^>]+>/g, '')
								.replace(/\s+/g, ' ')
								.trim();

							results.push({
								title,
								url,
								snippet: snippet || '',
							});
						}
						match = resultPattern.exec(html);
					}

					// Fallback: simpler pattern if the above doesn't work
					if (results.length === 0) {
						const simplePattern =
							/<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
						match = simplePattern.exec(html);
						while (match !== null && results.length < 10) {
							const url = match[1]?.trim();
							const title = match[2]?.trim();
							if (url && title && url.startsWith('http')) {
								results.push({
									title,
									url,
									snippet: '',
								});
							}
							match = simplePattern.exec(html);
						}
					}

					if (results.length === 0) {
						return createToolError(
							'No search results found. The search service may have changed its format or blocked the request.',
							'execution',
							{
								query,
								suggestion:
									'Try using the url parameter to fetch a specific webpage instead.',
							},
						);
					}

					return {
						ok: true,
						query,
						results,
						count: results.length,
					};
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					return createToolError(
						`Search failed: ${errorMessage}`,
						'execution',
						{
							query,
							suggestion:
								'Search services may be temporarily unavailable. Try using the url parameter to fetch a specific webpage instead.',
						},
					);
				}
			}

			return createToolError(
				'Must provide either url or query parameter',
				'validation',
				{
					suggestion: 'Provide either a url to fetch or a query to search',
				},
			);
		},
	});

	return { name: 'websearch', tool: websearch };
}
