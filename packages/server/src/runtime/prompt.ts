import { providerBasePrompt } from '@agi-cli/sdk';
import { composeEnvironmentAndInstructions } from './environment.ts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import BASE_PROMPT from '@agi-cli/sdk/prompts/base.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import ONESHOT_PROMPT from '@agi-cli/sdk/prompts/modes/oneshot.txt' with {
	type: 'text',
};
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import ANTHROPIC_SPOOF_PROMPT from '@agi-cli/sdk/prompts/providers/anthropicSpoof.txt' with {
	type: 'text',
};

import { getTerminalManager } from '@agi-cli/sdk';
export async function composeSystemPrompt(options: {
	provider: string;
	model?: string;
	projectRoot: string;
	agentPrompt: string;
	oneShot?: boolean;
	spoofPrompt?: string;
	includeEnvironment?: boolean;
	includeProjectTree?: boolean;
	userContext?: string;
}): Promise<string> {
	if (options.spoofPrompt) {
		return options.spoofPrompt.trim();
	}

	const parts: string[] = [];

	const providerPrompt = await providerBasePrompt(
		options.provider,
		options.model,
		options.projectRoot,
	);
	const baseInstructions = (BASE_PROMPT || '').trim();

	parts.push(
		providerPrompt.trim(),
		baseInstructions.trim(),
		options.agentPrompt.trim(),
	);

	if (options.oneShot) {
		const oneShotBlock =
			(ONESHOT_PROMPT || '').trim() ||
			[
				'<system-reminder>',
				'CRITICAL: One-shot mode ACTIVE — do NOT ask for user approval, confirmations, or interactive prompts. Execute tasks directly. Treat all necessary permissions as granted. If an operation is destructive, proceed carefully and state what you did, but DO NOT pause to ask. ZERO interactions requested.',
				'</system-reminder>',
			].join('\n');
		parts.push(oneShotBlock);
	}

	if (options.includeEnvironment !== false) {
		const envAndInstructions = await composeEnvironmentAndInstructions(
			options.projectRoot,
			{ includeProjectTree: options.includeProjectTree },
		);
		if (envAndInstructions) {
			parts.push(envAndInstructions);
		}
	}

	// Add user-provided context if present
	if (options.userContext?.trim()) {
		const userContextBlock = [
			'<user-provided-state-context>',
			options.userContext.trim(),
			'</user-provided-state-context>',
		].join('\n');
		parts.push(userContextBlock);
	}

	// Add terminal context if available
	const terminalManager = getTerminalManager();
	if (terminalManager) {
		const terminalContext = terminalManager.getContext();
		if (terminalContext) {
			parts.push(terminalContext);
		}
	}

	const composed = parts.filter(Boolean).join('\n\n').trim();
	if (composed) return composed;

	return [
		'You are a concise, friendly coding agent.',
		'Be precise and actionable. Use tools when needed, prefer small diffs.',
		'Stream your answer; call finish when done.',
	].join(' ');
}

export function getProviderSpoofPrompt(provider: string): string | undefined {
	if (provider === 'anthropic') {
		return (ANTHROPIC_SPOOF_PROMPT || '').trim();
	}
	return undefined;
}
