import type { ProviderId } from './provider';

/**
 * Configuration scope - where settings are stored
 */
export type Scope = 'global' | 'local';

/**
 * Default settings for the CLI
 */
export type ToolApprovalMode = 'auto' | 'dangerous' | 'all' | 'yolo';
export type ReasoningLevel =
	| 'minimal'
	| 'low'
	| 'medium'
	| 'high'
	| 'max'
	| 'xhigh';

export type DefaultConfig = {
	agent: string;
	provider: ProviderId;
	model: string;
	toolApproval?: ToolApprovalMode;
	guidedMode?: boolean;
	reasoningText?: boolean;
	reasoningLevel?: ReasoningLevel;
	theme?: string;
	fullWidthContent?: boolean;
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
	debugEnabled?: boolean;
	debugScopes?: string[];
	onboardingComplete?: boolean;
};
