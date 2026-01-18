import { z } from 'zod';
import { tool } from 'ai';
import DESCRIPTION from './finish.txt' with { type: 'text' };
import type { ToolResponse } from '../error.ts';

export const finishTool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({}),
	async execute(): Promise<ToolResponse<{ done: true }>> {
		return { ok: true, done: true };
	},
});
