import type {
	ModelInfo,
	ProviderCatalogEntry,
	ProviderId,
	ProviderFamily,
} from '../../types/src/index.ts';

type CatalogMap = Partial<Record<ProviderId, ProviderCatalogEntry>>;

const SETU_ID: ProviderId = 'setu';

const isAllowedOpenAIModel = (id: string): boolean => {
	if (id === 'codex-mini-latest') return true;
	if (id.startsWith('gpt-5')) return true;
	if (id.includes('codex')) return true;
	return false;
};

const isAllowedAnthropicModel = (id: string): boolean => {
	if (id.includes('-3-5-') || id.includes('-3.5-')) return true;
	if (id.match(/claude-(haiku|sonnet|opus)-3/)) return true;
	if (id.includes('-4-') || id.includes('-4.')) return true;
	if (id.match(/claude-(haiku|sonnet|opus)-4/)) return true;
	return false;
};

const isAllowedGoogleModel = (id: string): boolean => {
	if (id.startsWith('gemini-3')) return true;
	return false;
};

const SETU_SOURCES: Array<{
	id: ProviderId;
	npm: string;
	family: ProviderFamily;
}> = [
	{
		id: 'openai',
		npm: '@ai-sdk/openai',
		family: 'openai',
	},
	{
		id: 'anthropic',
		npm: '@ai-sdk/anthropic',
		family: 'anthropic',
	},
	{
		id: 'moonshot',
		npm: '@ai-sdk/openai-compatible',
		family: 'moonshot',
	},
	{
		id: 'google',
		npm: '@ai-sdk/google',
		family: 'google',
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

function buildSetuEntry(base: CatalogMap): ProviderCatalogEntry | null {
	const setuModels = SETU_SOURCES.flatMap(({ id, npm, family }) => {
		const allModels = base[id]?.models ?? [];
		const sourceModels = allModels.filter((model) => {
		if (id === 'openai') return isAllowedOpenAIModel(model.id);
			if (id === 'anthropic') return isAllowedAnthropicModel(model.id);
			if (id === 'google') return isAllowedGoogleModel(model.id);
			return true;
		});
		return sourceModels.map((model) => {
			const cloned = cloneModel(model);
			cloned.provider = { ...(cloned.provider ?? {}), npm, family };
			return cloned;
		});
	});

	if (!setuModels.length) return null;

	setuModels.sort((a, b) => {
		const providerA = a.provider?.npm ?? '';
		const providerB = b.provider?.npm ?? '';
		if (providerA === providerB) {
			return a.id.localeCompare(b.id);
		}
		if (providerA === '@ai-sdk/openai') return -1;
		if (providerB === '@ai-sdk/openai') return 1;
		return providerA.localeCompare(providerB);
	});

	const defaultModelId = 'codex-mini-latest';
	const defaultIdx = setuModels.findIndex((m) => m.id === defaultModelId);
	if (defaultIdx > 0) {
		const [picked] = setuModels.splice(defaultIdx, 1);
		setuModels.unshift(picked);
	}

	return {
		id: SETU_ID,
		label: 'Setu',
		env: ['SETU_PRIVATE_KEY'],
		api: 'https://setu.agi.nitish.sh/v1',
		doc: 'https://setu.agi.nitish.sh/docs',
		models: setuModels,
	};
}

export function mergeManualCatalog(
	base: CatalogMap,
): Record<ProviderId, ProviderCatalogEntry> {
	const manualEntry = buildSetuEntry(base);
	const merged: Record<ProviderId, ProviderCatalogEntry> = {
		...(base as Record<ProviderId, ProviderCatalogEntry>),
	};
	if (manualEntry) {
		merged[SETU_ID] = manualEntry;
	}
	return merged;
}
