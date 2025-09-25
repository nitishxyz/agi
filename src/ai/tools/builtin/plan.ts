import { tool, type Tool } from 'ai';
import { z } from 'zod';
import DESCRIPTION from './plan.txt' with { type: 'text' };

const STATUS_ENUM = z.enum(['pending', 'in_progress', 'completed']);

const ITEM_SCHEMA = z
	.union([
		z.string().min(1, 'Plan steps must be non-empty'),
		z.object({
			step: z.string().min(1, 'Plan steps must be non-empty'),
			status: STATUS_ENUM.optional(),
		}),
	])
	.describe('Plan item');

type PlanItemInput = z.infer<typeof ITEM_SCHEMA>;

function normalizeItems(
	raw: PlanItemInput[],
): Array<{ step: string; status: z.infer<typeof STATUS_ENUM> }> {
	const normalized = raw.map((item) => {
		if (typeof item === 'string') {
			return { step: item.trim(), status: 'pending' as const };
		}
		const step = item.step.trim();
		const status = item.status ?? 'pending';
		return { step, status };
	});

	const filtered = normalized.filter((item) => item.step.length > 0);
	if (!filtered.length) {
		throw new Error('At least one plan step is required');
	}

	const inProgressCount = filtered.filter(
		(item) => item.status === 'in_progress',
	).length;
	if (inProgressCount > 1) {
		throw new Error('Only one plan step may be marked as in_progress');
	}

	return filtered;
}

export const updatePlanTool: Tool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({
		items: z.array(ITEM_SCHEMA).min(1).describe('Ordered list of plan steps'),
		note: z
			.string()
			.optional()
			.describe('Optional note or context for the plan update'),
	}),
	async execute({ items, note }: { items: PlanItemInput[]; note?: string }) {
		return { items: normalizeItems(items), note };
	},
});
