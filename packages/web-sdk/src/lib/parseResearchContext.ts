export interface ParsedResearchContext {
	id: string;
	label: string;
	content: string;
	from: string;
}

export interface ParseResult {
	researchContexts: ParsedResearchContext[];
	cleanContent: string;
}

const RESEARCH_CONTEXT_REGEX =
	/<research-context\s+from="([^"]+)"\s+label="([^"]+)"[^>]*>([\s\S]*?)<\/research-context>/g;

export function parseResearchContext(content: string): ParseResult {
	const researchContexts: ParsedResearchContext[] = [];
	let cleanContent = content;

	const regex = new RegExp(RESEARCH_CONTEXT_REGEX);
	let match = regex.exec(content);

	while (match !== null) {
		const [fullMatch, from, label, innerContent] = match;
		researchContexts.push({
			id: from,
			from,
			label,
			content: innerContent.trim(),
		});
		cleanContent = cleanContent.replace(fullMatch, '');
		match = regex.exec(content);
	}

	cleanContent = cleanContent.trim();

	return {
		researchContexts,
		cleanContent,
	};
}

export function formatResearchContextForMessage(
	contexts: Array<{ sessionId: string; label: string; content: string }>,
): string {
	if (contexts.length === 0) return '';

	// content is already the full XML from server, just join them
	return contexts.map((ctx) => ctx.content).join('\n\n');
}
