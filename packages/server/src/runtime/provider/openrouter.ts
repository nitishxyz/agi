import { getOpenRouterInstance, createOpenRouterModel } from '@agi-cli/sdk';

export { getOpenRouterInstance };

export function resolveOpenRouterModel(model: string) {
	return createOpenRouterModel(model);
}
