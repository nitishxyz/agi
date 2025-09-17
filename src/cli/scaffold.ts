import {
	intro,
	outro,
	select,
	multiselect,
	text,
	isCancel,
	cancel,
	log,
	confirm,
} from '@clack/prompts';
import { defaultToolsForAgent } from '@/ai/agents/registry.ts';
import { discoverProjectTools } from '@/ai/tools/loader.ts';

type ScaffoldOptions = { project?: string; local?: boolean };

export async function runScaffold(opts: ScaffoldOptions = {}) {
	const projectRoot = (opts.project ?? process.cwd()).replace(/\\/g, '/');
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const baseDir = opts.local ? `${projectRoot}/.agi` : `${home}/.agi`;
	const scopeLabel = opts.local ? 'local' : 'global';
	intro(`Scaffold (${scopeLabel})`);
	const kind = await select({
		message: 'What do you want to scaffold?',
		options: [
			{ value: 'agent', label: 'Agent' },
			{ value: 'tool', label: 'Tool' },
			{ value: 'command', label: 'Command (manifest under .agi/commands/)' },
		],
	});
	if (isCancel(kind)) return cancel('Cancelled');
	if (kind === 'agent') return await scaffoldAgent(projectRoot, baseDir);
	if (kind === 'tool') return await scaffoldTool(projectRoot, baseDir);
	if (kind === 'command')
		return await scaffoldCommand(projectRoot, baseDir, !!opts.local);
	outro('Done');
}

async function scaffoldAgent(
	projectRoot: string,
	baseDir: string,
): Promise<boolean> {
	const scope = isGlobalBase(baseDir, projectRoot) ? 'global' : 'local';
	const name = await text({
		message: 'Agent name (slug)',
		placeholder: 'e.g. git, reviewer, testgen',
		validate: (v) =>
			/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v))
				? undefined
				: 'Use letters, numbers, - or _',
	});
	if (isCancel(name)) {
		cancel('Cancelled');
		return false;
	}
	const tools = await multiselect({
		message:
			'Select tools to allow for this agent (finalize is always included)',
		// built-ins (excluding finalize) + discovered custom ids under .agi/tools/
		options: (await listAvailableTools(projectRoot, scope, false)).map((t) => ({
			value: t,
			label: t,
		})),
	});
	if (isCancel(tools)) {
		cancel('Cancelled');
		return false;
	}

	let createPrompt = false;
	if (!['general', 'build', 'plan', 'commit'].includes(String(name))) {
		const wantPrompt = await confirm({
			message: 'Create prompt file (.agi/agents/<name>.txt)?',
		});
		if (isCancel(wantPrompt)) {
			cancel('Cancelled');
			return false;
		}
		createPrompt = Boolean(wantPrompt);
	}
	const agentsPath = `${baseDir}/agents.json`;
	const current = await readJson(agentsPath).catch(
		() => ({}) as Record<string, unknown>,
	);
	let promptRel: string | undefined;
	if (createPrompt) {
		const rel = `agents/${String(name)}.txt`;
		promptRel = baseDir.endsWith('/.agi') ? `.agi/${rel}` : rel; // if global, store just relative path preferred? we'll write absolute
		const promptAbs = `${baseDir}/${rel}`;
		await ensureDir(promptAbs.substring(0, promptAbs.lastIndexOf('/')));
		const template = defaultAgentPromptTemplate(String(name));
		await Bun.write(promptAbs, template);
	}
	// Always include finalize in tool allowlist
	const toolList = Array.from(new Set([...(tools as string[]), 'finalize']));
	current[String(name)] = {
		...(current[String(name)] ?? {}),
		tools: toolList,
		...(promptRel ? { prompt: promptRel } : {}),
	};
	await ensureDir(agentsPath.substring(0, agentsPath.lastIndexOf('/')));
	await Bun.write(agentsPath, JSON.stringify(current, null, 2));
	log.success(`Agent ${name} added to ${scope} agents.json`);
	if (promptRel) log.info(`Prompt: ${promptRel}`);
	outro('Done');
	return true;
}

