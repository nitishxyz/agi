import {
	getGlobalConfigPath,
	getLocalDataDir,
	ensureDir,
	fileExists,
	joinPath,
} from './paths.ts';
import type { ProviderId } from '@agi-cli/types';

export type ProviderConfig = { enabled: boolean; apiKey?: string };

export type AGIConfig = {
	projectRoot: string;
	defaults: {
		agent: string;
		provider: ProviderId;
		model: string;
	};
	providers: Record<ProviderId, ProviderConfig>;
	paths: {
		dataDir: string; // .agi
		dbPath: string; // .agi/agi.sqlite
		projectConfigPath: string | null;
		globalConfigPath: string | null;
	};
};

const DEFAULTS: {
	defaults: AGIConfig['defaults'];
	providers: AGIConfig['providers'];
} = {
	defaults: {
		agent: 'general',
		provider: 'openai',
		model: 'gpt-4o-mini',
	},
	providers: {
		openai: { enabled: true },
		anthropic: { enabled: true },
		google: { enabled: true },
		openrouter: { enabled: false },
		opencode: { enabled: false },
	},
};

export async function loadConfig(
	projectRootInput?: string,
): Promise<AGIConfig> {
	const projectRoot = projectRootInput
		? String(projectRootInput)
		: process.cwd();

	const dataDir = getLocalDataDir(projectRoot);
	const dbPath = joinPath(dataDir, 'agi.sqlite');
	const projectConfigPath = joinPath(dataDir, 'config.json');
	const globalConfigPath = getGlobalConfigPath();

	const projectCfg = await readJsonOptional(projectConfigPath);
	const globalCfg = await readJsonOptional(globalConfigPath);

	const merged = deepMerge(DEFAULTS, globalCfg, projectCfg);

	// Ensure data dir exists so downstream can open DB
	await ensureDir(dataDir);

	return {
		projectRoot,
		defaults: merged.defaults,
		providers: merged.providers,
		paths: {
			dataDir,
			dbPath,
			projectConfigPath: (await fileExists(projectConfigPath))
				? projectConfigPath
				: null,
			globalConfigPath: (await fileExists(globalConfigPath))
				? globalConfigPath
				: null,
		},
	} satisfies AGIConfig;
}

type JsonObject = Record<string, unknown>;

async function readJsonOptional(file: string): Promise<JsonObject | undefined> {
	const f = Bun.file(file);
	if (!(await f.exists())) return undefined;
	try {
		const buf = await f.text();
		const parsed = JSON.parse(buf);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as JsonObject;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function deepMerge<T extends JsonObject>(
	...objects: Array<JsonObject | undefined>
): T {
	const result: JsonObject = {};
	for (const obj of objects) {
		if (!obj) continue;
		mergeInto(result, obj);
	}
	return result as T;
}

function mergeInto(target: JsonObject, source: JsonObject): JsonObject {
	for (const key of Object.keys(source)) {
		const sv = source[key];
		const tv = target[key];
		if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
			const svObj = sv as JsonObject;
			const nextTarget =
				tv && typeof tv === 'object' && !Array.isArray(tv)
					? (tv as JsonObject)
					: {};
			target[key] = mergeInto(nextTarget, svObj);
		} else {
			target[key] = sv;
		}
	}
	return target;
}

export type { Scope } from './manager.ts';
export {
	read,
	isAuthorized,
	ensureEnv,
	writeDefaults,
	writeAuth,
	removeAuth,
} from './manager.ts';
