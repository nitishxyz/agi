import type {
	ModelInfo,
	ProviderCatalogEntry,
	ProviderId,
} from '../../types/src/index.ts';

type CatalogMap = Partial<Record<ProviderId, ProviderCatalogEntry>>;

const SOLFORGE_ID: ProviderId = 'solforge';
const SOLFORGE_SOURCES: Array<{ id: ProviderId; npm: string }> = [
	{
		id: 'openai',
		npm: '@ai-sdk/openai',
	},
	{
		id: 'anthropic',
		npm: '@ai-sdk/anthropic',
	},
];

function cloneModel(model: ModelInfo): ModelInfo {
	return {
		...model,
		modalities: model.modalities
			? {
					input: model.modalities.input
						? [...model.modalities.input]
						: undefined,
					output: model.modalities.output
						? [...model.modalities.output]
						: undefined,
				}
			: undefined,
		cost: model.cost ? { ...model.cost } : undefined,
		limit: model.limit ? { ...model.limit } : undefined,
		provider: model.provider ? { ...model.provider } : undefined,
	};
}

function buildSolforgeEntry(base: CatalogMap): ProviderCatalogEntry | null {
	const solforgeModels = SOLFORGE_SOURCES.flatMap(({ id, npm }) => {
		const sourceModels = base[id]?.models ?? [];
		return sourceModels.map((model) => {
			const cloned = cloneModel(model);
			cloned.provider = { ...(cloned.provider ?? {}), npm };
			return cloned;
		});
	});

	if (!solforgeModels.length) return null;

	// Prefer OpenAI-family models first so defaults are stable
	solforgeModels.sort((a, b) => {
		const providerA = a.provider?.npm ?? '';
		const providerB = b.provider?.npm ?? '';
		if (providerA === providerB) {
			return a.id.localeCompare(b.id);
		}
		if (providerA === '@ai-sdk/openai') return -1;
		if (providerB === '@ai-sdk/openai') return 1;
		return providerA.localeCompare(providerB);
	});

	const defaultModelId = 'gpt-4o-mini';
	const defaultIdx = solforgeModels.findIndex((m) => m.id === defaultModelId);
	if (defaultIdx > 0) {
		const [picked] = solforgeModels.splice(defaultIdx, 1);
		solforgeModels.unshift(picked);
	}

	return {
		id: SOLFORGE_ID,
		label: 'Solforge',
		env: ['SOLFORGE_PRIVATE_KEY'],
		api: 'https://ai.solforge.sh/v1',
		doc: 'https://ai.solforge.sh/docs',
		npm: '@ai-sdk/openai-compatible',
		models: solforgeModels,
	};
}

export function mergeManualCatalog(
	base: CatalogMap,
): Record<ProviderId, ProviderCatalogEntry> {
	const manualEntry = buildSolforgeEntry(base);
	const merged: Record<ProviderId, ProviderCatalogEntry> = {
		...(base as Record<ProviderId, ProviderCatalogEntry>),
	};
	if (manualEntry) {
		merged[SOLFORGE_ID] = manualEntry;
	}
	return merged;
}
