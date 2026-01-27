import { isAbsolute, join } from 'node:path';
import { read as readMerged, isAuthorized } from '@agi-cli/sdk';
import { discoverCommands } from './custom-commands.ts';
import { box, colors } from './ui.ts';
import type { ProviderId } from '@agi-cli/sdk';
import type { AgentConfigEntry } from '@agi-cli/server/runtime/agent-registry';
import { buildFsTools } from '@agi-cli/sdk';
import { buildGitTools } from '@agi-cli/sdk';
import type { CommandManifest } from './custom-commands.ts';
import {
	getSecureAuthPath,
	getGlobalAgentsJsonPath,
	getGlobalToolsDir,
	getGlobalCommandsDir,
} from '@agi-cli/sdk';

type MergedConfig = Awaited<ReturnType<typeof readMerged>>;

export async function runDoctor(opts: { project?: string } = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const { cfg, auth } = await readMerged(projectRoot);
	// Credentials source per provider (only show configured/default providers)
	const providers: ProviderId[] = [
		'openai',
		'anthropic',
		'google',
		'openrouter',
		'opencode',
		'setu',
	];
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
		const globalAuthPath = getSecureAuthPath();
		if (await fileExists(globalAuthPath))
			providerLines.push(
				colors.dim(`global auth: ${friendlyPath(globalAuthPath)}`),
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

	const { globalDir, localDir, effectiveNames } =
		await collectCommands(projectRoot);
	const commandLines: string[] = [];
	if (globalDir.path)
		commandLines.push(
			colors.dim(`global dir: ${friendlyPath(globalDir.path)}`),
		);
	if (localDir.path)
		commandLines.push(colors.dim(`local dir: ${friendlyPath(localDir.path)}`));
	const scopeLines = buildScopeLines([
		['global', globalDir.names],
		['local', localDir.names],
		['effective', effectiveNames],
	]);
	if (commandLines.length) commandLines.push(' ');
	commandLines.push(...scopeLines);
	const detailLines = buildCommandDetailLines([
		['global', globalDir.entries],
		['local', localDir.entries],
	]);
	if (detailLines.length) {
		commandLines.push(' ');
		commandLines.push(...detailLines);
	}
	box('Commands', commandLines);

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
	if (agentIssues.length) sugg.push(`Review agents.json fields.`);
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
	const sources: string[] = [];
	if (envConfigured && envVar) sources.push(`env: ${envVar}`);
	if (locations.global)
		sources.push(`auth.json: ${friendlyPath(locations.global)}`);
	const hasStoredSecret = (() => {
		const info = auth?.[provider];
		if (!info) return false;
		if (info.type === 'api') return Boolean(info.key);
		if (info.type === 'wallet') return Boolean(info.secret);
		if (info.type === 'oauth') return Boolean(info.access || info.refresh);
		return false;
	})();
	const configured =
		envConfigured ||
		Boolean(locations.global) ||
		cfg.defaults.provider === provider ||
		hasStoredSecret;
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
	// Read code-backed agent prompt names under src/prompts/agents
	let defaults: string[] = [];
	try {
		const { readdir } = await import('node:fs/promises');
		const dir = 'src/prompts/agents';
		const entries = await readdir(dir).catch(() => [] as string[]);
		const names = new Set<string>();
		for (const file of entries) {
			if (!/\.(md|txt)$/i.test(file)) continue;
			const base = file.replace(/\.(md|txt)$/i, '');
			if (base.trim()) names.add(base.trim());
		}
		defaults = Array.from(names).sort();
	} catch {
		defaults = [];
	}
	if (!defaults.includes('build')) defaults.push('build');
	const globalPath = getGlobalAgentsJsonPath();
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
			'finish',
		]),
	).sort();
	const globalDir = getGlobalToolsDir();
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

type CommandPromptInfo = {
	kind: 'file' | 'inline' | 'template' | 'none';
	path: string | null;
	exists: boolean;
};

type CommandEntry = {
	name: string;
	manifestPath: string;
	prompt: CommandPromptInfo;
};

type CommandScopeInfo = {
	path: string | null;
	names: string[];
	entries: CommandEntry[];
};

async function collectCommands(projectRoot: string) {
	const globalDir = getGlobalCommandsDir();
	const localDir = `${projectRoot}/.agi/commands`.replace(/\\/g, '/');
	const [globalDirInfo, localDirInfo] = await Promise.all([
		readCommandDirectory(globalDir, projectRoot),
		readCommandDirectory(localDir, projectRoot),
	]);
	const discovered = await discoverCommands(projectRoot);
	const effectiveNames = Object.keys(discovered).sort();
	return {
		globalDir: globalDirInfo,
		localDir: localDirInfo,
		effectiveNames,
	};
}

function buildCommandDetailLines(scopes: [string, CommandEntry[]][]): string[] {
	const limit = 6;
	const lines: string[] = [];
	for (const [label, entries] of scopes) {
		if (!entries.length) continue;
		lines.push(colors.bold(`${label}:`));
		const shown = entries.slice(0, limit);
		for (const entry of shown)
			lines.push(`• ${entry.name} — ${formatCommandEntry(entry)}`);
		if (entries.length > shown.length)
			lines.push(
				colors.dim(`  ... +${entries.length - shown.length} more in ${label}`),
			);
	}
	return lines;
}

