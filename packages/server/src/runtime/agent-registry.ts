import { getGlobalAgentsJsonPath, getGlobalAgentsDir } from '@agi-cli/sdk';
import { debugLog } from './debug.ts';
import type { ProviderName } from '@agi-cli/sdk';
import { catalog } from '@agi-cli/sdk';
// Embed default agent prompts; only user overrides read from disk.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import AGENT_BUILD from '@agi-cli/sdk/prompts/agents/build.txt' with {
	type: 'text',
};
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import AGENT_PLAN from '@agi-cli/sdk/prompts/agents/plan.txt' with {
	type: 'text',
};
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import AGENT_GENERAL from '@agi-cli/sdk/prompts/agents/general.txt' with {
	type: 'text',
};

export type AgentConfig = {
	name: string;
	prompt: string;
	tools: string[]; // allowed tool names
	provider?: ProviderName;
	model?: string;
};

export type AgentConfigEntry = {
	tools?: string[];
	appendTools?: string[];
	prompt?: string;
	provider?: string;
	model?: string;
};

type AgentsJson = Record<string, AgentConfigEntry>;

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') continue;
		const trimmed = item.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
	}
	return out;
}

const providerValues = new Set<ProviderName>(
	Object.keys(catalog) as ProviderName[],
);

function normalizeProvider(value: unknown): ProviderName | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return undefined;
	return providerValues.has(trimmed as ProviderName)
		? (trimmed as ProviderName)
		: undefined;
}

function normalizeModel(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}

function mergeAgentEntries(
	base: AgentConfigEntry | undefined,
	override: AgentConfigEntry,
): AgentConfigEntry {
	const merged: AgentConfigEntry = {};
	const baseTools = normalizeStringList(base?.tools);
	if (baseTools.length) merged.tools = [...baseTools];
	const baseAppend = normalizeStringList(base?.appendTools);
	if (baseAppend.length) merged.appendTools = [...baseAppend];
	if (base && Object.hasOwn(base, 'prompt')) merged.prompt = base.prompt;
	if (base && Object.hasOwn(base, 'provider'))
		merged.provider = normalizeProvider(base.provider);
	if (base && Object.hasOwn(base, 'model'))
		merged.model = normalizeModel(base.model);

	if (Array.isArray(override.tools))
		merged.tools = normalizeStringList(override.tools);
	if (Array.isArray(override.appendTools)) {
		const extras = normalizeStringList(override.appendTools);
		const union = new Set([...(merged.appendTools ?? []), ...extras]);
		merged.appendTools = Array.from(union);
	} else if (
		Object.hasOwn(override, 'appendTools') &&
		!Array.isArray(override.appendTools)
	) {
		delete merged.appendTools;
	}
	if (Object.hasOwn(override, 'prompt')) merged.prompt = override.prompt;

	if (Object.hasOwn(override, 'provider')) {
		const normalized = normalizeProvider(override.provider);
		if (normalized) merged.provider = normalized;
		else delete merged.provider;
	}
	if (Object.hasOwn(override, 'model')) {
		const normalized = normalizeModel(override.model);
		if (normalized) merged.model = normalized;
		else delete merged.model;
	}
	return merged;
}

const baseToolSet = ['progress_update', 'finish'] as const;

const defaultToolExtras: Record<string, string[]> = {
	build: [
		'read',
		'write',
		'ls',
		'tree',
		'bash',
		'update_plan',
		'grep',
		'git_status',
		'git_diff',
		'ripgrep',
		'apply_patch',
		'websearch',
	],
	plan: ['read', 'ls', 'tree', 'ripgrep', 'update_plan', 'websearch'],
	general: [
		'read',
		'write',
		'ls',
		'tree',
		'bash',
		'ripgrep',
		'websearch',
		'update_plan',
	],
	git: ['git_status', 'git_diff', 'git_commit', 'read', 'ls'],
	commit: ['git_status', 'git_diff', 'git_commit', 'read', 'ls'],
};

export function defaultToolsForAgent(name: string): string[] {
	const extras = defaultToolExtras[name] ? [...defaultToolExtras[name]] : [];
	return Array.from(new Set([...baseToolSet, ...extras]));
}

export async function loadAgentsConfig(
	projectRoot: string,
): Promise<AgentsJson> {
	const localPath = `${projectRoot}/.agi/agents.json`.replace(/\\/g, '/');
	const globalPath = getGlobalAgentsJsonPath();
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
	const merged: AgentsJson = {};
	for (const [name, entry] of Object.entries(globalCfg)) {
		merged[name] = mergeAgentEntries(undefined, entry ?? {});
	}
	for (const [name, entry] of Object.entries(localCfg)) {
		const base = merged[name];
		merged[name] = mergeAgentEntries(base, entry ?? {});
	}
	return merged;
}

