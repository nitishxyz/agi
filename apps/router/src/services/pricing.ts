import { catalog, type ProviderId, type ModelInfo, type ModelCost } from '../catalog';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export function getModelInfo(modelId: string): { provider: ProviderId; model: ModelInfo } | null {
  for (const [providerId, entry] of Object.entries(catalog)) {
    const model = entry.models.find((m) => m.id === modelId);
    if (model) {
      return { provider: providerId as ProviderId, model };
    }
  }
  return null;
}

export function getModelPricing(modelId: string): ModelCost | null {
  const info = getModelInfo(modelId);
  return info?.model.cost ?? null;
}

export function resolveProvider(modelId: string): ProviderId | null {
  const info = getModelInfo(modelId);
  return info?.provider ?? null;
}

export function calculateCost(modelId: string, usage: TokenUsage, markup: number): number {
  const pricing = getModelPricing(modelId);
  
  if (!pricing) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const inputRate = pricing.input ?? 0;
  const outputRate = pricing.output ?? 0;
  const cacheReadRate = pricing.cacheRead ?? inputRate;
  const cacheWriteRate = pricing.cacheWrite ?? inputRate;

  const cacheReadTokens = usage.cachedInputTokens ?? 0;
  const cacheWriteTokens = usage.cacheCreationInputTokens ?? 0;

  const inputCost = (usage.inputTokens / 1_000_000) * inputRate;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * cacheReadRate;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * cacheWriteRate;
  const outputCost = (usage.outputTokens / 1_000_000) * outputRate;

  return (inputCost + cacheReadCost + cacheWriteCost + outputCost) * markup;
}
