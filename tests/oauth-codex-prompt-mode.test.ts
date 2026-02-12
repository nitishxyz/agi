import { describe, expect, test } from 'bun:test';
import { composeSystemPrompt } from '../packages/server/src/runtime/prompt/builder.ts';

describe('oauth codex prompt mode', () => {
	test('uses dedicated oauth prompt without base finish contract', async () => {
		const result = await composeSystemPrompt({
			provider: 'openai',
			model: 'gpt-5.3-codex',
			projectRoot: process.cwd(),
			agentPrompt: '',
			includeEnvironment: false,
			isOpenAIOAuth: true,
		});

		expect(result.components).toContain('provider:openai-oauth');
		expect(result.components).not.toContain('base');
		expect(result.prompt.toLowerCase()).not.toContain(
			'must call the `finish` tool',
		);
		expect(result.prompt.toLowerCase()).not.toContain(
			'must call the finish tool',
		);
	});

	test('keeps base prompt for non-oauth openai', async () => {
		const result = await composeSystemPrompt({
			provider: 'openai',
			model: 'gpt-5.3-codex',
			projectRoot: process.cwd(),
			agentPrompt: '',
			includeEnvironment: false,
			isOpenAIOAuth: false,
		});

		expect(result.components).toContain('base');
		expect(result.components).not.toContain('provider:openai-oauth');
		expect(result.prompt.toLowerCase()).toContain('must call');
		expect(result.prompt.toLowerCase()).toContain('finish');
	});
});
