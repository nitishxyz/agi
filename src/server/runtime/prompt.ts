import { providerBasePrompt } from '@/prompts/providers.ts';

async function readTextIfExists(path: string): Promise<string> {
	try {
		const f = Bun.file(path);
		if (await f.exists()) return (await f.text()).trim();
	} catch {}
	return '';
}

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
	const baseInstructions = await readTextIfExists('src/prompts/base.txt');

	const parts = [
		providerPrompt.trim(),
		baseInstructions.trim(),
		options.agentPrompt.trim(),
	].filter(Boolean);

	if (options.oneShot) {
		let oneShotBlock = await readTextIfExists('src/prompts/modes/oneshot.txt');
		if (!oneShotBlock) {
			oneShotBlock = [
				'<system-reminder>',
				'CRITICAL: One-shot mode ACTIVE — do NOT ask for user approval, confirmations, or interactive prompts. Execute tasks directly. Treat all necessary permissions as granted. If an operation is destructive, proceed carefully and state what you did, but DO NOT pause to ask. ZERO interactions requested.',
				'</system-reminder>',
			].join('\n');
		}
		parts.push(oneShotBlock);
	}

	return parts.join('\n\n');
}