export async function resolveAgentConfig(
	projectRoot: string,
	name: string,
	inlineConfig?: {
		prompt?: string;
		tools?: string[];
		provider?: string;
		model?: string;
	},
): Promise<AgentConfig> {
	if (inlineConfig?.prompt) {
		const provider = normalizeProvider(inlineConfig.provider);
		const model = normalizeModel(inlineConfig.model);
		return {
			name,
			prompt: inlineConfig.prompt,
			tools: inlineConfig.tools ?? defaultToolsForAgent(name),
			provider,
			model,
		};
	}
	const agents = await loadAgentsConfig(projectRoot);
	const entry = agents[name];
	let prompt = '';
	let promptSource: string = 'none';

	// Override files: project first, then global
	const globalAgentsDir = getGlobalAgentsDir();
	const localDirTxt = `${projectRoot}/.agi/agents/${name}/agent.txt`.replace(
		/\\/g,
		'/',
	);
	const localDirMd = `${projectRoot}/.agi/agents/${name}/agent.md`.replace(
		/\\/g,
		'/',
	);
	const localFlatTxt = `${projectRoot}/.agi/agents/${name}.txt`.replace(
		/\\/g,
		'/',
	);
	const localFlatMd = `${projectRoot}/.agi/agents/${name}.md`.replace(
		/\\/g,
		'/',
	);
	const globalDirTxt = `${globalAgentsDir}/${name}/agent.txt`.replace(
		/\\/g,
		'/',
	);
	const globalDirMd = `${globalAgentsDir}/${name}/agent.md`.replace(/\\/g, '/');
	const globalFlatTxt = `${globalAgentsDir}/${name}.txt`.replace(/\\/g, '/');
	const globalFlatMd = `${globalAgentsDir}/${name}.md`.replace(/\\/g, '/');
	const files = [
		localDirMd,
		localFlatMd,
		localDirTxt,
		localFlatTxt,
		globalDirMd,
		globalFlatMd,
		globalDirTxt,
		globalFlatTxt,
	];
	for (const p of files) {
		try {
			const f = Bun.file(p);
			if (await f.exists()) {
				const text = await f.text();
				if (text.trim()) {
					prompt = text;
					promptSource = `file:${p}`;
					break;
				}
			}
		} catch {}
	}

	// If agents.json provides a 'prompt' field, accept inline content or a relative/absolute path
	if (entry?.prompt) {
		const p = entry.prompt.trim();
		if (
			/[.](md|txt)$/i.test(p) ||
			p.startsWith('.') ||
			p.startsWith('/') ||
			p.startsWith('~/')
		) {
			const candidates: string[] = [];
			if (p.startsWith('~/')) {
				const home = process.env.HOME || process.env.USERPROFILE || '';
				candidates.push(`${home}/${p.slice(2)}`);
			} else if (p.startsWith('/')) candidates.push(p);
			else candidates.push(`${projectRoot}/${p}`.replace(/\\/g, '/'));
			for (const candidate of candidates) {
				const pf = Bun.file(candidate);
				if (await pf.exists()) {
					const t = await pf.text();
					if (t.trim()) {
						prompt = t;
						promptSource = `agents.json:file:${candidate}`;
						break;
					}
				}
			}
		} else {
			prompt = p;
			promptSource = 'agents.json:inline';
		}
	}

	// Fallback: use embedded defaults (plan/build/general); else default to build
	if (!prompt) {
		const byName = (n: string): string | undefined => {
			if (n === 'build') return AGENT_BUILD;
			if (n === 'plan') return AGENT_PLAN;
			if (n === 'general') return AGENT_GENERAL;
			return undefined;
		};
		const candidate = byName(name)?.trim();
		if (candidate?.length) {
			prompt = candidate;
			promptSource = `fallback:embedded:${name}.txt`;
		} else {
			prompt = (AGENT_BUILD || '').trim();
			promptSource = 'fallback:embedded:build.txt';
		}
	}

	// Default tool access per agent if not explicitly configured
	let tools = Array.isArray(entry?.tools)
		? [...(entry?.tools as string[])]
		: defaultToolsForAgent(name);
	if (!entry || !entry.tools) {
		tools = defaultToolsForAgent(name);
	}
	if (Array.isArray(entry?.appendTools) && entry.appendTools.length) {
		for (const t of entry.appendTools) {
			if (typeof t === 'string' && t.trim()) tools.push(t.trim());
		}
	}
	// Deduplicate and ensure base tools are always available
	const deduped = Array.from(new Set([...tools, ...baseToolSet]));
	const provider = normalizeProvider(entry?.provider);
	const model = normalizeModel(entry?.model);
	debugLog(`[agent] ${name} prompt source: ${promptSource}`);
	debugLog(`[agent] ${name} prompt:\n${prompt}`);
	return {
		name,
		prompt,
		tools: deduped,
		provider,
		model,
	};
}
