import { catalog, isBuiltInProviderId } from '@ottocode/sdk';
import type { ProviderName } from '../provider/index.ts';

/**
 * Gets the maximum output tokens allowed for a given provider/model combination.
 * Returns undefined if the information is not available in the catalog.
 */
export function getMaxOutputTokens(
	provider: ProviderName,
	modelId: string,
): number | undefined {
	if (provider === 'copilot') {
		return undefined;
	}
	try {
		if (!isBuiltInProviderId(provider)) {
			return undefined;
		}
		const providerCatalog = catalog[provider];
		if (!providerCatalog) {
			return undefined;
		}
		const modelInfo = providerCatalog.models.find(
			(m: { id: string }) => m.id === modelId,
		);
		if (!modelInfo) {
			return undefined;
		}
		const outputLimit = modelInfo.limit?.output;
		return outputLimit;
	} catch {
		return undefined;
	}
}
