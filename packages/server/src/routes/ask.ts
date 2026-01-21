import type { Hono } from 'hono';
import type {
	AskServerRequest,
	InjectableConfig,
	InjectableCredentials,
} from '../runtime/ask/service.ts';
import { handleAskRequest } from '../runtime/ask/service.ts';
import { serializeError } from '../runtime/errors/api-error.ts';
import { logger } from '@agi-cli/sdk';
import type { EmbeddedAppConfig } from '../index.ts';

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

		const embeddedConfig = c.get('embeddedConfig') as
			| EmbeddedAppConfig
			| undefined;

		// Hybrid fallback: Use embedded config if provided, otherwise fall back to files/env
		let injectableConfig: InjectableConfig | undefined;
		let injectableCredentials: InjectableCredentials | undefined;
		let skipFileConfig = false;

		if (embeddedConfig && Object.keys(embeddedConfig).length > 0) {
			// Has embedded config - build injectable config from it
			const defaults = embeddedConfig.defaults;
			const hasDefaults =
				defaults ||
				embeddedConfig.provider ||
				embeddedConfig.model ||
				embeddedConfig.agent;

			if (hasDefaults) {
				injectableConfig = {
					provider: defaults?.provider ?? embeddedConfig.provider,
					model: defaults?.model ?? embeddedConfig.model,
					agent: defaults?.agent ?? embeddedConfig.agent,
				};
			}

			// Convert embedded auth to injectable credentials
			const hasAuth = embeddedConfig.auth || embeddedConfig.apiKey;
			if (hasAuth) {
				if (embeddedConfig.auth) {
					injectableCredentials = {} as InjectableCredentials;
					for (const [provider, auth] of Object.entries(embeddedConfig.auth)) {
						if ('apiKey' in auth) {
							(injectableCredentials as Record<string, { apiKey: string }>)[
								provider
							] = { apiKey: auth.apiKey };
						}
					}
				} else if (embeddedConfig.apiKey && embeddedConfig.provider) {
					injectableCredentials = {
						[embeddedConfig.provider]: { apiKey: embeddedConfig.apiKey },
					};
				}

				// Only skip file config if we have credentials injected
				skipFileConfig = true;
			}
			// If no auth provided, skipFileConfig stays false -> will use ensureProviderEnv -> auth.json fallback
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
				skipFileConfig ||
				(typeof body.skipFileConfig === 'boolean'
					? body.skipFileConfig
					: false),
			config:
				injectableConfig ||
				(body.config && typeof body.config === 'object'
					? (body.config as InjectableConfig)
					: undefined),
			credentials:
				injectableCredentials ||
				(body.credentials && typeof body.credentials === 'object'
					? (body.credentials as InjectableCredentials)
					: undefined),
			agentPrompt:
				typeof body.agentPrompt === 'string' ? body.agentPrompt : undefined,
			tools: Array.isArray(body.tools) ? body.tools : undefined,
		};

		try {
			const response = await handleAskRequest(request);
			return c.json(response, 202);
		} catch (err) {
			logger.error('Ask request failed', err);
			const errorResponse = serializeError(err);
			return c.json(errorResponse, errorResponse.error.status || 400);
		}
	});
}
