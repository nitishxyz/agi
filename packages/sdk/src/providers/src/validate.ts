import { catalog } from './catalog-merged.ts';
import { getCachedProviderCatalogEntry } from './model-catalog-cache.ts';
import type { OttoConfig, ProviderId } from '../../types/src/index.ts';
import {
	getProviderDefinition,
	getConfiguredProviderModels,
	hasConfiguredModel,
	providerAllowsAnyModel,
} from './registry.ts';

export type CapabilityRequest = {
	wantsToolCalls?: boolean;
	wantsVision?: boolean; // input image
};

export function validateProviderModel(
	provider: string,
	model: string,
	cfgOrCap?: OttoConfig | CapabilityRequest,
	cap?: CapabilityRequest,
) {
	const cfg = isOttoConfigLike(cfgOrCap) ? cfgOrCap : undefined;
	const effectiveCap = isOttoConfigLike(cfgOrCap) ? cap : cfgOrCap;

	if (cfg) {
		const definition = getProviderDefinition(cfg, provider);
		if (!definition) {
			throw new Error(`Provider not supported: ${provider}`);
		}
		if (!providerAllowsAnyModel(cfg, provider)) {
			if (!hasConfiguredModel(cfg, provider, model)) {
				const list = getConfiguredProviderModels(cfg, provider)
					.slice(0, 10)
					.map((m) => m.id)
					.join(', ');
				throw new Error(
					`Model not found for provider ${provider}: ${model}. Example models: ${list}${getConfiguredProviderModels(cfg, provider).length > 10 ? ', ...' : ''}`,
				);
			}
		}

		const entry = definition.models.find((m) => m.id === model);
		if (entry) {
			applyCapabilityValidation(model, entry, effectiveCap, {
				strict: definition.source !== 'custom',
			});
		}
		return;
	}

	const p = provider as ProviderId;
	if (!catalog[p]) {
		throw new Error(`Provider not supported: ${provider}`);
	}
	const models = getCachedProviderCatalogEntry(p)?.models ?? catalog[p].models;
	const entry = models.find((m) => m.id === model);
	if (!entry) {
		const list = models
			.slice(0, 10)
			.map((m) => m.id)
			.join(', ');
		throw new Error(
			`Model not found for provider ${provider}: ${model}. Example models: ${list}${models.length > 10 ? ', ...' : ''}`,
		);
	}
	applyCapabilityValidation(model, entry, effectiveCap, { strict: true });
}

function applyCapabilityValidation(
	model: string,
	entry: {
		toolCall?: boolean;
		modalities?: { input?: string[]; output?: string[] };
	},
	cap: CapabilityRequest | undefined,
	options: { strict: boolean },
) {
	if (cap?.wantsToolCalls && entry.toolCall === false) {
		throw new Error(`Model ${model} does not support tool calls.`);
	}
	if (!options.strict && cap?.wantsToolCalls && entry.toolCall === undefined) {
		return;
	}
	if (cap?.wantsVision) {
		if (!options.strict && !entry.modalities) return;
		const inputs = entry.modalities?.input as string[] | undefined;
		const outputs = entry.modalities?.output as string[] | undefined;
		const ok =
			(inputs ?? []).includes('image') || (outputs ?? []).includes('image');
		if (!ok)
			throw new Error(`Model ${model} does not support vision input/output.`);
	}
}

function isOttoConfigLike(value: unknown): value is OttoConfig {
	return Boolean(
		value &&
			typeof value === 'object' &&
			'defaults' in value &&
			'providers' in value,
	);
}
