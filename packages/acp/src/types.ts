import type {
	NewSessionRequest,
	PromptResponse,
} from '@agentclientprotocol/sdk';

export const ACP_VERSION = '0.1.196';
export const DEFAULT_MODE = 'general';

export const MODE_OPTIONS = [
	{ id: 'general', name: 'General', description: 'Default coding agent' },
	{ id: 'build', name: 'Build', description: 'Implementation-focused agent' },
	{ id: 'plan', name: 'Plan', description: 'Planning and analysis mode' },
	{ id: 'init', name: 'Init', description: 'Project initialization mode' },
];

export type AcpSession = {
	sessionId: string;
	ottoSessionId: string;
	cwd: string;
	cancelled: boolean;
	assistantMessageId: string | null;
	resolvePrompt: ((response: PromptResponse) => void) | null;
	unsubscribe: (() => void) | null;
	activeTerminals: Map<
		string,
		{ terminalId: string; release: () => Promise<void> }
	>;
	mode: string;
	provider?: string;
	model?: string;
	mcpServers: NewSessionRequest['mcpServers'];
	additionalDirectories: string[];
};