function formatCommandEntry(entry: CommandEntry) {
	const manifest = friendlyPath(entry.manifestPath);
	const parts = [`json: ${manifest}`];
	if (entry.prompt.kind === 'file') {
		const promptPath = entry.prompt.path
			? friendlyPath(entry.prompt.path)
			: null;
		parts.push(
			`prompt: ${promptPath ?? 'unknown'}${entry.prompt.exists ? '' : ' (missing)'}`,
		);
	} else if (entry.prompt.kind === 'inline') parts.push('prompt: inline');
	else if (entry.prompt.kind === 'template') parts.push('prompt: template');
	return parts.join(', ');
}

async function readCommandDirectory(
	dir: string | null,
	projectRoot: string,
): Promise<CommandScopeInfo> {
	if (!dir) return { path: null, names: [], entries: [] };
	try {
		const normalizedDir = dir.replace(/\\/g, '/');
		const { readdir } = await import('node:fs/promises');
		let files: string[] = [];
		let exists = true;
		try {
			files = await readdir(normalizedDir);
		} catch {
			exists = false;
		}
		if (!exists) return { path: null, names: [], entries: [] };
		const entries: CommandEntry[] = [];
		for (const file of files.sort()) {
			if (!file.endsWith('.json')) continue;
			const manifestPath = `${normalizedDir}/${file}`.replace(/\\/g, '/');
			try {
				const bunFile = Bun.file(manifestPath);
				if (!(await bunFile.exists())) continue;
				const manifest = (await bunFile
					.json()
					.catch(() => null)) as CommandManifest | null;
				if (!manifest || typeof manifest !== 'object') continue;
				const fallback = file.replace(/\.json$/i, '');
				const name = manifest.name || fallback;
				if (!name || !manifest.agent) continue;
				const prompt = await resolvePromptInfo(manifest, {
					projectRoot,
					manifestDir: normalizedDir,
					fallbackName: fallback,
				});
				entries.push({ name, manifestPath, prompt });
			} catch {}
		}
		entries.sort((a, b) => a.name.localeCompare(b.name));
		return {
			path: normalizedDir,
			names: entries.map((e) => e.name),
			entries,
		};
	} catch {
		return { path: null, names: [], entries: [] };
	}
}

async function resolvePromptInfo(
	manifest: CommandManifest,
	ctx: {
		projectRoot: string;
		manifestDir: string | null;
		fallbackName?: string;
	},
): Promise<CommandPromptInfo> {
	if (manifest.promptPath) {
		const { path, exists } = await resolvePromptPath(
			manifest.promptPath,
			ctx.manifestDir,
			ctx.projectRoot,
		);
		return { kind: 'file', path, exists };
	}
	if (ctx.fallbackName && ctx.manifestDir) {
		for (const ext of ['.md', '.txt']) {
			const candidate = `${ctx.manifestDir}/${ctx.fallbackName}${ext}`.replace(
				/\\/g,
				'/',
			);
			if (await fileExists(candidate))
				return { kind: 'file', path: candidate, exists: true };
		}
	}
	if (manifest.prompt) return { kind: 'inline', path: null, exists: false };
	if (manifest.promptTemplate)
		return { kind: 'template', path: null, exists: false };
	return { kind: 'none', path: null, exists: false };
}

async function resolvePromptPath(
	promptPath: string,
	manifestDir: string | null,
	projectRoot: string,
): Promise<{ path: string; exists: boolean }> {
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const expanded =
		promptPath.startsWith('~/') && home
			? join(home, promptPath.slice(2))
			: promptPath;
	const normalizedInput = expanded.replace(/\\/g, '/');
	const candidates: string[] = [];
	if (isAbsolute(normalizedInput)) candidates.push(normalizedInput);
	else {
		if (manifestDir) candidates.push(join(manifestDir, normalizedInput));
		candidates.push(join(projectRoot, normalizedInput));
	}
	for (const candidate of candidates) {
		const normalized = candidate.replace(/\\/g, '/');
		if (await fileExists(normalized)) return { path: normalized, exists: true };
	}
	const fallback = candidates[0]?.replace(/\\/g, '/') ?? normalizedInput;
	return { path: fallback, exists: false };
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
			// Do not require 'finish' in overrides; it is always appended implicitly.
			// Only warn if the override is clearly malformed (non-array tools field).
			if (Object.hasOwn(entry, 'tools') && !Array.isArray(entry.tools)) {
				issues.push(`${scope}:${name} tools field must be an array`);
			}
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
	if (p === 'opencode') return 'OPENCODE_API_KEY';
	if (p === 'setu') return 'SETU_PRIVATE_KEY';
	return null;
}

async function detectAuthLocations(
	provider: ProviderId,
	_cfg: MergedConfig['cfg'],
) {
	const locations: { global?: string; local?: string } = {};
	const globalPath = getSecureAuthPath();
	if (await fileHasProvider(globalPath, provider))
		locations.global = globalPath;
	return locations;
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
