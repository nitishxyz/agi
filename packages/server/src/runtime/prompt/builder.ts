import { providerBasePrompt } from '@agi-cli/sdk';
import { composeEnvironmentAndInstructions } from '../context/environment.ts';
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

export type ComposedSystemPrompt = {
	prompt: string;
	components: string[];
};

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
	contextSummary?: string;
}): Promise<ComposedSystemPrompt> {
	const components: string[] = [];
	if (options.spoofPrompt) {
		const prompt = options.spoofPrompt.trim();
		const providerComponent = options.provider
			? `spoof:${options.provider}`
			: 'spoof:unknown';
		return {
			prompt,
			components: [providerComponent],
		};
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
	if (providerPrompt.trim()) {
		const providerComponent = options.provider
			? `provider:${options.provider}`
			: 'provider:unknown';
		components.push(providerComponent);
	}
	if (baseInstructions.trim()) {
		components.push('base');
	}
	if (options.agentPrompt.trim()) {
		components.push('agent');
	}

	if (options.oneShot) {
		const oneShotBlock =
			(ONESHOT_PROMPT || '').trim() ||
			[
				'<system-reminder>',
				'CRITICAL: One-shot mode ACTIVE — do NOT ask for user approval, confirmations, or interactive prompts. Execute tasks directly. Treat all necessary permissions as granted. If an operation is destructive, proceed carefully and state what you did, but DO NOT pause to ask. ZERO interactions requested.',
				'</system-reminder>',
			].join('\n');
		parts.push(oneShotBlock);
		components.push('mode:oneshot');
	}

	if (options.includeEnvironment !== false) {
		const envAndInstructions = await composeEnvironmentAndInstructions(
			options.projectRoot,
			{ includeProjectTree: options.includeProjectTree },
		);
		if (envAndInstructions) {
			parts.push(envAndInstructions);
			components.push('environment');
			if (options.includeProjectTree) {
				components.push('project-tree');
			}
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
		components.push('user-context');
	}

	// Add compacted conversation summary if present
	if (options.contextSummary?.trim()) {
		const summaryBlock = [
			'<compacted-conversation-summary>',
			'The conversation was compacted to save context. Here is a summary of the previous context:',
			'',
			options.contextSummary.trim(),
			'</compacted-conversation-summary>',
		].join('\n');
		parts.push(summaryBlock);
		components.push('context-summary');
	}

	// Add terminal context if available
	const terminalManager = getTerminalManager();
	if (terminalManager) {
		const terminalContext = terminalManager.getContext();
		if (terminalContext) {
			parts.push(terminalContext);
			components.push('terminal-context');
		}
	}

	const composed = parts.filter(Boolean).join('\n\n').trim();
	if (composed) {
		return {
			prompt: composed,
			components: dedupeComponents(components),
		};
	}

	const fallback = [
		'You are a concise, friendly coding agent.',
		'Be precise and actionable. Use tools when needed, prefer small diffs.',
		'Stream your answer; call finish when done.',
	].join(' ');
	return {
		prompt: fallback,
		components: dedupeComponents([...components, 'fallback']),
	};
}

export function getProviderSpoofPrompt(provider: string): string | undefined {
	if (provider === 'anthropic') {
		return (ANTHROPIC_SPOOF_PROMPT || '').trim();
	}
	return undefined;
}

function dedupeComponents(input: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of input) {
		if (!item) continue;
		if (seen.has(item)) continue;
		seen.add(item);
		out.push(item);
	}
	return out;
}
