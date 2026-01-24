import { Buffer } from 'node:buffer';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createPaymentHeader } from 'x402/client';
import type { PaymentRequirements } from 'x402/types';
import { svm } from 'x402/shared';
import nacl from 'tweetnacl';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

const DEFAULT_BASE_URL = 'https://router.solforge.sh';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_PAYMENT_ATTEMPTS = 20;

export type SolforgePaymentCallbacks = {
	onPaymentRequired?: (amountUsd: number) => void;
	onPaymentSigning?: () => void;
	onPaymentComplete?: (data: {
		amountUsd: number;
		newBalance: number;
		transactionId?: string;
	}) => void;
	onPaymentError?: (error: string) => void;
};

export type SolforgeProviderOptions = {
	baseURL?: string;
	rpcURL?: string;
	network?: string;
	maxRequestAttempts?: number;
	maxPaymentAttempts?: number;
	callbacks?: SolforgePaymentCallbacks;
	providerNpm?: string;
	promptCacheKey?: string;
	promptCacheRetention?: 'in_memory' | '24h';
};

export type SolforgeAuth = {
	privateKey: string;
};

type ExactPaymentRequirement = {
	scheme: 'exact';
	network: string;
	maxAmountRequired: string;
	asset: string;
	payTo: string;
	description?: string;
	resource?: string;
	extra?: Record<string, unknown>;
	maxTimeoutSeconds?: number;
};

type PaymentPayload = {
	x402Version: 1;
	scheme: 'exact';
	network: string;
	payload: { transaction: string };
};

type PaymentResponse = {
	amount_usd?: number | string;
	new_balance?: number | string;
	amount?: number;
	balance?: number;
	transaction?: string;
};

type PaymentQueueEntry = {
	promise: Promise<void>;
	resolve: () => void;
};

const paymentQueues = new Map<string, PaymentQueueEntry>();
const globalPaymentAttempts = new Map<string, number>();

async function acquirePaymentLock(walletAddress: string): Promise<() => void> {
	const existing = paymentQueues.get(walletAddress);

	let resolveFunc: () => void = () => {};
	const newPromise = new Promise<void>((resolve) => {
		resolveFunc = resolve;
	});

	const entry: PaymentQueueEntry = {
		promise: newPromise,
		resolve: resolveFunc,
	};

	paymentQueues.set(walletAddress, entry);

	if (existing) {
		console.log('[Solforge] Waiting for pending payment to complete...');
		await existing.promise;
	}

	return () => {
		if (paymentQueues.get(walletAddress) === entry) {
			paymentQueues.delete(walletAddress);
		}
		resolveFunc();
	};
}

