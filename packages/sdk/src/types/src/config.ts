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
 * Complete otto configuration object
 */
export type OttoConfig = {
	projectRoot: string;
	defaults: DefaultConfig;
	paths: PathConfig;
	onboardingComplete?: boolean;
};
