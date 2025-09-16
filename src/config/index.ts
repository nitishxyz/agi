// Minimal path join to avoid node:path; ensures forward slashes
function joinPath(...parts: string[]) {
	return parts
		.filter(Boolean)
		.map((p) => p.replace(/\\/g, '/'))
		.join('/')
		.replace(/\/+\/+/g, '/');
}

export type ProviderConfig = { enabled: boolean; apiKey?: string };

export type AGIConfig = {
	projectRoot: string;
	defaults: {
		agent: string;
		provider: 'openai' | 'anthropic' | 'google';
		model: string;
	};
	providers: {
		openai: ProviderConfig;
		anthropic: ProviderConfig;
		google: ProviderConfig;
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
		? String(projectRootInput)
		: process.cwd();

	const dataDir = joinPath(projectRoot, '.agi');
	const dbPath = joinPath(dataDir, 'agi.sqlite');
	const projectConfigPath = joinPath(dataDir, 'config.json');
	const globalConfigPath = joinPath(
		process.env.HOME || '',
		'.agi',
		'config.json',
	);

	const projectCfg = await readJsonOptional(projectConfigPath);
	const globalCfg = await readJsonOptional(globalConfigPath);

	const merged = deepMerge(DEFAULTS, globalCfg, projectCfg);

	// Ensure data dir exists so downstream can open DB
	// Ensure data dir exists. Using Node fs might be replaced when Bun exposes mkdir.
	await ensureDir(dataDir);

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

async function exists(p: string) {
	return await Bun.file(p).exists();
}

async function ensureDir(dir: string) {
	try {
		// Attempt to create a marker file to ensure directory exists
		// If parent directories are missing, fallback to Node fs.
		await Bun.write(joinPath(dir, '.keep'), '');
	} catch {
		const { promises: fs } = await import('node:fs');
		await fs.mkdir(dir, { recursive: true }).catch(() => {});
	}
}
