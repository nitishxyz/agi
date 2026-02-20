import type { Hono } from 'hono';
import { readdir } from 'node:fs/promises';
import {
	readConfig,
	isAuthorized,
	buildFsTools,
	buildGitTools,
	getSecureAuthPath,
	getGlobalAgentsJsonPath,
	getGlobalToolsDir,
	getGlobalCommandsDir,
	logger,
} from '@ottocode/sdk';
import type { ProviderId } from '@ottocode/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';

const PROVIDERS: ProviderId[] = [
	'openai',
	'anthropic',
	'google',
	'openrouter',
	'opencode',
	'setu',
];

function providerEnvVar(p: ProviderId): string | null {
	if (p === 'openai') return 'OPENAI_API_KEY';
	if (p === 'anthropic') return 'ANTHROPIC_API_KEY';
	if (p === 'google') return 'GOOGLE_GENERATIVE_AI_API_KEY';
	if (p === 'opencode') return 'OPENCODE_API_KEY';
	if (p === 'setu') return 'SETU_PRIVATE_KEY';
	return null;
}

async function fileExists(path: string | null): Promise<boolean> {
	if (!path) return false;
	try {
		return await Bun.file(path).exists();
	} catch {
		return false;
	}
}

async function readJsonSafe<T>(path: string | null): Promise<T | null> {
	if (!path) return null;
	try {
		const file = Bun.file(path);
		if (!(await file.exists())) return null;
		return (await file.json()) as T;
	} catch {
		return null;
	}
}

async function listDir(dir: string | null): Promise<string[]> {
	if (!dir) return [];
	try {
		return await readdir(dir);
	} catch {
		return [];
	}
}

export function registerDoctorRoutes(app: Hono) {
	app.get('/v1/doctor', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const { cfg, auth } = await readConfig(projectRoot);

			const providers = await Promise.all(
				PROVIDERS.map(async (id) => {
					const ok = await isAuthorized(id, projectRoot);
					const envVar = providerEnvVar(id);
					const envConfigured = envVar ? !!process.env[envVar] : false;

					const globalAuthPath = getSecureAuthPath();
					let hasGlobalAuth = false;
					if (globalAuthPath) {
						const contents =
							await readJsonSafe<Record<string, unknown>>(globalAuthPath);
						hasGlobalAuth = Boolean(contents?.[id]);
					}

					const authInfo = auth?.[id];
					const hasStoredSecret = (() => {
						if (!authInfo) return false;
						if (authInfo.type === 'api')
							return Boolean((authInfo as { key?: string }).key);
						if (authInfo.type === 'wallet')
							return Boolean((authInfo as { secret?: string }).secret);
						if (authInfo.type === 'oauth')
							return Boolean(
								(authInfo as { access?: string; refresh?: string }).access ||
									(authInfo as { access?: string; refresh?: string }).refresh,
							);
						return false;
					})();

					const sources: string[] = [];
					if (envConfigured && envVar) sources.push(`env:${envVar}`);
					if (hasGlobalAuth) sources.push('auth.json');

					const configured =
						envConfigured ||
						hasGlobalAuth ||
						cfg.defaults.provider === id ||
						hasStoredSecret;

					return { id, ok, configured, sources };
				}),
			);

			const defaults = {
				agent: cfg.defaults.agent,
				provider: cfg.defaults.provider,
				model: cfg.defaults.model,
				providerAuthorized: await isAuthorized(
					cfg.defaults.provider as ProviderId,
					projectRoot,
				),
			};

			const globalAgentsPath = getGlobalAgentsJsonPath();
			const localAgentsPath = `${projectRoot}/.otto/agents.json`;
			const globalAgents =
				(await readJsonSafe<Record<string, unknown>>(globalAgentsPath)) ?? {};
			const localAgents =
				(await readJsonSafe<Record<string, unknown>>(localAgentsPath)) ?? {};

			const agents = {
				globalPath: (await fileExists(globalAgentsPath))
					? globalAgentsPath
					: null,
				localPath: (await fileExists(localAgentsPath)) ? localAgentsPath : null,
				globalNames: Object.keys(globalAgents).sort(),
				localNames: Object.keys(localAgents).sort(),
			};

			const defaultToolNames = Array.from(
				new Set([
					...buildFsTools(projectRoot).map((t) => t.name),
					...buildGitTools(projectRoot).map((t) => t.name),
					'finish',
				]),
			).sort();

			const globalToolsDir = getGlobalToolsDir();
			const localToolsDir = `${projectRoot}/.otto/tools`;
			const globalToolNames = await listDir(globalToolsDir);
			const localToolNames = await listDir(localToolsDir);

			const tools = {
				defaultNames: defaultToolNames,
				globalPath: globalToolNames.length ? globalToolsDir : null,
				globalNames: globalToolNames.sort(),
				localPath: localToolNames.length ? localToolsDir : null,
				localNames: localToolNames.sort(),
				effectiveNames: Array.from(
					new Set([...defaultToolNames, ...globalToolNames, ...localToolNames]),
				).sort(),
			};

			const globalCommandsDir = getGlobalCommandsDir();
			const localCommandsDir = `${projectRoot}/.otto/commands`;
			const globalCommandFiles = await listDir(globalCommandsDir);
			const localCommandFiles = await listDir(localCommandsDir);

			const commands = {
				globalPath: globalCommandFiles.length ? globalCommandsDir : null,
				globalNames: globalCommandFiles
					.filter((f) => f.endsWith('.json'))
					.map((f) => f.replace(/\.json$/, ''))
					.sort(),
				localPath: localCommandFiles.length ? localCommandsDir : null,
				localNames: localCommandFiles
					.filter((f) => f.endsWith('.json'))
					.map((f) => f.replace(/\.json$/, ''))
					.sort(),
			};

			const issues: string[] = [];
			if (!defaults.providerAuthorized) {
				issues.push(
					`Default provider '${defaults.provider}' is not authorized`,
				);
			}
			for (const [scope, entries] of [
				['global', globalAgents],
				['local', localAgents],
			] as const) {
				for (const [name, entry] of Object.entries(entries)) {
					if (
						entry &&
						typeof entry === 'object' &&
						Object.hasOwn(entry, 'tools') &&
						!Array.isArray((entry as { tools?: unknown }).tools)
					) {
						issues.push(`${scope}:${name} tools field must be an array`);
					}
				}
			}

			const suggestions: string[] = [];
			if (!defaults.providerAuthorized) {
				suggestions.push(
					`Run: otto auth login ${defaults.provider} — or switch defaults with: otto models`,
				);
			}
			if (issues.length) {
				suggestions.push('Review agents.json fields.');
			}

			return c.json({
				providers,
				defaults,
				agents,
				tools,
				commands,
				issues,
				suggestions,
				globalAuthPath: getSecureAuthPath(),
			});
		} catch (error) {
			logger.error('Failed to run doctor', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, (errorResponse.error.status || 500) as 500);
		}
	});
}
