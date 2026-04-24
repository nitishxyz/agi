import { getGlobalConfigDir, joinPath } from '../../config/src/paths.ts';
import type { ModelInfo, ProviderId } from '../../types/src/index.ts';

export type CachedProviderCatalogEntry = {
	id: ProviderId;
	label?: string;
	models: ModelInfo[];
};

export type CachedModelCatalog = {
	version: 1;
	updatedAt: string;
	providers: Record<string, CachedProviderCatalogEntry>;
};

export const DEFAULT_REMOTE_MODEL_CATALOG_URL =
	'https://ottocode.io/catalog/models.json';

export function getModelCatalogCachePath(): string {
	return joinPath(getGlobalConfigDir(), 'models-catalog.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProviderEntry(
	id: string,
	value: unknown,
): CachedProviderCatalogEntry | null {
	if (!isRecord(value)) return null;
	const models = Array.isArray(value.models)
		? value.models.filter(
				(model): model is ModelInfo =>
					isRecord(model) && typeof model.id === 'string',
			)
		: [];
	return {
		id: (typeof value.id === 'string' ? value.id : id) as ProviderId,
		label: typeof value.label === 'string' ? value.label : undefined,
		models,
	};
}

export function normalizeModelCatalogPayload(
	payload: unknown,
): Record<string, CachedProviderCatalogEntry> {
	if (!isRecord(payload)) return {};
	const source = isRecord(payload.providers) ? payload.providers : payload;
	const providers: Record<string, CachedProviderCatalogEntry> = {};
	for (const [id, value] of Object.entries(source)) {
		const entry = normalizeProviderEntry(id, value);
		if (entry) providers[id] = entry;
	}
	return providers;
}

export async function readCachedModelCatalog(): Promise<CachedModelCatalog | null> {
	try {
		const file = Bun.file(getModelCatalogCachePath());
		if (!(await file.exists())) return null;
		const payload = await file.json();
		const providers = normalizeModelCatalogPayload(payload);
		return {
			version: 1,
			updatedAt:
				isRecord(payload) && typeof payload.updatedAt === 'string'
					? payload.updatedAt
					: new Date(0).toISOString(),
			providers,
		};
	} catch {
		return null;
	}
}

export async function writeCachedModelCatalog(
	providers: Record<string, CachedProviderCatalogEntry>,
): Promise<void> {
	const path = getModelCatalogCachePath();
	const dir = path.slice(0, path.lastIndexOf('/'));
	await import('node:fs/promises').then((fs) =>
		fs.mkdir(dir, { recursive: true }),
	);
	await Bun.write(
		path,
		JSON.stringify(
			{
				version: 1,
				updatedAt: new Date().toISOString(),
				providers,
			},
			null,
			2,
		),
	);
}

export async function mergeCachedModelCatalog(
	providers: Record<string, CachedProviderCatalogEntry>,
): Promise<void> {
	const existing = await readCachedModelCatalog();
	await writeCachedModelCatalog({
		...(existing?.providers ?? {}),
		...providers,
	});
}
