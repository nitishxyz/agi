import { tool } from 'ai';
import { z } from 'zod';

const sessionLinkSchema = z.object({
	sessionId: z.string().describe('The session ID to link to'),
	title: z.string().describe('Display title for the link'),
	description: z
		.string()
		.optional()
		.describe('Brief description of what this session contains'),
});

const inputSchema = z.object({
	type: z
		.enum(['session_links', 'info', 'warning'])
		.default('session_links')
		.describe('Type of action to present'),
	title: z.string().optional().describe('Optional title for the action block'),
	summary: z.string().optional().describe('Summary text to display'),
	links: z
		.array(sessionLinkSchema)
		.max(10)
		.optional()
		.describe('Session links to present (for session_links type)'),
});

export function buildPresentActionTool() {
	return {
		name: 'present_action',
		tool: tool({
			description:
				'Present an action block to the user with session links or information. Use at the end of your research to let users navigate directly to relevant sessions. The links will be rendered as clickable buttons.',
			inputSchema,
			async execute(input) {
				return {
					ok: true,
					type: input.type,
					title: input.title,
					summary: input.summary,
					links: input.links || [],
				};
			},
		}),
	};
}

export { buildPresentActionTool as buildPresentSessionLinksTool };
