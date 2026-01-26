import { tool } from 'ai';
import { z } from 'zod/v3';
import DESCRIPTION from './progress.txt' with { type: 'text' };

// Progress update tool: allows the model to emit lightweight status signals
// without revealing chain-of-thought. The runner/UI should surface these
// messages immediately.
const StageEnum = z.enum([
	'planning',
	'discovering',
	'generating',
	'preparing',
	'writing',
	'verifying',
]);

export const progressUpdateTool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({
		message: z
			.string()
			.min(1)
			.max(200)
			.describe('Short, user-facing status message (<= 200 chars).'),
		pct: z
			.number()
			.min(0)
			.max(100)
			.optional()
			.describe('Optional overall progress percent 0-100.'),
		stage: StageEnum.optional().default('planning'),
	}),
	async execute({
		message,
		pct,
		stage,
	}: {
		message: string;
		pct?: number;
		stage?: z.infer<typeof StageEnum>;
	}) {
		// Keep the tool lightweight; no side effects beyond the event itself.
		// Returning the normalized payload allows generic renderers to inspect it if needed.
		const normalizedPct =
			typeof pct === 'number'
				? Math.min(100, Math.max(0, Math.round(pct)))
				: undefined;
		return {
			ok: true,
			message,
			pct: normalizedPct,
			stage: stage ?? 'planning',
		} as const;
	},
});
