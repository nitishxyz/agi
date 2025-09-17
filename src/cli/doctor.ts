import { read as readMerged, isAuthorized } from '@/config/manager.ts';
import { box, colors } from '@/cli/ui.ts';
import type { ProviderId } from '@/auth/index.ts';
import { defaultAgentPrompts } from '@/ai/agents/defaults.ts';
import type { AgentConfigEntry } from '@/ai/agents/registry.ts';
import { buildFsTools } from '@/ai/tools/builtin/fs.ts';
import { buildGitTools } from '@/ai/tools/builtin/git.ts';

type MergedConfig = Awaited<ReturnType<typeof readMerged>>;

export async function runDoctor(opts: { project?: string } = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const { cfg, auth } = await readMerged(projectRoot);
	// Credentials source per provider (only show configured/default providers)
	const providers: ProviderId[] = ['openai', 'anthropic', 'google'];
	const providerMeta = await Promise.all(
		providers.map(async (p) => {
			const ok = await isAuthorized(p, projectRoot);
			const info = await describeProvider(p, cfg, auth);
			return { ...info, provider: p, ok };
		}),
	);
	const configured = providerMeta.filter((p) => p.configured);
	if (configured.length) {
		const providerLines: string[] = [];
		const globalAuthPath = getGlobalAuthPath();
		const localAuthPath = `${cfg.paths.dataDir}/auth.json`.replace(/\\/g, '/');
		if (await fileExists(globalAuthPath))
			providerLines.push(
				colors.dim(`global auth: ${friendlyPath(globalAuthPath)}`),
			);
		if (await fileExists(localAuthPath))
			providerLines.push(
				colors.dim(`local auth: ${friendlyPath(localAuthPath)}`),
			);
		if (providerLines.length) providerLines.push(' ');
		for (const meta of configured) {
			const status = meta.ok ? colors.green('ok') : colors.red('missing');
			const sources = meta.sources.length
				? colors.dim(`(${meta.sources.join(', ')})`)
				: '';
			providerLines.push(
				`${colors.bold(meta.provider)} — ${status}${sources ? ` ${sources}` : ''}`,
			);
		}
		box('Credentials', providerLines);
	}

	const def = cfg.defaults;
	const providerMatch = providers.find((p) => p === def.provider);
	const defAuth = providerMatch
		? await isAuthorized(providerMatch, projectRoot)
		: false;
	const defStatus = defAuth ? colors.green('ok') : colors.red('unauthorized');
	box('Defaults', [
		`agent: ${def.agent}`,
		`provider: ${def.provider} (${defStatus})`,
		`model: ${def.model}`,
	]);

	const {
		defaults: agentDefaults,
		globalAgents,
		localAgents,
	} = await collectAgents(projectRoot);
	const agentScopes = buildScopeLines([
		['default', agentDefaults],
		['global', globalAgents.names],
		['local', localAgents.names],
		[
			'effective',
			Array.from(
				new Set([
					...agentDefaults,
					...globalAgents.names,
					...localAgents.names,
				]),
			).sort(),
		],
	]);
	const agentLines: string[] = [];
	if (globalAgents.path)
		agentLines.push(
			colors.dim(`global file: ${friendlyPath(globalAgents.path)}`),
		);
	if (localAgents.path)
		agentLines.push(
			colors.dim(`local file: ${friendlyPath(localAgents.path)}`),
		);
	if (agentLines.length) agentLines.push(' ');
	agentLines.push(...agentScopes);
	box('Agents', agentLines);

	const {
		defaults: defaultTools,
		globalTools,
		localTools,
		effectiveTools,
	} = await collectTools(projectRoot);
	const toolScopes = buildScopeLines([
		['default', defaultTools],
		['global', globalTools.names],
		['local', localTools.names],
		['effective', effectiveTools],
	]);
	const toolLines: string[] = [];
	if (globalTools.path)
		toolLines.push(colors.dim(`global dir: ${friendlyPath(globalTools.path)}`));
	if (localTools.path)
		toolLines.push(colors.dim(`local dir: ${friendlyPath(localTools.path)}`));
	if (toolLines.length) toolLines.push(' ');
	toolLines.push(...toolScopes);
	box('Tools', toolLines);

	const agentIssues = detectAgentIssues(
		globalAgents.entries,
		localAgents.entries,
	);
	if (agentIssues.length)
		box('Agent Checks', [colors.yellow('Issues found:'), ...agentIssues]);
	else box('Agent Checks', [colors.green('No agent config issues detected')]);

	// Suggestions
	const sugg: string[] = [];
	if (!defAuth)
		sugg.push(
			`Run: agi auth login (${def.provider}) or switch defaults: agi models`,
		);
	if (agentIssues.length)
		sugg.push(
			`Review agents.json (appendTools/tools) to ensure finalize remains allowed.`,
		);
	if (sugg.length) box('Suggestions', sugg);
	else box('Suggestions', [colors.green('No obvious issues found')]);
}

async function describeProvider(
	provider: ProviderId,
	cfg: MergedConfig['cfg'],
	auth: MergedConfig['auth'],
) {
	const envVar = providerEnvVar(provider);
	const envConfigured = envVar ? !!process.env[envVar] : false;
	const locations = await detectAuthLocations(provider, cfg);
	const hasConfig = Boolean(cfg.providers?.[provider]?.apiKey);
	const sources: string[] = [];
	if (envConfigured && envVar) sources.push(`env: ${envVar}`);
	if (locations.global)
		sources.push(`auth.json: ${friendlyPath(locations.global)}`);
	if (locations.local)
		sources.push(`auth.json: ${friendlyPath(locations.local)}`);
	if (hasConfig) sources.push('config.json');
	const configured =
		envConfigured ||
		Boolean(locations.global) ||
		Boolean(locations.local) ||
		hasConfig ||
		cfg.defaults.provider === provider ||
		Boolean(auth?.[provider]?.key);
	return { provider, sources: Array.from(new Set(sources)), configured };
}

