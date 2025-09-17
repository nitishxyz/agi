import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveAgentConfig } from '../src/ai/agents/registry.ts';

describe('agent config merging', () => {
	it('combines default and appended tools from global and local configs', async () => {
		const workspaceRoot = await mkdtemp(join(tmpdir(), 'agi-agents-'));
		const projectRoot = join(workspaceRoot, 'project');
		const homeDir = join(workspaceRoot, 'home');
		await mkdir(projectRoot, { recursive: true });
		await mkdir(homeDir, { recursive: true });
		const prevHome = process.env.HOME;
		const prevProfile = process.env.USERPROFILE;
		process.env.HOME = homeDir;
		process.env.USERPROFILE = homeDir;

		try {
			await mkdir(join(homeDir, '.agi'), { recursive: true });
			await writeFile(
				join(homeDir, '.agi', 'agents.json'),
				JSON.stringify({
					build: { appendTools: ['ripgrep'] },
				}),
			);
			await mkdir(join(projectRoot, '.agi'), { recursive: true });
			await writeFile(
				join(projectRoot, '.agi', 'agents.json'),
				JSON.stringify({
					build: { prompt: '.agi/agents/build.md' },
				}),
			);

			const cfg = await resolveAgentConfig(projectRoot, 'build');
			expect(cfg.tools).toContain('ripgrep');
			expect(cfg.tools).toContain('fs_read');
		} finally {
			if (prevHome === undefined) delete process.env.HOME;
			else process.env.HOME = prevHome;
			if (prevProfile === undefined) delete process.env.USERPROFILE;
			else process.env.USERPROFILE = prevProfile;
			await rm(workspaceRoot, { recursive: true, force: true });
		}
	});
});
