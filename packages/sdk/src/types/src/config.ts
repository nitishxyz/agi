import type { ProviderId } from './provider';

/**
 * Configuration scope - where settings are stored
 */
export type Scope = 'global' | 'local';

/**
 * Provider-specific configuration
 */
export type ProviderConfig = { enabled: boolean; apiKey?: string };

/**
 * Default settings for the CLI
 */
export type DefaultConfig = {
	agent: string;
	provider: ProviderId;
	model: string;
};

/**
 * Path configuration
 */
export type PathConfig = {
	dataDir: string;
	dbPath: string;
	projectConfigPath: string | null;
	globalConfigPath: string | null;
};

/**
 * Complete AGI configuration object
 */
export type AGIConfig = {
	projectRoot: string;
	defaults: DefaultConfig;
	providers: Record<ProviderId, ProviderConfig>;
	paths: PathConfig;
};
