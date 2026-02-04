import { catalog } from '@ottocode/sdk';
import { debugLog } from '../debug/index.ts';
import type { ProviderName } from '../provider/index.ts';

/**
 * Gets the maximum output tokens allowed for a given provider/model combination.
 * Returns undefined if the information is not available in the catalog.
 */
export function getMaxOutputTokens(
	provider: ProviderName,
	modelId: string,
): number | undefined {
	try {
		const providerCatalog = catalog[provider];
		if (!providerCatalog) {
			debugLog(`[maxOutputTokens] No catalog found for provider: ${provider}`);
			return undefined;
		}
		const modelInfo = providerCatalog.models.find((m) => m.id === modelId);
		if (!modelInfo) {
			debugLog(
				`[maxOutputTokens] No model info found for: ${modelId} in provider: ${provider}`,
			);
			return undefined;
		}
		const outputLimit = modelInfo.limit?.output;
		debugLog(
			`[maxOutputTokens] Provider: ${provider}, Model: ${modelId}, Limit: ${outputLimit}`,
		);
		return outputLimit;
	} catch (err) {
		debugLog(`[maxOutputTokens] Error looking up limit: ${err}`);
		return undefined;
	}
}
