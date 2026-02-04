import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveAgentConfig } from '@ottocode/server';

describe('agent config merging', () => {
	it('combines default and appended tools from global and local configs', async () => {
		const workspaceRoot = await mkdtemp(join(tmpdir(), 'otto-agents-'));
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
			await mkdir(join(homeDir, '.config', 'otto'), { recursive: true });
			await writeFile(
				join(homeDir, '.config', 'otto', 'agents.json'),
				JSON.stringify({
					build: { appendTools: ['ripgrep'] },
				}),
			);
			await mkdir(join(projectRoot, '.otto'), { recursive: true });
			await writeFile(
				join(projectRoot, '.otto', 'agents.json'),
				JSON.stringify({
					build: { prompt: '.otto/agents/build.md' },
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
		const workspaceRoot = await mkdtemp(join(tmpdir(), 'otto-agents-'));
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
			const globalOttoDir = join(homeDir, '.config', 'otto');
			await mkdir(globalOttoDir, { recursive: true });
			await writeFile(
				join(globalOttoDir, 'agents.json'),
				JSON.stringify({
					coder: {
						provider: 'anthropic',
						model: 'claude-3-sonnet-20240229',
					},
				}),
			);
			await mkdir(join(projectRoot, '.otto'), { recursive: true });
			await writeFile(
				join(projectRoot, '.otto', 'agents.json'),
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
