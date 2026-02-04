import { getOpenRouterInstance, createOpenRouterModel } from '@ottocode/sdk';

export { getOpenRouterInstance };

export function resolveOpenRouterModel(model: string) {
	return createOpenRouterModel(model);
}
