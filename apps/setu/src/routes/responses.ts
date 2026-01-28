import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { walletAuth } from '../middleware/auth';
import { balanceCheck } from '../middleware/balance-check';
import { deductCost } from '../services/balance';
import { config } from '../config';
import type { UsageInfo } from '../types';
import { sanitizeProviderError } from '../utils/error-sanitizer';
import { resolveProvider } from '../services/pricing';

type Variables = { walletAddress: string };

const responses = new Hono<{ Variables: Variables }>();

interface OpenAIUsage {
	input_tokens?: number;
	output_tokens?: number;
	input_tokens_details?: {
		cached_tokens?: number;
	};
}

function normalizeUsage(
	usage: OpenAIUsage | null | undefined,
): UsageInfo | null {
	if (!usage) return null;
	const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0;
	return {
		inputTokens: (usage.input_tokens ?? 0) - cachedTokens,
		outputTokens: usage.output_tokens ?? 0,
		cachedInputTokens: cachedTokens,
		cacheCreationInputTokens: 0,
	};
}

function isProModel(model: string): boolean {
	return (
		model.includes('-pro') ||
		model.includes('o1-pro') ||
		model.includes('o3-pro')
	);
}

async function handleResponses(c: Context<{ Variables: Variables }>) {
	const walletAddress = c.get('walletAddress');
	const body = await c.req.json();
	const model = body.model;

	if (!model) {
		return c.json({ error: 'Model is required' }, 400);
	}

	const provider = resolveProvider(model);
	if (provider !== 'openai') {
		return c.json({ error: 'This endpoint only supports OpenAI models' }, 400);
	}

	const isStream = Boolean(body.stream);
	const isPro = isProModel(model);

	const requestBody = {
		...body,
		...(isPro && { background: true }),
	};

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.openai.apiKey}`,
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('OpenAI error:', response.status, error);
		const sanitized = sanitizeProviderError(error, response.status);
		return c.json(
			{ error: sanitized.message, code: sanitized.code },
			sanitized.status as ContentfulStatusCode,
		);
	}

	if (isStream) {
		return stream(c, async (writer) => {
			const reader = response.body?.getReader();
			if (!reader) {
				await writer.write('data: {"error": "No response body"}\n\n');
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';
			let usage: UsageInfo | null = null;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					await writer.write(`${line}\n`);

					if (line.startsWith('data:')) {
						try {
							const data = JSON.parse(line.slice(5).trim());
							if (data.type === 'response.completed' && data.response?.usage) {
								usage = normalizeUsage(data.response.usage);
							}
							if (data.usage) {
								usage = normalizeUsage(data.usage);
							}
						} catch {}
					}
				}
			}

			if (usage) {
				const { cost, newBalance } = await deductCost(
					walletAddress,
					'openai',
					model,
					usage,
					config.markup,
				);

				const costData = {
					cost_usd: cost.toFixed(8),
					balance_remaining: newBalance.toFixed(8),
					input_tokens: usage.inputTokens,
					output_tokens: usage.outputTokens,
				};
				await writer.write(`: setu ${JSON.stringify(costData)}\n`);
			}
		});
	}

	const json = await response.json();
	const usage = normalizeUsage(json.usage);

	if (usage) {
		const { cost, newBalance } = await deductCost(
			walletAddress,
			'openai',
			model,
			usage,
			config.markup,
		);

		return c.json(json, 200, {
			'x-balance-remaining': newBalance.toFixed(8),
			'x-cost-usd': cost.toFixed(8),
		});
	}

	return c.json(json);
}

responses.post('/v1/responses', walletAuth, balanceCheck, handleResponses);

export default responses;
