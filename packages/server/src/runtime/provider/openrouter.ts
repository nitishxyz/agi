import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export function getOpenRouterInstance() {
	const apiKey = process.env.OPENROUTER_API_KEY ?? '';
	return createOpenRouter({ apiKey });
}

export function resolveOpenRouterModel(model: string) {
	const openrouter = getOpenRouterInstance();
	return openrouter.chat(model);
}
