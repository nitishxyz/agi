export function toModelId(provider: string, model: string): string {
	return `${provider}:${model}`;
}

export function parseModelId(modelId: string): {
	provider: string;
	model: string;
} {
	const index = modelId.indexOf(':');
	if (index === -1) return { provider: '', model: modelId };
	return {
		provider: modelId.slice(0, index),
		model: modelId.slice(index + 1),
	};
}
