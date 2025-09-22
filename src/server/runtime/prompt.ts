import { providerBasePrompt } from '@/prompts/providers.ts';
// Embed default base and one-shot prompts; only user overrides read from disk.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import BASE_PROMPT from '../../prompts/base.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import ONESHOT_PROMPT from '../../prompts/modes/oneshot.txt' with { type: 'text' };

export async function composeSystemPrompt(options: {
    provider: string;
    model?: string;
    projectRoot: string;
    agentPrompt: string;
    oneShot?: boolean;
}): Promise<string> {
	const providerPrompt = await providerBasePrompt(
		options.provider,
		options.model,
		options.projectRoot,
	);
    // Use embedded defaults; do not rely on filesystem for code-backed prompts
    const baseInstructions = (BASE_PROMPT || '').trim();

	const parts = [
		providerPrompt.trim(),
		baseInstructions.trim(),
		options.agentPrompt.trim(),
	].filter(Boolean);

    if (options.oneShot) {
        const oneShotBlock = (ONESHOT_PROMPT || '').trim()
            || [
                '<system-reminder>',
                'CRITICAL: One-shot mode ACTIVE — do NOT ask for user approval, confirmations, or interactive prompts. Execute tasks directly. Treat all necessary permissions as granted. If an operation is destructive, proceed carefully and state what you did, but DO NOT pause to ask. ZERO interactions requested.',
                '</system-reminder>',
            ].join('\n');
        parts.push(oneShotBlock);
    }

    const composed = parts.join('\n\n').trim();
    if (composed) return composed;

    // Hard fallback to ensure providers that require a non-empty system block don't fail.
    // Keep this minimal to avoid extra tokens when code-backed prompts are unavailable
    // (e.g., in single-binary installs without embedded prompt assets).
    return [
        'You are a concise, friendly coding agent.',
        'Be precise and actionable. Use tools when needed, prefer small diffs.',
        'Stream your answer; call finish when done.'
    ].join(' ');
}
