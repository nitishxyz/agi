import type { ProviderName } from '@agi-cli/core';

export type AgentConfig = {
	name: string;
	prompt: string;
	tools: string[];
	provider?: ProviderName;
	model?: string;
};

export type AgentConfigEntry = {
	tools?: string[];
	appendTools?: string[];
	prompt?: string;
	provider?: string;
	model?: string;
};

export type AgentsJson = Record<string, AgentConfigEntry>;
