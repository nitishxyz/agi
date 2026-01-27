import { Hono } from 'hono';
import { catalog } from '../catalog';
import { config } from '../config';

const models = new Hono();

models.get('/v1/models', async (c) => {
	const data: any[] = [];

	for (const [providerId, entry] of Object.entries(catalog)) {
		for (const model of entry.models) {
			const pricing = model.cost
				? {
						input: (model.cost.input ?? 0) * config.markup,
						output: (model.cost.output ?? 0) * config.markup,
						cache_read: model.cost.cacheRead
							? model.cost.cacheRead * config.markup
							: undefined,
					}
				: undefined;

			data.push({
				id: model.id,
				object: 'model',
				created: Math.floor(Date.now() / 1000),
				owned_by: providerId,
				pricing,
				context_length: model.limit?.context,
				max_output: model.limit?.output,
				capabilities: {
					tool_call: model.toolCall ?? false,
					reasoning: model.reasoning ?? false,
				},
			});
		}
	}

	return c.json({
		object: 'list',
		data,
	});
});

export default models;