async function scaffoldTool(projectRoot: string, baseDir: string) {
	const id = await text({
		message: 'Tool id (slug)',
		placeholder: 'e.g. git_tag, ripgrep',
		validate: (v) =>
			/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v))
				? undefined
				: 'Use letters, numbers, - or _',
	});
	if (isCancel(id)) return cancel('Cancelled');
	const desc = await text({
		message: 'Description',
		placeholder: 'What does this tool do?',
	});
	if (isCancel(desc)) return cancel('Cancelled');
	const dir = `${baseDir}/tools/${String(id)}`;
	await ensureDir(dir);
	const file = `${dir}/tool.js`;
	const content = toolTemplate(String(id), String(desc));
	await Bun.write(file, content);
	const scope = isGlobalBase(baseDir, projectRoot) ? 'global' : 'local';
	const display =
		scope === 'global'
			? `~/.agi/tools/${String(id)}`
			: `.agi/tools/${String(id)}`;
	log.success(`Tool created (${scope}): ${display}/tool.js`);
	log.info(
		`Edit ${display}/tool.js to customize parameters and execution logic.`,
	);
	log.info(
		`Remember to allow it in your agent via ${
			scope === 'global' ? '~/.agi/agents.json' : '.agi/agents.json'
		}.`,
	);
	outro('Done');
}

export async function editAgentsConfig(
	projectRoot: string,
	baseDir: string,
	scopeLabel: string,
) {
	const agentsPath = `${baseDir}/agents.json`;
	log.message(`Editing ${scopeLabel} agents config`);
	const current = (await readJson(agentsPath).catch(() => ({}))) as Record<
		string,
		{ tools?: string[]; appendTools?: string[]; prompt?: string }
	>;
	const builtInList = ['general', 'build', 'plan', 'commit'];
	const names = Object.keys(current);
	const selectable = Array.from(new Set([...builtInList, ...names])).sort();
	let agentName = await select({
		message: 'Select agent to edit',
		options: [
			{ value: '__new__', label: '(new agent)' },
			...selectable.map((n) => ({
				value: n,
				label:
					builtInList.includes(n) && !names.includes(n) ? `${n} (default)` : n,
			})),
		],
	});
	if (isCancel(agentName)) {
		cancel('Cancelled');
		return;
	}
	if (agentName === '__new__') {
		const nn = await text({
			message: 'New agent name',
			validate: (v) =>
				/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v))
					? undefined
					: 'Use letters, numbers, - or _',
		});
		if (isCancel(nn)) {
			cancel('Cancelled');
			return;
		}
		agentName = String(nn);
	}
	const key = String(agentName);
	const entry = current[key] ?? {};
	const scope = isGlobalBase(baseDir, projectRoot) ? 'global' : 'local';
	const builtInAgents = new Set(['general', 'build', 'plan', 'commit']);
	const defaults = defaultToolsForAgent(key).filter((t) => t !== 'finalize');
	const hasOverride = Array.isArray(entry.tools);
	const existingAppend = Array.isArray(entry.appendTools)
		? entry.appendTools.filter((t) => t !== 'finalize')
		: [];
	let mode: 'append' | 'override';
	if (hasOverride) mode = 'override';
	else if (existingAppend.length) mode = 'append';
	else if (builtInAgents.has(key)) mode = 'append';
	else mode = 'override';

	if (!hasOverride && builtInAgents.has(key) && existingAppend.length === 0) {
		const choice = await confirm({
			message:
				mode === 'append'
					? `Append extra tools to ${key}'s defaults? (defaults: ${
							defaults.length ? defaults.join(', ') : 'finalize'
						})`
					: `Override ${key}'s default tools?`,
		});
		if (isCancel(choice)) {
			cancel('Cancelled');
			return;
		}
		mode = choice ? 'append' : 'override';
	}

	const preselect =
		mode === 'append'
			? existingAppend
			: (entry.tools ?? []).filter((t) => t !== 'finalize');
	const optionValues = await listAvailableTools(projectRoot, scope, false);
	const baseDefaults = new Set(defaults);
	const filteredOptions = optionValues.filter((tool) => {
		if (mode === 'append') {
			if (baseDefaults.has(tool) && !existingAppend.includes(tool))
				return false;
		}
		return true;
	});
	const options = filteredOptions.map((t) => ({ value: t, label: t }));
	const allowed = new Set(filteredOptions);
	let initialValues = (preselect as string[]).filter((t) => allowed.has(t));
	if (
		mode === 'override' &&
		initialValues.length === 0 &&
		builtInAgents.has(key)
	) {
		initialValues = defaults.filter((t) => allowed.has(t));
	}
	const toolsSel = await multiselect({
		message:
			mode === 'append'
				? `Extra tools to append for ${key} (defaults: ${
						defaults.length ? defaults.join(', ') : 'finalize'
					})`
				: `Tools for ${key} (finalize is always included)`,
		options,
		initialValues,
	});
	if (isCancel(toolsSel)) {
		cancel('Cancelled');
		return;
	}
	const relPrompt = `agents/${String(agentName)}.txt`;
	const pth = current[String(agentName)]?.prompt;
	const shouldOfferPrompt =
		!builtInAgents.has(key) || Boolean(pth);
	let ensurePrompt = false;
	if (shouldOfferPrompt) {
		const resp = await confirm({
			message: `Ensure prompt file exists at ${pth ?? relPrompt}?`,
		});
		if (isCancel(resp)) {
			cancel('Cancelled');
			return;
		}
		ensurePrompt = Boolean(resp);
	}
	if (ensurePrompt) {
		const location = pth ?? (isGlobalBase(baseDir, projectRoot) ? `.agi/${relPrompt}` : relPrompt);
		let abs: string;
		if (location.startsWith('.agi/')) {
			if (isGlobalBase(baseDir, projectRoot)) {
				const relFromAgi = location.slice('.agi/'.length);
				abs = `${baseDir}/${relFromAgi}`;
			} else {
				abs = `${projectRoot}/${location}`;
			}
		} else if (location.startsWith('~/')) {
			const home = process.env.HOME || process.env.USERPROFILE || '';
			abs = `${home}/${location.slice(2)}`;
		} else if (location.startsWith('/')) {
			abs = location;
		} else {
			abs = `${baseDir}/${location}`;
		}
		await ensureDir(abs.substring(0, abs.lastIndexOf('/')));
		const f = Bun.file(abs);
		if (!(await f.exists()))
			await Bun.write(abs, defaultAgentPromptTemplate(String(agentName)));
	}
	const selection = Array.from(new Set((toolsSel as string[]) || []));
	const nextEntry: {
		tools?: string[];
		appendTools?: string[];
		prompt?: string;
	} = { ...(current[key] ?? {}) };
	if (ensurePrompt) nextEntry.prompt = pth ?? (isGlobalBase(baseDir, projectRoot) ? `.agi/${relPrompt}` : relPrompt);
	else delete nextEntry.prompt;
	if (mode === 'append') {
		const extras = selection.filter((t) => t !== 'finalize');
		if (extras.length) nextEntry.appendTools = extras;
		else delete nextEntry.appendTools;
		delete nextEntry.tools;
	} else {
		const finalTools = Array.from(new Set([...selection, 'finalize']));
		nextEntry.tools = finalTools;
		delete nextEntry.appendTools;
	}
	current[key] = nextEntry;
	await ensureDir(agentsPath.substring(0, agentsPath.lastIndexOf('/')));
	await Bun.write(agentsPath, JSON.stringify(current, null, 2));
	log.success(
		`Updated ${
			scope === 'global' ? '~/.agi/agents.json' : '.agi/agents.json'
		} for ${key} (${mode})`,
	);
	outro('Done');
}

