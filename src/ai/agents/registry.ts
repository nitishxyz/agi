import { defaultAgentPrompts } from '@/ai/agents/defaults.ts';

export type AgentConfig = {
	name: string;
	prompt: string;
	tools: string[]; // allowed tool names
};

type AgentsJson = Record<string, { tools?: string[]; prompt?: string }>;

export async function loadAgentsConfig(
	projectRoot: string,
): Promise<AgentsJson> {
	const localPath = `${projectRoot}/.agi/agents.json`.replace(/\\/g, '/');
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const globalPath = `${home}/.agi/agents.json`.replace(/\\/g, '/');
	let globalCfg: AgentsJson = {};
	let localCfg: AgentsJson = {};
	try {
		const gf = Bun.file(globalPath);
		if (await gf.exists())
			globalCfg = (await gf.json().catch(() => ({}))) as AgentsJson;
	} catch {}
	try {
		const lf = Bun.file(localPath);
		if (await lf.exists())
			localCfg = (await lf.json().catch(() => ({}))) as AgentsJson;
	} catch {}
	// Merge: global then local (local overrides global)
	return { ...globalCfg, ...localCfg };
}

export async function resolveAgentConfig(
	projectRoot: string,
	name: string,
): Promise<AgentConfig> {
	const agents = await loadAgentsConfig(projectRoot);
	const entry = agents[name];
	let prompt = defaultAgentPrompts[name] ?? defaultAgentPrompts.general;

	// Override files: project first, then global
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const localDir = `${projectRoot}/.agi/agents/${name}/agent.txt`.replace(
		/\\/g,
		'/',
	);
	const localFlat = `${projectRoot}/.agi/agents/${name}.txt`.replace(
		/\\/g,
		'/',
	);
	const globalDir = `${home}/.agi/agents/${name}/agent.txt`.replace(/\\/g, '/');
	const globalFlat = `${home}/.agi/agents/${name}.txt`.replace(/\\/g, '/');
	const files = [localDir, localFlat, globalDir, globalFlat];
	for (const p of files) {
		try {
			const f = Bun.file(p);
			if (await f.exists()) {
				const text = await f.text();
				if (text.trim()) {
					prompt = text;
					break;
				}
			}
		} catch {}
	}

	// If agents.json provides a 'prompt' field, accept inline content or a relative/absolute path
	if (entry?.prompt) {
		const p = entry.prompt.trim();
		if (p.endsWith('.txt') || p.startsWith('.') || p.startsWith('/')) {
			const pf = Bun.file(`${projectRoot}/${p}`.replace(/\\/g, '/'));
			if (await pf.exists()) {
				const t = await pf.text();
				if (t.trim()) prompt = t;
			}
		} else {
			prompt = p;
		}
	}

	// Default tool access per agent if not explicitly configured
	let tools = (entry?.tools ?? []) as string[];
	if (!entry || !entry.tools) {
		if (name === 'build') {
			tools = ['fs_read', 'fs_write', 'fs_ls', 'fs_tree', 'finalize'];
		} else if (name === 'plan') {
			tools = ['fs_read', 'fs_ls', 'fs_tree', 'finalize'];
		} else if (name === 'git' || name === 'commit') {
			tools = [
				'git_status',
				'git_diff',
				'git_commit',
				'fs_read',
				'fs_ls',
				'finalize',
			];
		} else {
			tools = ['finalize'];
		}
	}
	return { name, prompt, tools };
}