function formatList(values: string[]): string {
	if (!values.length) return colors.dim('none');
	const limit = 6;
	const shown = values.slice(0, limit);
	const rest = values.length - shown.length;
	const body = shown.join(', ');
	if (rest > 0) return `${body}${colors.dim(` (+${rest} more)`)}`;
	return body;
}

function buildScopeLines(scopes: [string, string[]][]) {
	return scopes.map(([scope, entries]) => {
		const label = colors.bold(`${scope} (${entries.length})`);
		return `${label}: ${formatList(entries)}`;
	});
}

async function collectAgents(projectRoot: string) {
	const defaults = Object.keys(defaultAgentPrompts).sort();
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const globalPath = home
		? `${home}/.agi/agents.json`.replace(/\\/g, '/')
		: null;
	const localPath = `${projectRoot}/.agi/agents.json`.replace(/\\/g, '/');
	const globalEntries = await readAgentsJson(globalPath);
	const localEntries = await readAgentsJson(localPath);
	return {
		defaults,
		globalAgents: {
			path: globalPath && (await fileExists(globalPath)) ? globalPath : null,
			names: Object.keys(globalEntries).sort(),
			entries: globalEntries,
		},
		localAgents: {
			path: (await fileExists(localPath)) ? localPath : null,
			names: Object.keys(localEntries).sort(),
			entries: localEntries,
		},
	};
}

async function collectTools(projectRoot: string) {
	const defaults = Array.from(
		new Set([
			...buildFsTools(projectRoot).map((t) => t.name),
			...buildGitTools(projectRoot).map((t) => t.name),
			'finalize',
		]),
	).sort();
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const globalDir = home ? `${home}/.agi/tools`.replace(/\\/g, '/') : null;
	const localDir = `${projectRoot}/.agi/tools`.replace(/\\/g, '/');
	const globalNames = await listToolDirectories(globalDir);
	const localNames = await listToolDirectories(localDir);
	const effective = Array.from(
		new Set([...defaults, ...globalNames.names, ...localNames.names]),
	).sort();
	return {
		defaults,
		globalTools: globalNames,
		localTools: localNames,
		effectiveTools: effective,
	};
}

async function readAgentsJson(path: string | null) {
	if (!path) return {} as Record<string, AgentConfigEntry>;
	try {
		const file = Bun.file(path);
		if (await file.exists())
			return (await file.json().catch(() => ({}))) as Record<
				string,
				AgentConfigEntry
			>;
	} catch {}
	return {} as Record<string, AgentConfigEntry>;
}

async function fileExists(path: string | null) {
	if (!path) return false;
	try {
		const file = Bun.file(path);
		return await file.exists();
	} catch {
		return false;
	}
}

async function listToolDirectories(dir: string | null) {
	if (!dir) return { names: [] as string[], path: null };
	try {
		const { readdir } = await import('node:fs/promises');
		let entries: string[] = [];
		let exists = false;
		try {
			entries = await readdir(dir);
			exists = true;
		} catch {
			entries = [];
		}
		return {
			names: entries.sort(),
			path: exists ? dir : null,
		};
	} catch {
		return { names: [] as string[], path: null };
	}
}

function detectAgentIssues(
	globalEntries: Record<string, AgentConfigEntry>,
	localEntries: Record<string, AgentConfigEntry>,
) {
	const issues: string[] = [];
	for (const [scope, entries] of [
		['global', globalEntries] as const,
		['local', localEntries] as const,
	]) {
		for (const [name, entry] of Object.entries(entries)) {
			if (Array.isArray(entry.tools) && !entry.tools.includes('finalize'))
				issues.push(`${scope}:${name} override missing finalize`);
		}
	}
	return issues;
}

function friendlyPath(path: string | null) {
	if (!path) return '';
	const home = process.env.HOME || process.env.USERPROFILE || '';
	if (home && path.startsWith(home))
		return path.replace(home, '~').replace(/\\/g, '/');
	return path.replace(/\\/g, '/');
}

function providerEnvVar(p: ProviderId) {
	if (p === 'openai') return 'OPENAI_API_KEY';
	if (p === 'anthropic') return 'ANTHROPIC_API_KEY';
	if (p === 'google') return 'GOOGLE_GENERATIVE_AI_API_KEY';
	return null;
}

async function detectAuthLocations(
	provider: ProviderId,
	cfg: MergedConfig['cfg'],
) {
	const locations: { global?: string; local?: string } = {};
	const globalPath = getGlobalAuthPath();
	if (await fileHasProvider(globalPath, provider))
		locations.global = globalPath;
	const localPath = `${cfg.paths.dataDir}/auth.json`.replace(/\\/g, '/');
	if (await fileHasProvider(localPath, provider)) locations.local = localPath;
	return locations;
}

function getGlobalAuthPath() {
	const home = process.env.HOME || process.env.USERPROFILE || '';
	return `${home}/.agi/auth.json`.replace(/\\/g, '/');
}

async function fileHasProvider(path: string, provider: ProviderId) {
	try {
		const file = Bun.file(path);
		if (!(await file.exists())) return false;
		const contents = (await file.json().catch(() => ({}))) as Record<
			ProviderId,
			unknown
		>;
		return Boolean(contents?.[provider]);
	} catch {
		return false;
	}
}