export function createSolforgeFetch(
	auth: SolforgeAuth,
	options: SolforgeProviderOptions = {},
): typeof fetch {
	const privateKeyBytes = bs58.decode(auth.privateKey);
	const keypair = Keypair.fromSecretKey(privateKeyBytes);
	const walletAddress = keypair.publicKey.toBase58();
	const baseURL = trimTrailingSlash(options.baseURL ?? DEFAULT_BASE_URL);
	const rpcURL = options.rpcURL ?? DEFAULT_RPC_URL;
	const maxAttempts = options.maxRequestAttempts ?? DEFAULT_MAX_ATTEMPTS;
	const maxPaymentAttempts =
		options.maxPaymentAttempts ?? DEFAULT_MAX_PAYMENT_ATTEMPTS;
	const callbacks = options.callbacks ?? {};
	const promptCacheKey = options.promptCacheKey;
	const promptCacheRetention = options.promptCacheRetention;

	const baseFetch = globalThis.fetch.bind(globalThis);

	const buildWalletHeaders = () => {
		const nonce = Date.now().toString();
		const signature = signNonce(nonce, privateKeyBytes);
		return {
			'x-wallet-address': walletAddress,
			'x-wallet-nonce': nonce,
			'x-wallet-signature': signature,
		};
	};

	return async (
		input: Parameters<typeof fetch>[0],
		init?: Parameters<typeof fetch>[1],
	) => {
		let attempt = 0;

		while (attempt < maxAttempts) {
			attempt++;
			let body = init?.body;
			if (body && typeof body === 'string') {
				try {
					const parsed = JSON.parse(body);

					if (promptCacheKey) parsed.prompt_cache_key = promptCacheKey;
					if (promptCacheRetention)
						parsed.prompt_cache_retention = promptCacheRetention;

					const MAX_SYSTEM_CACHE = 1;
					const MAX_MESSAGE_CACHE = 1;
					let systemCacheUsed = 0;
					let messageCacheUsed = 0;

					if (parsed.system && Array.isArray(parsed.system)) {
						parsed.system = parsed.system.map(
							(
								block: { type: string; cache_control?: unknown },
								index: number,
							) => {
								if (block.cache_control) return block;
								if (
									systemCacheUsed < MAX_SYSTEM_CACHE &&
									index === 0 &&
									block.type === 'text'
								) {
									systemCacheUsed++;
									return { ...block, cache_control: { type: 'ephemeral' } };
								}
								return block;
							},
						);
					}

					if (parsed.messages && Array.isArray(parsed.messages)) {
						const messageCount = parsed.messages.length;
						parsed.messages = parsed.messages.map(
							(
								msg: {
									role: string;
									content: unknown;
									[key: string]: unknown;
								},
								msgIndex: number,
							) => {
								const isLast = msgIndex === messageCount - 1;

								if (Array.isArray(msg.content)) {
									const blocks = msg.content as {
										type: string;
										cache_control?: unknown;
									}[];
									const content = blocks.map((block, blockIndex) => {
										if (block.cache_control) return block;
										if (
											isLast &&
											messageCacheUsed < MAX_MESSAGE_CACHE &&
											blockIndex === blocks.length - 1
										) {
											messageCacheUsed++;
											return { ...block, cache_control: { type: 'ephemeral' } };
										}
										return block;
									});
									return { ...msg, content };
								}

								if (
									isLast &&
									messageCacheUsed < MAX_MESSAGE_CACHE &&
									typeof msg.content === 'string'
								) {
									messageCacheUsed++;
									return {
										...msg,
										content: [
											{
												type: 'text',
												text: msg.content,
												cache_control: { type: 'ephemeral' },
											},
										],
									};
								}

								return msg;
							},
						);
					}

					body = JSON.stringify(parsed);
				} catch {}
			}
			const headers = new Headers(init?.headers);
			const walletHeaders = buildWalletHeaders();
			headers.set('x-wallet-address', walletHeaders['x-wallet-address']);
			headers.set('x-wallet-nonce', walletHeaders['x-wallet-nonce']);
			headers.set('x-wallet-signature', walletHeaders['x-wallet-signature']);
			const response = await baseFetch(input, { ...init, body, headers });

			if (response.status !== 402) {
				return response;
			}

			const payload = await response.json().catch(() => ({}));
			const requirement = pickPaymentRequirement(payload);
			if (!requirement) {
				callbacks.onPaymentError?.('Unsupported payment requirement');
				throw new Error('Solforge: unsupported payment requirement');
			}
			if (attempt >= maxAttempts) {
				callbacks.onPaymentError?.('Payment failed after multiple attempts');
				throw new Error('Solforge: payment failed after multiple attempts');
			}

			const currentAttempts = globalPaymentAttempts.get(walletAddress) ?? 0;
			const remainingPayments = maxPaymentAttempts - currentAttempts;
			if (remainingPayments <= 0) {
				callbacks.onPaymentError?.('Maximum payment attempts exceeded');
				throw new Error(
					'Solforge: payment failed after maximum payment attempts.',
				);
			}

			const releaseLock = await acquirePaymentLock(walletAddress);

			try {
				const amountUsd =
					parseInt(requirement.maxAmountRequired, 10) / 1_000_000;
				callbacks.onPaymentRequired?.(amountUsd);

				const outcome = await handlePayment({
					requirement,
					keypair,
					rpcURL,
					baseURL,
					baseFetch,
					buildWalletHeaders,
					maxAttempts: remainingPayments,
					callbacks,
				});

				const newTotal = currentAttempts + outcome.attemptsUsed;
				globalPaymentAttempts.set(walletAddress, newTotal);
			} finally {
				releaseLock();
			}
		}

		throw new Error('Solforge: max attempts exceeded');
	};
}

/**
 * Create a Solforge-backed AI model.
 *
 * Uses native AI SDK providers:
 * - OpenAI models → /v1/responses (via @ai-sdk/openai)
 * - Anthropic models → /v1/messages (via @ai-sdk/anthropic)
 *
 * Provider is determined by options.providerNpm from catalog.
 */
