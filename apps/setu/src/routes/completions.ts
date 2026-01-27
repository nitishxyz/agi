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

type Variables = { walletAddress: string };

const completions = new Hono<{ Variables: Variables }>();

interface OpenAIUsage {
	prompt_tokens?: number;
	completion_tokens?: number;
	prompt_tokens_details?: {
		cached_tokens?: number;
	};
}

function normalizeUsage(
	usage: OpenAIUsage | null | undefined,
): UsageInfo | null {
	if (!usage) return null;
	const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
	return {
		inputTokens: (usage.prompt_tokens ?? 0) - cachedTokens,
		outputTokens: usage.completion_tokens ?? 0,
		cachedInputTokens: cachedTokens,
		cacheCreationInputTokens: 0,
	};
}

function isMoonshotModel(model: string): boolean {
	return model.startsWith('kimi-') || model.startsWith('moonshot-');
}

async function handleCompletions(c: Context<{ Variables: Variables }>) {
	const walletAddress = c.get('walletAddress');
	const body = await c.req.json();
	const model = body.model;

	if (!model) {
		return c.json({ error: 'Model is required' }, 400);
	}

	if (!isMoonshotModel(model)) {
		return c.json(
			{ error: 'This endpoint only supports Moonshot models (kimi-*)' },
			400,
		);
	}

	const isStream = Boolean(body.stream);

	const response = await fetch(`${config.moonshot.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.moonshot.apiKey}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const error = await response.text();
		const sanitized = sanitizeProviderError(error, response.status);
		return c.json(
			{ error: sanitized.message },
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
						const dataStr = line.slice(5).trim();
						if (dataStr === '[DONE]') continue;
						try {
							const data = JSON.parse(dataStr);
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
					'moonshot',
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
			'moonshot',
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

completions.post(
	'/v1/chat/completions',
	walletAuth,
	balanceCheck,
	handleCompletions,
);

export default completions;