async function scaffoldCommand(
	projectRoot: string,
	baseDir: string,
	scopeIsLocal: boolean,
) {
	const name = await text({
		message: 'Command name',
		placeholder: 'e.g. review, release',
		validate: (v) =>
			/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v))
				? undefined
				: 'Use letters, numbers, - or _',
	});
	if (isCancel(name)) {
		cancel('Cancelled');
		return;
	}
	// Pick agent interactively (existing or new)
	const scope = scopeIsLocal ? 'local' : 'global';
	const agentPick = await select({
		message: 'Agent to use',
		options: [
			{ value: '__new__', label: '(new agent)' },
			...(await listAgents(projectRoot, scope)).map((a) => ({
				value: a,
				label: a,
			})),
		],
	});
	if (isCancel(agentPick)) {
		cancel('Cancelled');
		return;
	}
	let agentName = String(agentPick);
	if (agentName === '__new__') {
		const created = await scaffoldAgent(projectRoot, baseDir);
		if (!created) return; // cancelled; stop flow
		// Ask again after creation to select the agent just added
		const sel = await select({
			message: 'Select agent',
			options: (await listAgents(projectRoot, scope)).map((a) => ({
				value: a,
				label: a,
			})),
		});
		if (isCancel(sel)) {
			cancel('Cancelled');
			return;
		}
		agentName = String(sel);
	}
	const description = await text({
		message: 'Description (optional)',
		placeholder: 'What does this command do?',
	});
	if (isCancel(description)) {
		cancel('Cancelled');
		return;
	}
	const promptInput = await text({
		message:
			'Prompt instructions (optional, include {input} where user input should go)',
		placeholder: 'e.g. Review the changes:\n{input}',
	});
	if (isCancel(promptInput)) {
		cancel('Cancelled');
		return;
	}
	const dir = `${baseDir}/commands`;
	await ensureDir(dir);
	const file = `${dir}/${String(name)}.json`;
	const instructions = String(promptInput || '').trim();
	const manifest: Record<string, unknown> = {
		name: String(name),
		description: String(description || ''),
		agent: agentName,
		defaults: { agent: agentName },
	};
	if (instructions.includes('{input}')) manifest.promptTemplate = instructions;
	else if (instructions) manifest.prompt = instructions;
	await Bun.write(file, JSON.stringify(manifest, null, 2));
	const scopeLabel = isGlobalBase(baseDir, projectRoot) ? 'global' : 'local';
	const display =
		scopeLabel === 'global'
			? `~/.agi/commands/${String(name)}.json`
			: `.agi/commands/${String(name)}.json`;
	log.success(`Command created (${scopeLabel}): ${display}`);
	outro('Done');
}

