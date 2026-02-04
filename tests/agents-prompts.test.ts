import { describe, it, expect } from 'bun:test';
import { resolveAgentConfig } from '@ottocode/server';

async function read(path: string) {
	const f = Bun.file(path);
	return (await f.text()).trim();
}

describe('agent prompt resolution', () => {
	it('uses code default for known agent (plan)', async () => {
		const cfg = await resolveAgentConfig(process.cwd(), 'plan');
		const file = await read('packages/sdk/src/prompts/src/agents/plan.txt');
		expect(cfg.prompt.trim()).toBe(file);
	});

	it('falls back to build prompt when agent missing', async () => {
		const cfg = await resolveAgentConfig(process.cwd(), 'nonexistent-agent');
		const file = await read('packages/sdk/src/prompts/src/agents/build.txt');
		expect(cfg.prompt.trim()).toBe(file);
	});

	it('prefers local project override if present', async () => {
		const tmp = `${process.cwd()}/.otto/agents/testagent`;
		await Bun.write(`${tmp}/agent.md`, 'PROJECT OVERRIDE TEST');
		const cfg = await resolveAgentConfig(process.cwd(), 'testagent');
		expect(cfg.prompt.trim()).toBe('PROJECT OVERRIDE TEST');
	});
});
