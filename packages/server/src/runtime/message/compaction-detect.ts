export function isCompactCommand(content: string): boolean {
	const trimmed = content.trim().toLowerCase();
	return trimmed === '/compact';
}

export function getCompactionSystemPrompt(): string {
	return `
The conversation context is being compacted. The provided context is structured with
RECENT conversation in full detail at the end, and OLDER conversation (with truncated tool data) at the start.

Generate a comprehensive summary that captures:

1. **Current State**: What was the most recent task? What is the current state of the work RIGHT NOW?
2. **Key Changes Made**: What files were created, modified, or deleted? Summarize recent code changes.
3. **Main Goals**: What is the user trying to accomplish overall?
4. **Important Decisions**: What approaches or solutions were chosen and why?
5. **Pending Work**: What remains to be done? Any known issues or blockers?
6. **Critical Context**: Any gotchas, errors encountered, or important details for continuing.

IMPORTANT: Prioritize the RECENT conversation. The summary must allow seamless continuation
of work. Focus on what was just done and what comes next — not the early parts of the conversation.

Format your response as a clear, structured summary. Start with "📦 **Context Compacted**" header.
Keep under 2000 characters but be thorough. This summary will replace detailed tool history.
`;
}
