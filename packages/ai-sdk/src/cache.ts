import type { AnthropicCacheConfig, AnthropicCachePlacement } from './types.ts';

interface MessageBlock {
	type: string;
	cache_control?: { type: string };
	[key: string]: unknown;
}

interface Message {
	role: string;
	content: unknown;
	[key: string]: unknown;
}

interface ParsedBody {
	system?: MessageBlock[];
	messages?: Message[];
	[key: string]: unknown;
}

const DEFAULT_CONFIG: Required<Omit<AnthropicCacheConfig, 'transform'>> = {
	strategy: 'auto',
	systemBreakpoints: 1,
	messageBreakpoints: 1,
	systemPlacement: 'first',
	messagePlacement: 'last',
	cacheType: 'ephemeral',
};

function resolveConfig(config?: AnthropicCacheConfig): Required<
	Omit<AnthropicCacheConfig, 'transform'>
> & {
	transform?: AnthropicCacheConfig['transform'];
} {
	if (!config) return { ...DEFAULT_CONFIG };
	return {
		strategy: config.strategy ?? DEFAULT_CONFIG.strategy,
		systemBreakpoints:
			config.systemBreakpoints ?? DEFAULT_CONFIG.systemBreakpoints,
		messageBreakpoints:
			config.messageBreakpoints ?? DEFAULT_CONFIG.messageBreakpoints,
		systemPlacement: config.systemPlacement ?? DEFAULT_CONFIG.systemPlacement,
		messagePlacement:
			config.messagePlacement ?? DEFAULT_CONFIG.messagePlacement,
		cacheType: config.cacheType ?? DEFAULT_CONFIG.cacheType,
		transform: config.transform,
	};
}

function shouldCacheAtIndex(
	index: number,
	total: number,
	maxBreakpoints: number,
	placement: AnthropicCachePlacement,
): boolean {
	if (maxBreakpoints <= 0) return false;

	switch (placement) {
		case 'first': {
			return index < maxBreakpoints;
		}
		case 'last': {
			const startFrom = total - maxBreakpoints;
			return index >= startFrom && index < total;
		}
		case 'all': {
			return true;
		}
	}
}

function injectCacheOnBlocks(
	blocks: MessageBlock[],
	maxBreakpoints: number,
	placement: AnthropicCachePlacement,
	cacheType: string,
): { blocks: MessageBlock[]; used: number } {
	let used = 0;
	const eligible = blocks.map((_, i) =>
		shouldCacheAtIndex(i, blocks.length, maxBreakpoints, placement),
	);
	const result = blocks.map((block, i) => {
		if (block.cache_control) return block;
		if (used < maxBreakpoints && eligible[i]) {
			used++;
			return { ...block, cache_control: { type: cacheType } };
		}
		return block;
	});
	return { blocks: result, used };
}

export function addAnthropicCacheControl(
	parsed: ParsedBody,
	config?: AnthropicCacheConfig,
): ParsedBody {
	const resolved = resolveConfig(config);

	if (resolved.strategy === false) return parsed;

	if (resolved.strategy === 'manual') return parsed;

	if (resolved.strategy === 'custom' && resolved.transform) {
		return resolved.transform(parsed as Record<string, unknown>) as ParsedBody;
	}

	let _systemUsed = 0;

	if (parsed.system && Array.isArray(parsed.system)) {
		const result = injectCacheOnBlocks(
			parsed.system,
			resolved.systemBreakpoints,
			resolved.systemPlacement,
			resolved.cacheType,
		);
		parsed.system = result.blocks;
		_systemUsed = result.used;
	}

	if (parsed.messages && Array.isArray(parsed.messages)) {
		let messageUsed = 0;
		const messageCount = parsed.messages.length;

		const eligibleIndices: number[] = [];
		for (let i = 0; i < messageCount; i++) {
			if (
				shouldCacheAtIndex(
					i,
					messageCount,
					resolved.messageBreakpoints,
					resolved.messagePlacement,
				)
			) {
				eligibleIndices.push(i);
			}
		}

		parsed.messages = parsed.messages.map((msg, msgIndex) => {
			if (messageUsed >= resolved.messageBreakpoints) return msg;
			if (!eligibleIndices.includes(msgIndex)) return msg;

			if (Array.isArray(msg.content)) {
				const blocks = msg.content as MessageBlock[];
				const lastIdx = blocks.length - 1;
				const content = blocks.map((block, blockIndex) => {
					if (block.cache_control) return block;
					if (
						blockIndex === lastIdx &&
						messageUsed < resolved.messageBreakpoints
					) {
						messageUsed++;
						return { ...block, cache_control: { type: resolved.cacheType } };
					}
					return block;
				});
				return { ...msg, content };
			}

			if (
				typeof msg.content === 'string' &&
				messageUsed < resolved.messageBreakpoints
			) {
				messageUsed++;
				return {
					...msg,
					content: [
						{
							type: 'text',
							text: msg.content,
							cache_control: { type: resolved.cacheType },
						},
					],
				};
			}

			return msg;
		});
	}

	return parsed;
}
