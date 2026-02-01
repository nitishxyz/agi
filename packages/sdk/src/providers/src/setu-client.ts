import { Buffer } from 'node:buffer';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createPaymentHeader } from 'x402/client';
import type { PaymentRequirements } from 'x402/types';
import { svm } from 'x402/shared';
import nacl from 'tweetnacl';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { addAnthropicCacheControl } from './anthropic-caching.ts';

function simplifyPaymentError(errMsg: string): string {
	const lower = errMsg.toLowerCase();
	if (
		lower.includes('insufficient') ||
		lower.includes('not enough') ||
		lower.includes('balance')
	) {
		return 'Insufficient USDC balance';
	}
	if (lower.includes('simulation') || lower.includes('compute unit')) {
		return 'Transaction simulation failed';
	}
	if (lower.includes('blockhash') || lower.includes('expired')) {
		return 'Transaction expired, please retry';
	}
	if (lower.includes('timeout') || lower.includes('timed out')) {
		return 'Transaction timed out';
	}
	if (lower.includes('rejected') || lower.includes('cancelled')) {
		return 'Transaction rejected';
	}
	if (lower.includes('network') || lower.includes('connection')) {
		return 'Network error';
	}
	const short = errMsg.split('.')[0].slice(0, 80);
	return short.length < errMsg.length ? `${short}...` : errMsg;
}

const DEFAULT_BASE_URL = 'https://api.setu.nitish.sh';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_PAYMENT_ATTEMPTS = 20;

export type SetuPaymentCallbacks = {
	onPaymentRequired?: (amountUsd: number, currentBalance?: number) => void;
	onPaymentSigning?: () => void;
	onPaymentComplete?: (data: {
		amountUsd: number;
		newBalance: number;
		transactionId?: string;
	}) => void;
	onPaymentError?: (error: string) => void;
	onPaymentApproval?: (info: {
		amountUsd: number;
		currentBalance: number;
	}) => Promise<'crypto' | 'fiat' | 'cancel'>;
};

export type SetuProviderOptions = {
	baseURL?: string;
	rpcURL?: string;
	network?: string;
	maxRequestAttempts?: number;
	maxPaymentAttempts?: number;
	callbacks?: SetuPaymentCallbacks;
	providerNpm?: string;
	promptCacheKey?: string;
	promptCacheRetention?: 'in_memory' | '24h';
	topupApprovalMode?: 'auto' | 'approval';
};

export type SetuAuth = {
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
		console.log('[Setu] Waiting for pending payment to complete...');
		await existing.promise;
	}

	return () => {
		if (paymentQueues.get(walletAddress) === entry) {
			paymentQueues.delete(walletAddress);
		}
		resolveFunc();
	};
}

export function createSetuFetch(
	auth: SetuAuth,
	options: SetuProviderOptions = {},
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
	const topupApprovalMode = options.topupApprovalMode ?? 'auto';

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

					addAnthropicCacheControl(parsed);
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
				throw new Error('Setu: unsupported payment requirement');
			}
			if (attempt >= maxAttempts) {
				callbacks.onPaymentError?.('Payment failed after multiple attempts');
				throw new Error('Setu: payment failed after multiple attempts');
			}

			const currentAttempts = globalPaymentAttempts.get(walletAddress) ?? 0;
			const remainingPayments = maxPaymentAttempts - currentAttempts;
			if (remainingPayments <= 0) {
				callbacks.onPaymentError?.('Maximum payment attempts exceeded');
				throw new Error('Setu: payment failed after maximum payment attempts.');
			}

			const releaseLock = await acquirePaymentLock(walletAddress);

			try {
				const amountUsd =
					parseInt(requirement.maxAmountRequired, 10) / 1_000_000;

				if (topupApprovalMode === 'approval' && callbacks.onPaymentApproval) {
					const approval = await callbacks.onPaymentApproval({
						amountUsd,
						currentBalance: 0,
					});

					if (approval === 'cancel') {
						callbacks.onPaymentError?.('Payment cancelled by user');
						throw new Error('Setu: payment cancelled by user');
					}

					if (approval === 'fiat') {
						const err = new Error('Setu: fiat payment selected');
						(err as Error & { code: string }).code = 'SETU_FIAT_SELECTED';
						throw err;
					}
				}

				callbacks.onPaymentRequired?.(amountUsd, 0);

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

		throw new Error('Setu: max attempts exceeded');
	};
}

/**
 * Create a Setu-backed AI model.
 *
 * Uses native AI SDK providers:
 * - OpenAI models → /v1/responses (via @ai-sdk/openai)
 * - Anthropic models → /v1/messages (via @ai-sdk/anthropic)
 * - Moonshot models → /v1/chat/completions (via @ai-sdk/openai-compatible)
 *
 * Provider is determined by options.providerNpm from catalog.
 */
export function createSetuModel(
	model: string,
	auth: SetuAuth,
	options: SetuProviderOptions = {},
) {
	const baseURL = `${trimTrailingSlash(
		options.baseURL ?? DEFAULT_BASE_URL,
	)}/v1`;
	const customFetch = createSetuFetch(auth, options);
	const providerNpm = options.providerNpm ?? '@ai-sdk/openai';

	if (providerNpm === '@ai-sdk/anthropic') {
		const anthropic = createAnthropic({
			baseURL,
			apiKey: 'setu-wallet-auth',
			fetch: customFetch,
		});
		return anthropic(model);
	}

	if (providerNpm === '@ai-sdk/openai-compatible') {
		const compatible = createOpenAICompatible({
			name: 'setu-moonshot',
			baseURL,
			headers: {
				Authorization: 'Bearer setu-wallet-auth',
			},
			fetch: customFetch,
		});
		return compatible(model);
	}

	// Default to OpenAI
	const openai = createOpenAI({
		baseURL,
		apiKey: 'setu-wallet-auth',
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
	callbacks: SetuPaymentCallbacks;
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
			`Setu balance still negative (${balanceValue.toFixed(8)}). Sending another top-up...`,
		);
	}
	throw new Error(`Setu: payment failed after ${attempts} additional top-ups.`);
}

async function processSinglePayment(args: {
	requirement: ExactPaymentRequirement;
	keypair: Keypair;
	rpcURL: string;
	baseURL: string;
	baseFetch: typeof fetch;
	buildWalletHeaders: () => Record<string, string>;
	callbacks: SetuPaymentCallbacks;
}): Promise<{ attempts: number; balance?: number | string }> {
	args.callbacks.onPaymentSigning?.();

	let paymentPayload: PaymentPayload;
	try {
		paymentPayload = await createPaymentPayload(args);
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		const userMsg = `Payment failed: ${simplifyPaymentError(errMsg)}`;
		args.callbacks.onPaymentError?.(userMsg);
		throw new Error(`Setu: ${userMsg}`);
	}
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
			console.log('Setu payment already processed; continuing.');
			return { attempts: 1 };
		}
		args.callbacks.onPaymentError?.(`Topup failed: ${response.status}`);
		throw new Error(`Setu topup failed (${response.status}): ${rawBody}`);
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
			`Setu payment complete: +$${amountUsd} (balance: $${newBalance})`,
		);
		return { attempts: 1, balance: newBalance };
	}
	console.log('Setu payment complete.');
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

export type SetuBalanceResponse = {
	walletAddress: string;
	balance: number;
	totalSpent: number;
	totalTopups: number;
	requestCount: number;
	createdAt?: string;
	lastRequest?: string;
};

export async function fetchSetuBalance(
	auth: SetuAuth,
	baseURL?: string,
): Promise<SetuBalanceResponse | null> {
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
	auth: SetuAuth,
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
