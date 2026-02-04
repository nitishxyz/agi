// ============================================================================
// @ottocode/sdk/browser - Browser-safe exports
// ============================================================================
// This module exports only browser-compatible code (no Bun, no Node.js APIs).
// Use this entry point for web applications like web-sdk.
//
// Usage:
//   import { estimateModelCostUsd, type ProviderId } from '@ottocode/sdk/browser';
// ============================================================================

// Types (pure TypeScript, no runtime dependencies)
export type {
	ProviderId,
	ModelInfo,
	ModelProviderBinding,
	ProviderCatalogEntry,
} from './types/src/index.ts';

// Pricing utilities (pure TypeScript)
export { estimateModelCostUsd } from './providers/src/pricing.ts';

// Catalog data (pure TypeScript)
export { catalog } from './providers/src/catalog-merged.ts';

// Provider utilities (pure TypeScript - imported directly to avoid pulling in Bun deps)
export {
	isProviderId,
	providerIds,
	defaultModelFor,
	hasModel,
	getModelInfo,
} from './providers/src/utils.ts';