export function createSolforgeModel(
	model: string,
	auth: SolforgeAuth,
	options: SolforgeProviderOptions = {},
) {
	const baseURL = `${trimTrailingSlash(
		options.baseURL ?? DEFAULT_BASE_URL,
	)}/v1`;
	const customFetch = createSolforgeFetch(auth, options);
	const providerNpm = options.providerNpm ?? '@ai-sdk/openai';

	if (providerNpm === '@ai-sdk/anthropic') {
		const anthropic = createAnthropic({
			baseURL,
			apiKey: 'solforge-wallet-auth',
			fetch: customFetch,
		});
		return anthropic(model);
	}

	// Default to OpenAI
	const openai = createOpenAI({
		baseURL,
		apiKey: 'solforge-wallet-auth',
		fetch: customFetch,
	});
	return openai.responses(model);
}

function trimTrailingSlash(url: string) {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

function signNonce(nonce: string, secretKey: Uint8Array): string {
	const data = new TextEncoder().encode(nonce);
	const signature = nacl.sign.detached(data, secretKey);
	return bs58.encode(signature);
}

type PaymentRequirementResponse = {
	accepts?: unknown;
};

function pickPaymentRequirement(
	payload: unknown,
): ExactPaymentRequirement | null {
	const acceptsValue =
		typeof payload === 'object' && payload !== null
			? (payload as PaymentRequirementResponse).accepts
			: undefined;
	const accepts = Array.isArray(acceptsValue)
		? (acceptsValue as ExactPaymentRequirement[])
		: [];
	return accepts.find((option) => option && option.scheme === 'exact') ?? null;
}

async function handlePayment(args: {
	requirement: ExactPaymentRequirement;
	keypair: Keypair;
	rpcURL: string;
	baseURL: string;
	baseFetch: typeof fetch;
	buildWalletHeaders: () => Record<string, string>;
	maxAttempts: number;
	callbacks: SolforgePaymentCallbacks;
}): Promise<{ attemptsUsed: number }> {
	let attempts = 0;
	while (attempts < args.maxAttempts) {
		const result = await processSinglePayment(args);
		attempts += result.attempts;
		const balanceValue =
			typeof result.balance === 'number'
				? result.balance
				: result.balance != null
					? Number(result.balance)
					: undefined;
		if (
			balanceValue == null ||
			Number.isNaN(balanceValue) ||
			balanceValue >= 0
		) {
			return { attemptsUsed: attempts };
		}
		console.log(
			`Solforge balance still negative (${balanceValue.toFixed(8)}). Sending another top-up...`,
		);
	}
	throw new Error(
		`Solforge: payment failed after ${attempts} additional top-ups.`,
	);
}

async function processSinglePayment(args: {
	requirement: ExactPaymentRequirement;
	keypair: Keypair;
	rpcURL: string;
	baseURL: string;
	baseFetch: typeof fetch;
	buildWalletHeaders: () => Record<string, string>;
	callbacks: SolforgePaymentCallbacks;
}): Promise<{ attempts: number; balance?: number | string }> {
	args.callbacks.onPaymentSigning?.();

	const paymentPayload = await createPaymentPayload(args);
	const walletHeaders = args.buildWalletHeaders();
	const headers = {
		'Content-Type': 'application/json',
		...walletHeaders,
	};
	const response = await args.baseFetch(`${args.baseURL}/v1/topup`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			paymentPayload,
			paymentRequirement: args.requirement,
		}),
	});

	const rawBody = await response.text().catch(() => '');
	if (!response.ok) {
		if (
			response.status === 400 &&
			rawBody.toLowerCase().includes('already processed')
		) {
			console.log('Solforge payment already processed; continuing.');
			return { attempts: 1 };
		}
		args.callbacks.onPaymentError?.(`Topup failed: ${response.status}`);
		throw new Error(`Solforge topup failed (${response.status}): ${rawBody}`);
	}

	let parsed: PaymentResponse | undefined;
	try {
		parsed = rawBody ? (JSON.parse(rawBody) as PaymentResponse) : undefined;
	} catch {
		parsed = undefined;
	}

	if (parsed) {
		const amountUsd =
			typeof parsed.amount_usd === 'string'
				? parseFloat(parsed.amount_usd)
				: (parsed.amount_usd ?? parsed.amount ?? 0);
		const newBalance =
			typeof parsed.new_balance === 'string'
				? parseFloat(parsed.new_balance)
				: (parsed.new_balance ?? parsed.balance ?? 0);
		args.callbacks.onPaymentComplete?.({
			amountUsd,
			newBalance,
			transactionId: parsed.transaction,
		});
		console.log(
			`Solforge payment complete: +$${amountUsd} (balance: $${newBalance})`,
		);
		return { attempts: 1, balance: newBalance };
	}
	console.log('Solforge payment complete.');
	return { attempts: 1 };
}

