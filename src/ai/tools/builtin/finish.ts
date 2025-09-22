import { z } from 'zod';
import { tool } from 'ai';
import DESCRIPTION from './finish.txt' with { type: 'text' };

export const finishTool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({
		text: z.string().optional().describe('Optional final message to return'),
	}),
	async execute({ text }: { text?: string }) {
		return { done: true, text } as const;
	},
});
