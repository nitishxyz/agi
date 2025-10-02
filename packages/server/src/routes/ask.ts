import type { Hono } from 'hono';
import type {
	AskServerRequest,
	InjectableConfig,
	InjectableCredentials,
} from '../runtime/askService.ts';
import { AskServiceError, handleAskRequest } from '../runtime/askService.ts';

export function registerAskRoutes(app: Hono) {
	app.post('/v1/ask', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const body = (await c.req.json().catch(() => ({}))) as Record<
			string,
			unknown
		>;
		const prompt = typeof body.prompt === 'string' ? body.prompt : '';
		if (!prompt.trim().length) {
			return c.json({ error: 'Prompt is required.' }, 400);
		}

		const request: AskServerRequest = {
			projectRoot,
			prompt,
			agent: typeof body.agent === 'string' ? body.agent : undefined,
			provider: typeof body.provider === 'string' ? body.provider : undefined,
			model: typeof body.model === 'string' ? body.model : undefined,
			sessionId:
				typeof body.sessionId === 'string' ? body.sessionId : undefined,
			last: Boolean(body.last),
			jsonMode: Boolean(body.jsonMode),
			skipFileConfig:
				typeof body.skipFileConfig === 'boolean'
					? body.skipFileConfig
					: undefined,
			config:
				body.config && typeof body.config === 'object'
					? (body.config as InjectableConfig)
					: undefined,
			credentials:
				body.credentials && typeof body.credentials === 'object'
					? (body.credentials as InjectableCredentials)
					: undefined,
			agentPrompt:
				typeof body.agentPrompt === 'string' ? body.agentPrompt : undefined,
			tools: Array.isArray(body.tools) ? body.tools : undefined,
		};

		try {
			const response = await handleAskRequest(request);
			return c.json(response, 202);
		} catch (err) {
			if (err instanceof AskServiceError) {
				return c.json({ error: err.message }, err.status as never);
			}
			const message = err instanceof Error ? err.message : String(err);
			return c.json({ error: message }, 400);
		}
	});
}
