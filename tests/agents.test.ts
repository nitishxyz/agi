import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveAgentConfig } from '@agi-cli/server';

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
		process.env.XDG_CONFIG_HOME = join(homeDir, '.config');

		try {
			await mkdir(join(homeDir, '.config', 'agi'), { recursive: true });
			await writeFile(
				join(homeDir, '.config', 'agi', 'agents.json'),
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
			expect(cfg.tools).toContain('read');
		} finally {
			if (prevHome === undefined) delete process.env.HOME;
			else process.env.HOME = prevHome;
			if (prevProfile === undefined) delete process.env.USERPROFILE;
			else process.env.USERPROFILE = prevProfile;
			await rm(workspaceRoot, { recursive: true, force: true });
		}
	});

	it('resolves provider and model from configuration layers', async () => {
		const workspaceRoot = await mkdtemp(join(tmpdir(), 'agi-agents-'));
		const projectRoot = join(workspaceRoot, 'project');
		const homeDir = join(workspaceRoot, 'home');
		await mkdir(projectRoot, { recursive: true });
		await mkdir(homeDir, { recursive: true });
		const prevHome = process.env.HOME;
		const prevProfile = process.env.USERPROFILE;
		const prevXdg = process.env.XDG_CONFIG_HOME;
		process.env.HOME = homeDir;
		process.env.USERPROFILE = homeDir;
		process.env.XDG_CONFIG_HOME = join(homeDir, '.config');
		try {
			const globalAgiDir = join(homeDir, '.config', 'agi');
			await mkdir(globalAgiDir, { recursive: true });
			await writeFile(
				join(globalAgiDir, 'agents.json'),
				JSON.stringify({
					coder: {
						provider: 'anthropic',
						model: 'claude-3-sonnet-20240229',
					},
				}),
			);
			await mkdir(join(projectRoot, '.agi'), { recursive: true });
			await writeFile(
				join(projectRoot, '.agi', 'agents.json'),
				JSON.stringify({
					coder: {
						model: 'claude-3-5-sonnet-20241022',
					},
				}),
			);
			const cfg = await resolveAgentConfig(projectRoot, 'coder');
			expect(cfg.provider).toBe('anthropic');
			expect(cfg.model).toBe('claude-3-5-sonnet-20241022');
		} finally {
			if (prevHome === undefined) delete process.env.HOME;
			else process.env.HOME = prevHome;
			if (prevProfile === undefined) delete process.env.USERPROFILE;
			else process.env.USERPROFILE = prevProfile;
			if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = prevXdg;
			await rm(workspaceRoot, { recursive: true, force: true });
		}
	});
});
