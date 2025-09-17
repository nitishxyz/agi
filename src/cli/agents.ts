import { intro } from '@clack/prompts';
import { editAgentsConfig } from '@/cli/scaffold.ts';

export async function runAgents(
	opts: { project?: string; local?: boolean } = {},
) {
	const projectRoot = (opts.project ?? process.cwd()).replace(/\\/g, '/');
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const baseDir = opts.local ? `${projectRoot}/.agi` : `${home}/.agi`;
	const scopeLabel = opts.local ? 'local' : 'global';
	intro(`Agents (${scopeLabel})`);
	await editAgentsConfig(projectRoot, baseDir, scopeLabel);
}
