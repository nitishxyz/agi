import { setuCatalog, type SetuModelCatalogEntry } from '@ottocode/ai-sdk';
import type {
	ModelInfo,
	ModelOwner,
	ProviderCatalogEntry,
	ProviderId,
} from '../../types/src/index.ts';

type CatalogMap = Partial<Record<ProviderId, ProviderCatalogEntry>>;

const SETU_ID: ProviderId = 'setu';

const OWNER_NPM: Record<ModelOwner, string> = {
	openai: '@ai-sdk/openai',
	anthropic: '@ai-sdk/anthropic',
	google: '@ai-sdk/google',
	xai: '@ai-sdk/xai',
	moonshot: '@ai-sdk/openai-compatible',
	zai: '@ai-sdk/openai-compatible',
	minimax: '@ai-sdk/anthropic',
};

function convertSetuModel(m: SetuModelCatalogEntry): ModelInfo {
	const ownedBy = m.owned_by as ModelOwner;
	return {
		id: m.id,
		ownedBy,
		label: m.name,
		modalities: m.modalities,
		toolCall: m.tool_call,
		reasoningText: m.reasoning,
		attachment: m.attachment,
		temperature: m.temperature,
		knowledge: m.knowledge,
		releaseDate: m.release_date,
		lastUpdated: m.last_updated,
		openWeights: m.open_weights,
		cost: {
			input: m.pricing.input,
			output: m.pricing.output,
			cacheRead: m.pricing.cache_read,
			cacheWrite: m.pricing.cache_write,
		},
		limit: {
			context: m.context_length,
			output: m.max_output,
		},
		provider: {
			npm: OWNER_NPM[ownedBy],
		},
	};
}

function buildSetuEntry(): ProviderCatalogEntry | null {
	const setuModels = setuCatalog.models.map(convertSetuModel);

	if (!setuModels.length) return null;

	setuModels.sort((a, b) => {
		const ownerA = a.ownedBy ?? '';
		const ownerB = b.ownedBy ?? '';
		if (ownerA === ownerB) {
			return a.id.localeCompare(b.id);
		}
		if (ownerA === 'openai') return -1;
		if (ownerB === 'openai') return 1;
		return ownerA.localeCompare(ownerB);
	});

	const defaultModelId = 'gpt-5-codex';
	const defaultIdx = setuModels.findIndex((m) => m.id === defaultModelId);
	if (defaultIdx > 0) {
		const [picked] = setuModels.splice(defaultIdx, 1);
		setuModels.unshift(picked);
	}

	return {
		id: SETU_ID,
		label: 'Setu',
		env: ['SETU_PRIVATE_KEY'],
		api: 'https://setu.ottocode.io/v1',
		doc: 'https://setu.ottocode.io/docs',
		models: setuModels,
	};
}

export function mergeManualCatalog(
	base: CatalogMap,
): Record<ProviderId, ProviderCatalogEntry> {
	const manualEntry = buildSetuEntry();
	const merged: Record<ProviderId, ProviderCatalogEntry> = {
		...(base as Record<ProviderId, ProviderCatalogEntry>),
	};
	if (manualEntry) {
		merged[SETU_ID] = manualEntry;
	}
	return merged;
}
