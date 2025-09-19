import { z } from 'zod';
import { tool } from 'ai';

export const finishTool = tool({
	description:
		'Signal that the current task is complete and optionally provide the final text.',
	inputSchema: z.object({
		text: z.string().optional().describe('Optional final message to return'),
	}),
	async execute({ text }: { text?: string }) {
		return { done: true, text } as const;
	},
});
