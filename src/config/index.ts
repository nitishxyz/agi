import { promises as fs } from 'node:fs';
import path from 'node:path';

export type AGIConfig = {
	projectRoot: string;
	defaults: {
		agent: string;
		provider: 'openai' | 'anthropic' | 'google';
		model: string;
	};
	providers: {
		openai: { enabled: boolean };
		anthropic: { enabled: boolean };
		google: { enabled: boolean };
	};
	paths: {
		dataDir: string; // .agi
		dbPath: string; // .agi/agi.sqlite
		projectConfigPath: string | null;
		globalConfigPath: string | null;
	};
};

const DEFAULTS = {
	defaults: {
		agent: 'general',
		provider: 'openai' as const,
		model: 'gpt-4o-mini',
	},
	providers: {
		openai: { enabled: true },
		anthropic: { enabled: true },
		google: { enabled: true },
	},
};

export async function loadConfig(
	projectRootInput?: string,
): Promise<AGIConfig> {
	const projectRoot = projectRootInput
		? path.resolve(projectRootInput)
		: process.cwd();

	const dataDir = path.join(projectRoot, '.agi');
	const dbPath = path.join(dataDir, 'agi.sqlite');
	const projectConfigPath = path.join(dataDir, 'config.json');
	const globalConfigPath = path.join(
		process.env.HOME || '',
		'.config',
		'agi',
		'config.json',
	);

	const projectCfg = await readJsonOptional(projectConfigPath);
	const globalCfg = await readJsonOptional(globalConfigPath);

	const merged = deepMerge(DEFAULTS, globalCfg, projectCfg);

	// Ensure data dir exists so downstream can open DB
	await fs.mkdir(dataDir, { recursive: true }).catch(() => {});

	return {
		projectRoot,
		defaults: merged.defaults,
		providers: merged.providers,
		paths: {
			dataDir,
			dbPath,
			projectConfigPath: (await exists(projectConfigPath))
				? projectConfigPath
				: null,
			globalConfigPath: (await exists(globalConfigPath))
				? globalConfigPath
				: null,
		},
	} satisfies AGIConfig;
}

async function readJsonOptional(file: string): Promise<any | undefined> {
	try {
		const buf = await fs.readFile(file, 'utf8');
		return JSON.parse(buf);
	} catch {
		return undefined;
	}
}

function deepMerge<T>(...objects: (T | undefined)[]): T {
	const result: any = {};
	for (const obj of objects) {
		if (!obj) continue;
		mergeInto(result, obj);
	}
	return result;
}

function mergeInto(target: any, source: any) {
	for (const key of Object.keys(source)) {
		const sv = (source as any)[key];
		const tv = (target as any)[key];
		if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
			(target as any)[key] = mergeInto(tv ?? {}, sv);
		} else {
			(target as any)[key] = sv;
		}
	}
	return target;
}

async function exists(p: string) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}
