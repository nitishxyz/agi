import { describe, it, expect } from 'bun:test';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';

async function read(path: string) {
	const f = Bun.file(path);
	return (await f.text()).trim();
}

describe('agent prompt resolution', () => {
	it('uses code default for known agent (plan)', async () => {
		const cfg = await resolveAgentConfig(process.cwd(), 'plan');
		const file = await read('src/prompts/agents/plan.txt');
		expect(cfg.prompt.trim()).toBe(file);
	});

	it('falls back to build prompt when agent missing', async () => {
		const cfg = await resolveAgentConfig(process.cwd(), 'nonexistent-agent');
		const file = await read('src/prompts/agents/build.txt');
		expect(cfg.prompt.trim()).toBe(file);
	});

	it('prefers local project override if present', async () => {
		const tmp = `${process.cwd()}/.agi/agents/testagent`;
		await Bun.write(`${tmp}/agent.md`, 'PROJECT OVERRIDE TEST');
		const cfg = await resolveAgentConfig(process.cwd(), 'testagent');
		expect(cfg.prompt.trim()).toBe('PROJECT OVERRIDE TEST');
	});
});
