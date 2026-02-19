import type { ProviderId, ProviderConfig, ProviderApiFormat } from '../types.ts';

const BUILTIN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    apiFormat: 'openai-responses',
    modelPrefix: 'gpt-',
  },
  {
    id: 'openai',
    apiFormat: 'openai-responses',
    modelPrefix: 'o1',
  },
  {
    id: 'openai',
    apiFormat: 'openai-responses',
    modelPrefix: 'o3',
  },
  {
    id: 'openai',
    apiFormat: 'openai-responses',
    modelPrefix: 'o4',
  },
  {
    id: 'openai',
    apiFormat: 'openai-responses',
    modelPrefix: 'codex-',
  },
  {
    id: 'anthropic',
    apiFormat: 'anthropic-messages',
    modelPrefix: 'claude-',
  },
  {
    id: 'google',
    apiFormat: 'google-native',
    modelPrefix: 'gemini-',
  },
  {
    id: 'moonshot',
    apiFormat: 'openai-chat',
    modelPrefix: 'kimi-',
  },
  {
    id: 'minimax',
    apiFormat: 'anthropic-messages',
    modelPrefix: 'MiniMax-',
  },
  {
    id: 'zai',
    apiFormat: 'openai-chat',
    modelPrefix: 'glm-',
  },
  {
    id: 'zai',
    apiFormat: 'openai-chat',
    modelPrefix: 'z1-',
  },
];

export class ProviderRegistry {
  private configs: ProviderConfig[];
  private modelMap: Record<string, ProviderId>;

  constructor(
    customProviders?: ProviderConfig[],
    modelMap?: Record<string, ProviderId>,
  ) {
    this.configs = [...BUILTIN_PROVIDERS, ...(customProviders ?? [])];
    this.modelMap = modelMap ?? {};
  }

  resolve(modelId: string): { providerId: ProviderId; apiFormat: ProviderApiFormat } | null {
    if (this.modelMap[modelId]) {
      const providerId = this.modelMap[modelId];
      const config = this.configs.find((c) => c.id === providerId);
      return {
        providerId,
        apiFormat: config?.apiFormat ?? 'openai-chat',
      };
    }

    for (const config of this.configs) {
      if (config.models?.includes(modelId)) {
        return { providerId: config.id, apiFormat: config.apiFormat };
      }
    }

    for (const config of this.configs) {
      if (config.modelPrefix && modelId.startsWith(config.modelPrefix)) {
        return { providerId: config.id, apiFormat: config.apiFormat };
      }
    }

    return null;
  }

  register(config: ProviderConfig): void {
    this.configs.push(config);
  }

  mapModel(modelId: string, providerId: ProviderId): void {
    this.modelMap[modelId] = providerId;
  }
}
