import {
	ottorouterCatalog,
	type OttoRouterModelCatalogEntry,
} from '@ottorouter/ai-sdk';
import type {
	ModelInfo,
	ModelOwner,
	ProviderCatalogEntry,
	ProviderId,
} from '../../types/src/index.ts';

type CatalogMap = Partial<Record<ProviderId, ProviderCatalogEntry>>;

const OTTOROUTER_ID: ProviderId = 'ottorouter';

const OWNER_NPM: Record<ModelOwner, string> = {
	openai: '@ai-sdk/openai',
	anthropic: '@ai-sdk/anthropic',
	google: '@ai-sdk/google',
	openrouter: '@openrouter/ai-sdk-provider',
	xai: '@ai-sdk/xai',
	moonshot: '@ai-sdk/openai-compatible',
	zai: '@ai-sdk/openai-compatible',
	minimax: '@ai-sdk/anthropic',
};

function convertOttoRouterModel(m: OttoRouterModelCatalogEntry): ModelInfo {
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

function buildOttoRouterEntry(): ProviderCatalogEntry | null {
	const ottorouterModels = ottorouterCatalog.models.map(convertOttoRouterModel);

	if (!ottorouterModels.length) return null;

	ottorouterModels.sort((a, b) => {
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
	const defaultIdx = ottorouterModels.findIndex((m) => m.id === defaultModelId);
	if (defaultIdx > 0) {
		const [picked] = ottorouterModels.splice(defaultIdx, 1);
		ottorouterModels.unshift(picked);
	}

	return {
		id: OTTOROUTER_ID,
		label: 'OttoRouter',
		env: ['OTTOROUTER_PRIVATE_KEY'],
		api: 'https://api.ottorouter.org/v1',
		doc: 'https://ottorouter.org/docs',
		models: ottorouterModels,
	};
}

export function mergeManualCatalog(
	base: CatalogMap,
): Record<ProviderId, ProviderCatalogEntry> {
	const manualEntry = buildOttoRouterEntry();
	const merged: Record<ProviderId, ProviderCatalogEntry> = {
		...(base as Record<ProviderId, ProviderCatalogEntry>),
	};
	if (manualEntry) {
		merged[OTTOROUTER_ID] = manualEntry;
	}
	return merged;
}
