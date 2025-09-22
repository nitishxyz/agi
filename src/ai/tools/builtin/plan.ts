import { tool, type Tool } from 'ai';
import { z } from 'zod';
import DESCRIPTION from './plan.txt' with { type: 'text' };

export const updatePlanTool: Tool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({
		items: z
			.array(z.string().min(1))
			.min(1)
			.describe('Ordered list of plan steps'),
		note: z
			.string()
			.optional()
			.describe('Optional note or context for the plan update'),
	}),
	async execute({ items, note }: { items: string[]; note?: string }) {
		return { items, note };
	},
});
