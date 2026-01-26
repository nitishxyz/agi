import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import DESCRIPTION from './pwd.txt' with { type: 'text' };

// description imported above

export function buildPwdTool(): { name: string; tool: Tool } {
	const pwd = tool({
		description: DESCRIPTION,
		inputSchema: z.object({}).optional(),
		async execute() {
			// Actual cwd resolution is handled in the adapter; this is a placeholder schema
			return { cwd: '.' };
		},
	});
	return { name: 'pwd', tool: pwd };
}
