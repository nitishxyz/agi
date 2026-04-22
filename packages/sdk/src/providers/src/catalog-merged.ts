import type {
	BuiltInProviderId,
	ProviderCatalogEntry,
} from '../../types/src/index.ts';
import { catalog as generatedCatalog } from './catalog.ts';
import { mergeManualCatalog } from './catalog-manual.ts';

export const catalog: Record<BuiltInProviderId, ProviderCatalogEntry> =
	mergeManualCatalog(generatedCatalog);
