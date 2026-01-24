import type { AGIConfig } from '@agi-cli/sdk';
import {
	getAuth,
	refreshToken,
	setAuth,
	createAnthropicOAuthModel,
	createAnthropicCachingFetch,
} from '@agi-cli/sdk';
import { createAnthropic } from '@ai-sdk/anthropic';
import { toClaudeCodeName } from '../tools/mapping.ts';

export async function getAnthropicInstance(cfg: AGIConfig) {
	const auth = await getAuth('anthropic', cfg.projectRoot);

	if (auth?.type === 'oauth') {
		let currentAuth = auth;

		if (currentAuth.expires < Date.now()) {
			const tokens = await refreshToken(currentAuth.refresh);
			await setAuth(
				'anthropic',
				{
					type: 'oauth',
					refresh: tokens.refresh,
					access: tokens.access,
					expires: tokens.expires,
				},
				cfg.projectRoot,
				'global',
			);
			currentAuth = {
				type: 'oauth',
				refresh: tokens.refresh,
				access: tokens.access,
				expires: tokens.expires,
			};
		}

		return (model: string) =>
			createAnthropicOAuthModel(model, {
				oauth: currentAuth,
				toolNameTransformer: toClaudeCodeName,
			});
	}

	const cachingFetch = createAnthropicCachingFetch();
	return createAnthropic({
		fetch: cachingFetch as typeof fetch,
	});
}
