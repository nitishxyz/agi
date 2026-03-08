import type { ProviderId } from './provider';

/**
 * Configuration scope - where settings are stored
 */
export type Scope = 'global' | 'local';

/**
 * Default settings for the CLI
 */
export type ToolApprovalMode = 'auto' | 'dangerous' | 'all';

export type DefaultConfig = {
	agent: string;
	provider: ProviderId;
	model: string;
	toolApproval?: ToolApprovalMode;
	guidedMode?: boolean;
	reasoningText?: boolean;
	theme?: string;
};

export type ProviderSettings = Record<
	ProviderId,
	{
		enabled: boolean;
		apiKey?: string;
	}
>;

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
 * Complete otto configuration object
 */
export type OttoConfig = {
	projectRoot: string;
	defaults: DefaultConfig;
	providers: ProviderSettings;
	paths: PathConfig;
	onboardingComplete?: boolean;
};
