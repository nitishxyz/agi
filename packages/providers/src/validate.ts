import { catalog, type ProviderId } from './catalog.ts';

export type CapabilityRequest = {
	wantsToolCalls?: boolean;
	wantsVision?: boolean; // input image
};

export function validateProviderModel(
	provider: string,
	model: string,
	cap?: CapabilityRequest,
) {
	const p = provider as ProviderId;
	if (!catalog[p]) {
		throw new Error(`Provider not supported: ${provider}`);
	}
	const entry = catalog[p].models.find((m) => m.id === model);
	if (!entry) {
		const list = catalog[p].models
			.slice(0, 10)
			.map((m) => m.id)
			.join(', ');
		throw new Error(
			`Model not found for provider ${provider}: ${model}. Example models: ${list}${catalog[p].models.length > 10 ? ', ...' : ''}`,
		);
	}
	if (cap?.wantsToolCalls && !entry.toolCall) {
		throw new Error(`Model ${model} does not support tool calls.`);
	}
	if (cap?.wantsVision) {
		const inputs = entry.modalities?.input ?? [];
		const outputs = entry.modalities?.output ?? [];
		const ok = inputs.includes('image') || outputs.includes('image');
		if (!ok)
			throw new Error(`Model ${model} does not support vision input/output.`);
	}
}
