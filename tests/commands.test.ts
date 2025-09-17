import { describe, expect, it, mock } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type CommandsModule = typeof import('../src/cli/commands.ts');

const runAskMock = mock(async () => {});
mock.module('@/cli/ask.ts', () => ({ runAsk: runAskMock }));

const commandsModulePromise: Promise<CommandsModule> = import(
	'../src/cli/commands.ts'
);

describe('command discovery', () => {
	async function setupWorkspace() {
		const workspaceRoot = await mkdtemp(join(tmpdir(), 'agi-commands-'));
		const projectRoot = join(workspaceRoot, 'project');
		const homeDir = join(workspaceRoot, 'home');
		await mkdir(projectRoot, { recursive: true });
		await mkdir(homeDir, { recursive: true });
		const prevHome = process.env.HOME;
		const prevProfile = process.env.USERPROFILE;
		process.env.HOME = homeDir;
		process.env.USERPROFILE = homeDir;
		return {
			workspaceRoot,
			projectRoot,
			cleanup: async () => {
				if (prevHome === undefined) delete process.env.HOME;
				else process.env.HOME = prevHome;
				if (prevProfile === undefined) delete process.env.USERPROFILE;
				else process.env.USERPROFILE = prevProfile;
				runAskMock.mockReset();
				await rm(workspaceRoot, { recursive: true, force: true });
			},
		};
	}

	it('detects sibling markdown prompt automatically', async () => {
		const { projectRoot, cleanup } = await setupWorkspace();
		try {
			const commandsDir = join(projectRoot, '.agi', 'commands');
			await mkdir(commandsDir, { recursive: true });
			await writeFile(
				join(commandsDir, 'review.json'),
				JSON.stringify({
					name: 'review',
					agent: 'general',
					defaults: { agent: 'general' },
				}),
			);
			await writeFile(join(commandsDir, 'review.md'), 'Review instructions');
			const { discoverCommands } = await commandsModulePromise;
			const commands = await discoverCommands(projectRoot);
			expect(commands.review.promptPath).toBe('review.md');
		} finally {
			await cleanup();
		}
	});

	it('renders markdown prompt with placeholder substitution once', async () => {
		const { projectRoot, cleanup } = await setupWorkspace();
		try {
			const commandsDir = join(projectRoot, '.agi', 'commands');
			await mkdir(commandsDir, { recursive: true });
			await writeFile(
				join(commandsDir, 'summarize.json'),
				JSON.stringify({
					name: 'summarize',
					agent: 'general',
					defaults: { agent: 'general' },
				}),
			);
			await writeFile(
				join(commandsDir, 'summarize.md'),
				'Review the following input:\n\n{input}\n\nThank you.',
			);
			const { runDiscoveredCommand } = await commandsModulePromise;
			const ran = await runDiscoveredCommand(
				'summarize',
				['Consider', 'this', 'diff'],
				projectRoot,
			);
			expect(ran).toBe(true);
			expect(runAskMock.mock.calls.length).toBe(1);
			const [prompt, options] = runAskMock.mock.calls[0];
			expect(prompt).toBe(
				'Review the following input:\n\nConsider this diff\n\nThank you.',
			);
			expect(options.agent).toBe('general');
			expect(options.project).toBe(projectRoot);
		} finally {
			await cleanup();
		}
	});
});
