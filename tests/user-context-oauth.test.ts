import { describe, it, expect } from 'bun:test';
import { composeSystemPrompt } from '@agi-cli/server';

describe('userContext with OAuth/spoof prompt handling', () => {
	it('should include userContext when spoofPrompt is NOT passed', async () => {
		const system = await composeSystemPrompt({
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			projectRoot: process.cwd(),
			agentPrompt: 'You are a test agent.',
			userContext: 'Important user context here',
			spoofPrompt: undefined, // Explicitly not passing spoof
		});

		expect(system).toContain('Important user context here');
		expect(system).toContain('<user-provided-state-context>');
	});

	it('should NOT include userContext when spoofPrompt IS passed (early return)', async () => {
		const system = await composeSystemPrompt({
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			projectRoot: process.cwd(),
			agentPrompt: 'You are a test agent.',
			userContext: 'Important user context here',
			spoofPrompt: 'You are Claude Code.', // Spoof prompt causes early return
		});

		// Should return only the spoof prompt
		expect(system).toBe('You are Claude Code.');
		expect(system).not.toContain('Important user context here');
		expect(system).not.toContain('<user-provided-state-context>');
		expect(system).not.toContain('test agent'); // Should not contain agent prompt either
	});

	it('should compose full prompt with userContext for OAuth double-call pattern', async () => {
		// Simulating the runner.ts pattern for OAuth
		const spoofPrompt = 'You are Claude Code.';

		// First: Get the short spoof for system field
		const shortSystem = spoofPrompt;

		// Second: Get the full prompt for messages array (without passing spoofPrompt)
		const fullPrompt = await composeSystemPrompt({
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			projectRoot: process.cwd(),
			agentPrompt: 'You are a helpful assistant.',
			userContext: 'User is working on project X',
			spoofPrompt: undefined, // Key: don't pass spoofPrompt to get full composition
		});

		// Verify short system is just the spoof
		expect(shortSystem).toBe('You are Claude Code.');

		// Verify full prompt includes everything
		expect(fullPrompt).toContain('helpful assistant');
		expect(fullPrompt).toContain('User is working on project X');
		expect(fullPrompt).toContain('<user-provided-state-context>');

		// Verify full prompt does NOT contain the spoof (it's separate)
		expect(fullPrompt).not.toContain('You are Claude Code.');
	});

	it('should handle empty userContext gracefully with spoof', async () => {
		const system = await composeSystemPrompt({
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			projectRoot: process.cwd(),
			agentPrompt: 'You are a test agent.',
			userContext: '',
			spoofPrompt: 'You are Claude Code.',
		});

		expect(system).toBe('You are Claude Code.');
	});

	it('should handle undefined userContext with spoof', async () => {
		const system = await composeSystemPrompt({
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			projectRoot: process.cwd(),
			agentPrompt: 'You are a test agent.',
			userContext: undefined,
			spoofPrompt: 'You are Claude Code.',
		});

		expect(system).toBe('You are Claude Code.');
	});

	it('should handle whitespace-only userContext with spoof', async () => {
		const system = await composeSystemPrompt({
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			projectRoot: process.cwd(),
			agentPrompt: 'You are a test agent.',
			userContext: '   ',
			spoofPrompt: 'You are Claude Code.',
		});

		expect(system).toBe('You are Claude Code.');
	});
});
