// Fetch models catalog and write to src/providers/catalog.ts
// Usage: bun run scripts/update-catalog.ts [--from path/to/feed.json]

import type {
	ProviderId,
	ModelInfo,
	ModelProviderBinding,
	ProviderCatalogEntry,
} from '@agi-cli/sdk';

const SOURCE = 'https://models.dev/api.json';
const TARGET = 'packages/sdk/src/providers/src/catalog.ts';

interface ProviderFeedEntry {
	id: string;
	name?: string;
	env?: unknown;
	npm?: unknown;
	api?: unknown;
	doc?: unknown;
	models: Record<string, unknown>;
}

type ProviderFeed = Record<string, ProviderFeedEntry>;

function createEmptyEntry(id: ProviderId): ProviderCatalogEntry {
	return { id, models: [] };
}

function normalizeString(value: unknown): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed.length) return trimmed;
	}
	return undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out = value
		.map((item) => normalizeString(item))
		.filter((item): item is string => Boolean(item));
	return out.length ? out : undefined;
}

function firstDefined<T>(...values: T[]): T | undefined {
	for (const value of values) {
		if (value !== undefined && value !== null) return value;
	}
	return undefined;
}

function pickProviders(
	feed: ProviderFeed,
): Record<ProviderId, ProviderCatalogEntry> {
	const out: Record<ProviderId, ProviderCatalogEntry> = {
		openai: createEmptyEntry('openai'),
		anthropic: createEmptyEntry('anthropic'),
		google: createEmptyEntry('google'),
		openrouter: createEmptyEntry('openrouter'),
		opencode: createEmptyEntry('opencode'),
		zai: createEmptyEntry('zai'),
		'zai-coding': createEmptyEntry('zai-coding'),
	};
	for (const providerKey of Object.keys(feed)) {
		let targetKey = providerKey as ProviderId;
		if (providerKey === 'zai-coding-plan') {
			targetKey = 'zai-coding';
		}
		if (
			![
				'openai',
				'anthropic',
				'google',
				'openrouter',
				'opencode',
				'zai',
				'zai-coding-plan',
			].includes(providerKey)
		)
			continue;
		const entry = feed[providerKey];
		const key = targetKey;
		const models: ModelInfo[] = [];
		for (const mid of Object.keys(entry.models || {})) {
			const raw = entry.models[mid] as Record<string, unknown> | undefined;
			models.push(mapModel(mid, raw));
		}
		models.sort((a, b) => a.id.localeCompare(b.id));
		const base = createEmptyEntry(key);
		const label = normalizeString(entry.name);
		if (label) base.label = label;
		const env = normalizeStringArray(entry.env);
		if (env) base.env = env;
		const npm = normalizeString(entry.npm);
		if (npm) base.npm = npm;
		const api = normalizeString(entry.api);
		if (api) base.api = api;
		const doc = normalizeString(entry.doc);
		if (doc) base.doc = doc;
		base.models = models;
		out[key] = base;
	}
	return out;
}

function mapModel(id: string, raw?: Record<string, unknown>): ModelInfo {
	const m = raw ?? {};
	const info: ModelInfo = { id: String(m.id ?? id) };
	if (typeof m.name === 'string' && m.name.trim()) info.label = m.name;
	const modalities = normalizeModalities(m.modalities);
	if (modalities) info.modalities = modalities;
	if (hasValue(m.tool_call)) info.toolCall = Boolean(m.tool_call);
	if (hasValue(m.reasoning)) info.reasoning = Boolean(m.reasoning);
	if (hasValue(m.attachment)) info.attachment = Boolean(m.attachment);
	const temperature = normalizeTemperature(m.temperature);
	if (temperature !== undefined) info.temperature = temperature;
	if (typeof m.knowledge === 'string' && m.knowledge.trim())
		info.knowledge = m.knowledge;
	if (typeof m.release_date === 'string' && m.release_date.trim())
		info.releaseDate = m.release_date;
	if (typeof m.last_updated === 'string' && m.last_updated.trim())
		info.lastUpdated = m.last_updated;
	if (hasValue(m.open_weights)) info.openWeights = Boolean(m.open_weights);
	const cost = normalizeCost(m.cost);
	if (cost) info.cost = cost;
	const limit = normalizeLimit(m.limit);
	if (limit) info.limit = limit;
	const provider = normalizeProviderBinding(m.provider);
	if (provider) info.provider = provider;
	return info;
}

