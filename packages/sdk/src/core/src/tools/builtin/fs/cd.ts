import { tool, type Tool } from 'ai';
import { z } from 'zod';
import DESCRIPTION from './cd.txt' with { type: 'text' };

// description imported above

export function buildCdTool(): { name: string; tool: Tool } {
	const cd = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z.string().describe('Relative directory path'),
		}),
		async execute({ path }: { path: string }) {
			// Actual cwd update is handled in the adapter; this is a placeholder schema
			return { cwd: path };
		},
	});
	return { name: 'cd', tool: cd };
}
