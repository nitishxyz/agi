import type { WalletContext } from './auth.ts';
import type {
	PaymentCallbacks,
	PaymentOptions,
	CacheOptions,
	BalanceUpdate,
} from './types.ts';
import { pickPaymentRequirement, handlePayment } from './payment.ts';
import { addAnthropicCacheControl } from './cache.ts';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_PAYMENT_ATTEMPTS = 20;

interface PaymentQueueEntry {
	promise: Promise<void>;
	resolve: () => void;
}

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
		await existing.promise;
	}

	return () => {
		if (paymentQueues.get(walletAddress) === entry) {
			paymentQueues.delete(walletAddress);
		}
		resolveFunc();
	};
}

function tryParseSetuComment(
	line: string,
	onBalanceUpdate: (update: BalanceUpdate) => void,
) {
	const trimmed = line.replace(/\r$/, '');
	if (!trimmed.startsWith(': setu ')) return;
	try {
		const data = JSON.parse(trimmed.slice(7));
		onBalanceUpdate({
			costUsd: parseFloat(data.cost_usd ?? '0'),
			balanceRemaining: parseFloat(data.balance_remaining ?? '0'),
			inputTokens: data.input_tokens ? Number(data.input_tokens) : undefined,
			outputTokens: data.output_tokens ? Number(data.output_tokens) : undefined,
		});
	} catch {}
}

function wrapResponseWithBalanceSniffing(
	response: Response,
	callbacks: PaymentCallbacks,
): Response {
	if (!callbacks.onBalanceUpdate) return response;

	const balanceHeader = response.headers.get('x-balance-remaining');
	const costHeader = response.headers.get('x-cost-usd');
	if (balanceHeader && costHeader) {
		callbacks.onBalanceUpdate({
			costUsd: parseFloat(costHeader),
			balanceRemaining: parseFloat(balanceHeader),
		});
		return response;
	}

	if (!response.body) return response;

	const onBalanceUpdate = callbacks.onBalanceUpdate;
	let partial = '';
	const decoder = new TextDecoder();
	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			controller.enqueue(chunk);
			partial += decoder.decode(chunk, { stream: true });
			let nlIndex = partial.indexOf('\n');
			while (nlIndex !== -1) {
				const line = partial.slice(0, nlIndex);
				partial = partial.slice(nlIndex + 1);
				tryParseSetuComment(line, onBalanceUpdate);
				nlIndex = partial.indexOf('\n');
			}
		},
		flush() {
			if (partial.trim()) {
				tryParseSetuComment(partial, onBalanceUpdate);
			}
		},
	});

	return new Response(response.body.pipeThrough(transform), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}

async function getWalletUsdcBalance(
	walletAddress: string,
	rpcUrl: string,
): Promise<number> {
	const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
	const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

	try {
		const usdcMint = rpcUrl.includes('devnet')
			? USDC_MINT_DEVNET
			: USDC_MINT_MAINNET;
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
		if (!response.ok) return 0;
		const data = (await response.json()) as {
			result?: {
				value?: Array<{
					account: {
						data: { parsed: { info: { tokenAmount: { uiAmount: number } } } };
					};
				}>;
			};
		};
		let total = 0;
		for (const acct of data.result?.value ?? []) {
			total += acct.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
		}
		return total;
	} catch {
		return 0;
	}
}

export interface CreateSetuFetchOptions {
	wallet: WalletContext;
	baseURL: string;
	rpcURL?: string;
	callbacks?: PaymentCallbacks;
	cache?: CacheOptions;
	payment?: PaymentOptions;
}

export function createSetuFetch(options: CreateSetuFetchOptions) {
	const {
		wallet,
		baseURL,
		rpcURL = DEFAULT_RPC_URL,
		callbacks = {},
		cache,
		payment,
	} = options;

	const maxAttempts = payment?.maxRequestAttempts ?? DEFAULT_MAX_ATTEMPTS;
	const maxPaymentAttempts =
		payment?.maxPaymentAttempts ?? DEFAULT_MAX_PAYMENT_ATTEMPTS;
	const topupApprovalMode = payment?.topupApprovalMode ?? 'auto';
	const autoPayThresholdUsd = payment?.autoPayThresholdUsd ?? 0;
	const baseFetch = globalThis.fetch.bind(globalThis);

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
					if (cache?.promptCacheKey)
						parsed.prompt_cache_key = cache.promptCacheKey;
					if (cache?.promptCacheRetention)
						parsed.prompt_cache_retention = cache.promptCacheRetention;
					const cacheConfig = cache?.anthropicCaching;
					if (cacheConfig !== false) {
						const anthropicConfig =
							typeof cacheConfig === 'object' ? cacheConfig : undefined;
						addAnthropicCacheControl(parsed, anthropicConfig);
					}
					body = JSON.stringify(parsed);
				} catch {}
			}

			const headers = new Headers(init?.headers);
			const walletHeaders = await wallet.buildHeaders();
			headers.set('x-wallet-address', walletHeaders['x-wallet-address']);
			headers.set('x-wallet-nonce', walletHeaders['x-wallet-nonce']);
			headers.set('x-wallet-signature', walletHeaders['x-wallet-signature']);

			const response = await baseFetch(input, { ...init, body, headers });

			if (response.status !== 402) {
				return wrapResponseWithBalanceSniffing(response, callbacks);
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

			const currentAttempts =
				globalPaymentAttempts.get(wallet.walletAddress) ?? 0;
			const remainingPayments = maxPaymentAttempts - currentAttempts;
			if (remainingPayments <= 0) {
				callbacks.onPaymentError?.('Maximum payment attempts exceeded');
				throw new Error('Setu: payment failed after maximum payment attempts.');
			}

			const releaseLock = await acquirePaymentLock(wallet.walletAddress);

			try {
				const amountUsd =
					parseInt(requirement.maxAmountRequired, 10) / 1_000_000;
				let walletUsdcBalance = 0;
				if (autoPayThresholdUsd > 0) {
					walletUsdcBalance = await getWalletUsdcBalance(
						wallet.walletAddress,
						rpcURL,
					);
				}

				const canAutoPay =
					autoPayThresholdUsd > 0 && walletUsdcBalance >= autoPayThresholdUsd;

				const requestApproval = async () => {
					if (!callbacks.onPaymentApproval) return;
					const approval = await callbacks.onPaymentApproval({
						amountUsd,
						currentBalance: walletUsdcBalance,
					});
					if (approval === 'cancel') {
						callbacks.onPaymentError?.('Payment cancelled by user');
						throw new Error('Setu: payment cancelled by user');
					}
					if (approval === 'fiat') {
						const err = new Error('Setu: fiat payment selected') as Error & {
							code: string;
						};
						err.code = 'SETU_FIAT_SELECTED';
						throw err;
					}
				};

				if (!canAutoPay && topupApprovalMode === 'approval') {
					await requestApproval();
				}

				callbacks.onPaymentRequired?.(amountUsd, walletUsdcBalance);

				const doPayment = async () => {
					const outcome = await handlePayment({
						requirement,
						wallet,
						rpcURL,
						baseURL,
						baseFetch,
						maxAttempts: remainingPayments,
						callbacks,
					});
					const newTotal = currentAttempts + outcome.attemptsUsed;
					globalPaymentAttempts.set(wallet.walletAddress, newTotal);
				};

				if (canAutoPay) {
					try {
						await doPayment();
					} catch {
						await requestApproval();
						await doPayment();
					}
				} else {
					await doPayment();
				}
			} finally {
				releaseLock();
			}
		}

		throw new Error('Setu: max attempts exceeded');
	};
}