export async function listAvailableTools(
	_projectRoot: string,
	_scope: 'local' | 'global',
	includeFinalize: boolean,
): Promise<string[]> {
	const discovered = await discoverProjectTools(_projectRoot).catch(() => []);
	const names = new Set<string>();
	const curatedBuiltIns = [
		'fs_read',
		'fs_write',
		'fs_ls',
		'fs_tree',
		'git_status',
		'git_diff',
		'git_commit',
	];
	for (const builtin of curatedBuiltIns)
		names.add(builtin);
	for (const { name } of discovered) {
		if (!includeFinalize && name === 'finalize') continue;
		if (!curatedBuiltIns.includes(name) && name.startsWith('fs_') && name !== 'fs_read' && name !== 'fs_write' && name !== 'fs_ls' && name !== 'fs_tree')
			continue;
		names.add(name);
	}
	if (includeFinalize) names.add('finalize');
	return Array.from(names).sort();
}

async function listAgents(
	projectRoot: string,
	scope: 'local' | 'global',
): Promise<string[]> {
	// Only show core built-ins that always exist + configured agents.
	// Do not include optional built-ins like 'git' unless explicitly configured.
	const defaults = ['general', 'build', 'plan'];
	const names = new Set(defaults);
	const home = process.env.HOME || process.env.USERPROFILE || '';
	try {
		if (home) {
			const globalAgents = (await Bun.file(`${home}/.agi/agents.json`)
				.json()
				.catch(() => ({}))) as Record<string, unknown>;
			if (scope === 'local' || scope === 'global')
				for (const key of Object.keys(globalAgents)) names.add(key);
		}
	} catch {}
	if (scope === 'local') {
		try {
			const localAgents = (await Bun.file(`${projectRoot}/.agi/agents.json`)
				.json()
				.catch(() => ({}))) as Record<string, unknown>;
			for (const key of Object.keys(localAgents)) names.add(key);
		} catch {}
	}
	return Array.from(names).sort();
}

async function readJson(path: string) {
	const f = Bun.file(path);
	if (!(await f.exists())) throw new Error('missing');
	const text = await f.text();
	if (!text.trim()) return {};
	try {
		return JSON.parse(text) as unknown;
	} catch {
		const sanitized = text.replace(/,\s*(\}|\])/g, '$1');
		return JSON.parse(sanitized) as unknown;
	}
}

async function ensureDir(dir: string) {
	try {
		const { promises: fs } = await import('node:fs');
		await fs.mkdir(dir, { recursive: true });
	} catch {}
}

function defaultAgentPromptTemplate(name: string): string {
	if (name.toLowerCase() === 'git') {
		return `You are a Git assistant. Review and commit guidance.\n\n- Use git_status and git_diff to inspect changes.\n- For reviews: summarize and suggest improvements.\n- For commits: draft a Conventional Commits message; require [commit:yes] before git_commit.\n- Stream your findings before finalize.`;
	}
	return `You are the ${name} agent. Describe your responsibilities here.\n\n- What tools you can use.\n- What the expected output looks like.\n- Always call finalize when done.`;
}

function toolTemplate(id: string, description: string): string {
	const nameLiteral = JSON.stringify(id);
	const descLiteral = JSON.stringify(description);
	return `// Example AGI tool plugin. Adjust parameters and execute() as needed.
// export default async ({ project, exec, fs }) => ({
//   name: ${nameLiteral},
//   description: ${descLiteral},
//   parameters: {
//     text: { type: 'string', description: 'Text to echo' },
//     loud: { type: 'boolean', default: false }
//   },
//   async execute({ input }) {
//     const value = input.loud ? String(input.text).toUpperCase() : input.text;
//     return { project, value };
//   }
// });

export default async ({ project }) => ({
  name: ${nameLiteral},
  description: ${descLiteral},
  parameters: {
    text: { type: 'string', description: 'Text to echo' },
    loud: { type: 'boolean', default: false }
  },
  async execute({ input }) {
    const value = input.loud ? String(input.text).toUpperCase() : input.text;
    return { project, value };
  }
});
`;
}

function isGlobalBase(baseDir: string, projectRoot: string): boolean {
	const normalized = baseDir.replace(/\\/g, '/');
	const localBase = `${projectRoot.replace(/\\/g, '/')}/.agi`;
	return normalized !== localBase;
}
