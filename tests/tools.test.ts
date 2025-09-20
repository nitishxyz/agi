import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverProjectTools } from '../src/ai/tools/loader.ts';

const pluginSource = `export default async ({ project }) => ({
  name: 'custom_echo',
  description: 'Echo back provided text',
  parameters: {
    text: { type: 'string', description: 'Text to echo' },
    uppercase: { type: 'boolean', default: false }
  },
  async execute({ input }) {
    const value = input.uppercase ? String(input.text).toUpperCase() : input.text;
    return { project, value };
  }
});\n`;

describe('discoverProjectTools', () => {
	it('includes built-in tools and custom JS plugins', async () => {
		const workspaceRoot = await mkdtemp(join(tmpdir(), 'agi-tools-'));
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
			const globalToolDir = join(homeDir, '.config', 'agi', 'tools', 'custom');
			await mkdir(globalToolDir, { recursive: true });
			await writeFile(join(globalToolDir, 'tool.js'), pluginSource);

			const tools = await discoverProjectTools(projectRoot);
			const names = tools.map((t) => t.name).sort();
			expect(names).toContain('custom_echo');
			expect(names).toContain('read');
			expect(names).toContain('git_status');
			const custom = tools.find((t) => t.name === 'custom_echo');
			expect(custom).toBeDefined();
			if (!custom) throw new Error('custom tool not discovered');
			const result = await custom.tool.execute({ text: 'hi', uppercase: true });
			expect(result).toEqual({ project: projectRoot, value: 'HI' });
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
