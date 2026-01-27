import {
	getGlobalConfigPath,
	getLocalDataDir,
	ensureDir,
	fileExists,
	joinPath,
} from './paths.ts';
import type { AGIConfig } from '../../types/src/index.ts';

export type { ProviderConfig, AGIConfig } from '../../types/src/index.ts';

const DEFAULTS: {
	defaults: AGIConfig['defaults'];
	providers: AGIConfig['providers'];
} = {
	defaults: {
		agent: 'general',
		provider: 'openai',
		model: 'gpt-4o-mini',
		toolApproval: 'auto',
	},
	providers: {
		openai: { enabled: true },
		anthropic: { enabled: true },
		google: { enabled: true },
		openrouter: { enabled: false },
		opencode: { enabled: false },
		solforge: { enabled: false },
		zai: { enabled: false },
		'zai-coding': { enabled: false },
		moonshot: { enabled: false },
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

	await ensureDir(dataDir);

	return {
		projectRoot,
		defaults: merged.defaults as AGIConfig['defaults'],
		providers: merged.providers as AGIConfig['providers'],
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
