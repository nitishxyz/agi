import { catalog } from './catalog.ts';
import type { ProviderId } from '@agi-cli/types';

export const providerIds = Object.keys(catalog) as ProviderId[];

export function isProviderId(value: unknown): value is ProviderId {
	return typeof value === 'string' && providerIds.includes(value as ProviderId);
}

export function defaultModelFor(provider: ProviderId): string | undefined {
	return catalog[provider]?.models?.[0]?.id;
}

export function listModels(provider: ProviderId): string[] {
	return (catalog[provider]?.models ?? []).map((m) => m.id);
}

export function hasModel(
	provider: ProviderId,
	model: string | undefined,
): boolean {
	if (!model) return false;
	return listModels(provider).includes(model);
}