async function createPaymentPayload(args: {
	requirement: ExactPaymentRequirement;
	keypair: Keypair;
	rpcURL: string;
}) {
	const privateKeyBase58 = bs58.encode(args.keypair.secretKey);
	const signer = await svm.createSignerFromBase58(privateKeyBase58);
	const header = await createPaymentHeader(
		signer,
		1,
		args.requirement as PaymentRequirements,
		{
			svmConfig: {
				rpcUrl: args.rpcURL,
			},
		},
	);
	const decoded = JSON.parse(
		Buffer.from(header, 'base64').toString('utf-8'),
	) as {
		payload: { transaction: string };
	};

	return {
		x402Version: 1,
		scheme: 'exact',
		network: args.requirement.network,
		payload: {
			transaction: decoded.payload.transaction,
		},
	} as PaymentPayload;
}

export type SolforgeBalanceResponse = {
	walletAddress: string;
	balance: number;
	totalSpent: number;
	totalTopups: number;
	requestCount: number;
	createdAt?: string;
	lastRequest?: string;
};

export async function fetchSolforgeBalance(
	auth: SolforgeAuth,
	baseURL?: string,
): Promise<SolforgeBalanceResponse | null> {
	try {
		const privateKeyBytes = bs58.decode(auth.privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		const walletAddress = keypair.publicKey.toBase58();
		const url = trimTrailingSlash(baseURL ?? DEFAULT_BASE_URL);

		const nonce = Date.now().toString();
		const signature = signNonce(nonce, privateKeyBytes);

		const response = await fetch(`${url}/v1/balance`, {
			headers: {
				'x-wallet-address': walletAddress,
				'x-wallet-nonce': nonce,
				'x-wallet-signature': signature,
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as {
			wallet_address: string;
			balance_usd: number;
			total_spent: number;
			total_topups: number;
			request_count: number;
			created_at?: string;
			last_request?: string;
		};

		return {
			walletAddress: data.wallet_address,
			balance: data.balance_usd,
			totalSpent: data.total_spent,
			totalTopups: data.total_topups,
			requestCount: data.request_count,
			createdAt: data.created_at,
			lastRequest: data.last_request,
		};
	} catch {
		return null;
	}
}

export function getPublicKeyFromPrivate(privateKey: string): string | null {
	try {
		const privateKeyBytes = bs58.decode(privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		return keypair.publicKey.toBase58();
	} catch {
		return null;
	}
}

const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export type SolanaUsdcBalanceResponse = {
	walletAddress: string;
	usdcBalance: number;
	network: 'mainnet' | 'devnet';
};

export async function fetchSolanaUsdcBalance(
	auth: SolforgeAuth,
	network: 'mainnet' | 'devnet' = 'mainnet',
): Promise<SolanaUsdcBalanceResponse | null> {
	try {
		const privateKeyBytes = bs58.decode(auth.privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		const walletAddress = keypair.publicKey.toBase58();

		const rpcUrl =
			network === 'devnet' ? 'https://api.devnet.solana.com' : DEFAULT_RPC_URL;

		const usdcMint =
			network === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;

		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'getTokenAccountsByOwner',
				params: [walletAddress, { mint: usdcMint }, { encoding: 'jsonParsed' }],
			}),
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as {
			result?: {
				value?: Array<{
					account: {
						data: {
							parsed: {
								info: {
									tokenAmount: {
										uiAmount: number;
									};
								};
							};
						};
					};
				}>;
			};
		};

		const accounts = data.result?.value ?? [];
		let totalUsdcBalance = 0;

		for (const account of accounts) {
			const uiAmount =
				account.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
			totalUsdcBalance += uiAmount;
		}

		return {
			walletAddress,
			usdcBalance: totalUsdcBalance,
			network,
		};
	} catch {
		return null;
	}
}
