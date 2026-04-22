import type { ModelInfo } from '../../types/src/index.ts';

export type DiscoverOllamaOptions = {
	baseURL: string;
	apiKey?: string;
	fetch?: typeof globalThis.fetch;
};

export type DiscoverOllamaResult = {
	baseURL: string;
	models: ModelInfo[];
};

type OllamaTagsResponse = {
	models?: Array<
		{
			name?: string;
			model?: string;
		} & Record<string, unknown>
	>;
};

type OllamaShowResponse = {
	capabilities?: string[];
	details?: {
		family?: string;
		parameter_size?: string;
		quantization_level?: string;
	};
	model_info?: Record<string, unknown>;
};

export function normalizeOllamaBaseURL(baseURL: string): string {
	const trimmed = baseURL.trim().replace(/\/$/, '');
	return trimmed
		.replace(/\/api\/(chat|generate|embed|show|tags)\/?$/, '')
		.replace(/\/api\/?$/, '');
}

export async function discoverOllamaModels(
	options: DiscoverOllamaOptions,
): Promise<DiscoverOllamaResult> {
	const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
	const baseURL = normalizeOllamaBaseURL(options.baseURL);
	const headers = buildHeaders(options.apiKey);

	const tagsResponse = await fetchImpl(`${baseURL}/api/tags`, {
		method: 'GET',
		headers,
	});
	if (!tagsResponse.ok) {
		throw new Error(`Failed to fetch Ollama models: ${tagsResponse.status}`);
	}
	const tagsPayload = (await tagsResponse.json()) as OllamaTagsResponse;
	const ids = (tagsPayload.models ?? [])
		.map((model) => String(model.name ?? model.model ?? '').trim())
		.filter(Boolean);

	const models = await Promise.all(
		ids.map(
			async (id) =>
				await discoverSingleOllamaModel(fetchImpl, baseURL, headers, id),
		),
	);

	return {
		baseURL,
		models: models.filter((model): model is ModelInfo => Boolean(model)),
	};
}

async function discoverSingleOllamaModel(
	fetchImpl: typeof globalThis.fetch,
	baseURL: string,
	headers: HeadersInit | undefined,
	id: string,
): Promise<ModelInfo> {
	try {
		const response = await fetchImpl(`${baseURL}/api/show`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(headers ?? {}),
			},
			body: JSON.stringify({ model: id }),
		});
		if (!response.ok) return { id, label: id };
		const payload = (await response.json()) as OllamaShowResponse;
		return mapOllamaShowResponse(id, payload);
	} catch {
		return { id, label: id };
	}
}

function mapOllamaShowResponse(
	id: string,
	payload: OllamaShowResponse,
): ModelInfo {
	const capabilities = new Set(
		(payload.capabilities ?? []).map((cap) => cap.toLowerCase()),
	);
	const inputModalities = ['text'];
	if (capabilities.has('vision')) inputModalities.push('image');
	if (capabilities.has('audio')) inputModalities.push('audio');

	const contextLength = extractContextLength(payload.model_info);
	const parameterSize = payload.details?.parameter_size;
	const quantization = payload.details?.quantization_level;
	const labelParts = [id];
	if (parameterSize) labelParts.push(parameterSize);
	if (quantization) labelParts.push(quantization);

	return {
		id,
		label: labelParts.join(' · '),
		toolCall: capabilities.has('tools'),
		reasoningText: capabilities.has('thinking'),
		modalities: {
			input: inputModalities,
			output: ['text'],
		},
		limit: contextLength ? { context: contextLength } : undefined,
	};
}

function extractContextLength(
	modelInfo: Record<string, unknown> | undefined,
): number | undefined {
	if (!modelInfo) return undefined;
	for (const [key, value] of Object.entries(modelInfo)) {
		if (!key.endsWith('.context_length')) continue;
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return undefined;
}

function buildHeaders(apiKey?: string): HeadersInit | undefined {
	if (!apiKey) return undefined;
	return { Authorization: `Bearer ${apiKey}` };
}
