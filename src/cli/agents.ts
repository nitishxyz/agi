import { intro } from '@clack/prompts';
import { editAgentsConfig } from '@/cli/scaffold.ts';
import { getGlobalConfigDir } from '@/config/paths.ts';

export async function runAgents(
	opts: { project?: string; local?: boolean } = {},
) {
	const projectRoot = (opts.project ?? process.cwd()).replace(/\\/g, '/');
	const baseDir = opts.local ? `${projectRoot}/.agi` : getGlobalConfigDir();
	const scopeLabel = opts.local ? 'local' : 'global';
	intro(`Agents (${scopeLabel})`);
	await editAgentsConfig(projectRoot, baseDir, scopeLabel);
}
