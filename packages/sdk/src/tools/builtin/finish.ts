import { z } from 'zod';
import { tool } from 'ai';
import DESCRIPTION from './finish.txt' with { type: 'text' };

export const finishTool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({}),
	async execute() {
		return { done: true } as const;
	},
});
