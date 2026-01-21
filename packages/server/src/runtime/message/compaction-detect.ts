export function isCompactCommand(content: string): boolean {
	const trimmed = content.trim().toLowerCase();
	return trimmed === '/compact';
}

export function getCompactionSystemPrompt(): string {
	return `
The user has requested to compact the conversation. Generate a comprehensive summary that captures:

1. **Main Goals**: What was the user trying to accomplish?
2. **Key Actions**: What files were created, modified, or deleted?
3. **Important Decisions**: What approaches or solutions were chosen and why?
4. **Current State**: What is done and what might be pending?
5. **Critical Context**: Any gotchas, errors encountered, or important details for continuing.

Format your response as a clear, structured summary. Start with "📦 **Context Compacted**" header.
Keep under 2000 characters but be thorough. This summary will replace detailed tool history.
`;
}
