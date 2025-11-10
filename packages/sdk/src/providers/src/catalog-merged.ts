import type {
	ProviderCatalogEntry,
	ProviderId,
} from '../../types/src/index.ts';
import { catalog as generatedCatalog } from './catalog.ts';
import { mergeManualCatalog } from './catalog-manual.ts';

export const catalog: Record<ProviderId, ProviderCatalogEntry> =
	mergeManualCatalog(generatedCatalog);