function normalizeModalities(value: unknown) {
	if (!value || typeof value !== 'object') return undefined;
	const obj = value as Record<string, unknown>;
	const input = Array.isArray(obj.input)
		? obj.input.filter((v) => typeof v === 'string')
		: undefined;
	const output = Array.isArray(obj.output)
		? obj.output.filter((v) => typeof v === 'string')
		: undefined;
	if (!input && !output) return undefined;
	return { input, output };
}

function normalizeTemperature(value: unknown): boolean | number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'boolean') return value;
	return undefined;
}

function normalizeCost(value: unknown) {
	if (!value || typeof value !== 'object') return undefined;
	const obj = value as Record<string, unknown>;
	const input = toNumber(obj.input);
	const output = toNumber(obj.output);
	const cacheRead = toNumber(obj.cache_read ?? obj.cacheRead);
	const cacheWrite = toNumber(obj.cache_write ?? obj.cacheWrite);
	if (
		input == null &&
		output == null &&
		cacheRead == null &&
		cacheWrite == null
	)
		return undefined;
	return {
		input: input ?? undefined,
		output: output ?? undefined,
		cacheRead: cacheRead ?? undefined,
		cacheWrite: cacheWrite ?? undefined,
	};
}

function normalizeLimit(value: unknown) {
	if (!value || typeof value !== 'object') return undefined;
	const obj = value as Record<string, unknown>;
	const context = toNumber(obj.context);
	const output = toNumber(obj.output);
	if (context == null && output == null) return undefined;
	return {
		context: context ?? undefined,
		output: output ?? undefined,
	};
}

function normalizeProviderBinding(
	value: unknown,
): ModelProviderBinding | undefined {
	if (value == null) return undefined;
	if (typeof value === 'string') {
		const npm = normalizeString(value);
		return npm ? { npm } : undefined;
	}
	if (typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	const binding: ModelProviderBinding = {};
	const id = normalizeString(record.id);
	if (id) binding.id = id;
	const npm = normalizeString(record.npm);
	if (npm) binding.npm = npm;
	const api = normalizeString(firstDefined(record.api, record.url));
	if (api) binding.api = api;
	const baseURL = normalizeString(
		firstDefined(
			record.baseURL,
			record.base_url,
			record['base-url'],
			record.api,
		),
	);
	if (baseURL) binding.baseURL = baseURL;
	if (!binding.baseURL && binding.api) binding.baseURL = binding.api;
	return binding.id || binding.npm || binding.api || binding.baseURL
		? binding
		: undefined;
}

function hasValue(value: unknown) {
	return value !== undefined && value !== null;
}

function toNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed.length) return null;
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function toTs(catalog: Record<ProviderId, ProviderCatalogEntry>) {
	const header = `// AUTO-GENERATED by scripts/update-catalog.ts. Do not edit manually.\n`;
	const imports = `import type { ProviderId, ProviderCatalogEntry } from '../../types/src/index.ts';\n`;
	const bodyObject = JSON.stringify(catalog, null, 2);
	const type = 'Partial<Record<ProviderId, ProviderCatalogEntry>>';
	const body = `export const catalog: ${type} = ${bodyObject} as const satisfies ${type};\n`;
	return `${header}\n${imports}\n${body}`;
}

async function main() {
	const args = process.argv.slice(2);
	const fromIdx = args.indexOf('--from');
	let feed: ProviderFeed;
	if (fromIdx >= 0) {
		const file = args[fromIdx + 1];
		if (!file) throw new Error('--from requires a filepath');
		console.log(`Reading ${file} ...`);
		const text = await Bun.file(file).text();
		feed = JSON.parse(text) as ProviderFeed;
	} else {
		console.log(`Fetching ${SOURCE} ...`);
		const res = await fetch(SOURCE);
		if (!res.ok)
			throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
		feed = (await res.json()) as ProviderFeed;
	}
	const picked = pickProviders(feed);
	const ts = toTs(picked);
	await Bun.write(TARGET, ts);
	console.log(`Wrote ${TARGET}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
