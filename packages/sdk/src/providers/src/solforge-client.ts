import { Buffer } from 'node:buffer';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createPaymentHeader } from 'x402/client';
import type { PaymentRequirements } from 'x402/types';
import { svm } from 'x402/shared';
import nacl from 'tweetnacl';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const DEFAULT_BASE_URL = 'https://ai.solforge.sh';
const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';
const DEFAULT_TOPUP_AMOUNT = '100000'; // $0.10
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_PAYMENT_ATTEMPTS = 20;

export type SolforgeProviderOptions = {
	baseURL?: string;
	rpcURL?: string;
	network?: string;
	topupAmountMicroUsdc?: string;
	maxRequestAttempts?: number;
	maxPaymentAttempts?: number;
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
	amount_usd: number;
	new_balance: number;
};

export function createSolforgeFetch(
	auth: SolforgeAuth,
	options: SolforgeProviderOptions = {},
): typeof fetch {
	const privateKeyBytes = bs58.decode(auth.privateKey);
	const keypair = Keypair.fromSecretKey(privateKeyBytes);
	const walletAddress = keypair.publicKey.toBase58();
	const baseURL = trimTrailingSlash(options.baseURL ?? DEFAULT_BASE_URL);
	const rpcURL = options.rpcURL ?? DEFAULT_RPC_URL;
	const targetTopup = options.topupAmountMicroUsdc ?? DEFAULT_TOPUP_AMOUNT;
	const maxAttempts = options.maxRequestAttempts ?? DEFAULT_MAX_ATTEMPTS;
	const maxPaymentAttempts =
		options.maxPaymentAttempts ?? DEFAULT_MAX_PAYMENT_ATTEMPTS;

	const baseFetch = globalThis.fetch.bind(globalThis);
	let paymentAttempts = 0;

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
			const headers = new Headers(init?.headers);
			const walletHeaders = buildWalletHeaders();
			headers.set('x-wallet-address', walletHeaders['x-wallet-address']);
			headers.set('x-wallet-nonce', walletHeaders['x-wallet-nonce']);
			headers.set('x-wallet-signature', walletHeaders['x-wallet-signature']);
			const response = await baseFetch(input, { ...init, headers });

			if (response.status !== 402) {
				return response;
			}

			const payload = await response.json().catch(() => ({}));
			const requirement = pickPaymentRequirement(payload, targetTopup);
			if (!requirement) {
				throw new Error('Solforge: unsupported payment requirement');
			}
			if (attempt >= maxAttempts) {
				throw new Error('Solforge: payment failed after multiple attempts');
			}

			const remainingPayments = maxPaymentAttempts - paymentAttempts;
			if (remainingPayments <= 0) {
				throw new Error(
					'Solforge: payment failed after maximum payment attempts.',
				);
			}

			const outcome = await handlePayment({
				requirement,
				keypair,
				rpcURL,
				baseURL,
				baseFetch,
				buildWalletHeaders,
				maxAttempts: remainingPayments,
			});
			paymentAttempts += outcome.attemptsUsed;
		}

		throw new Error('Solforge: max attempts exceeded');
	};
}

export function createSolforgeModel(
	model: string,
	auth: SolforgeAuth,
	options: SolforgeProviderOptions = {},
) {
	const baseURL = `${trimTrailingSlash(
		options.baseURL ?? DEFAULT_BASE_URL,
	)}/v1`;
	const fetch = createSolforgeFetch(auth, options);
	const provider = createOpenAICompatible({
		name: 'solforge',
		baseURL,
		headers: { 'Content-Type': 'application/json' },
		fetch,
	});
	return provider(model);
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
	targetAmount: string,
): ExactPaymentRequirement | null {
	const acceptsValue =
		typeof payload === 'object' && payload !== null
			? (payload as PaymentRequirementResponse).accepts
			: undefined;
	const accepts = Array.isArray(acceptsValue)
		? (acceptsValue as ExactPaymentRequirement[])
		: [];
	const exactMatch = accepts.find(
		(option) =>
			option &&
			option.scheme === 'exact' &&
			option.maxAmountRequired === targetAmount,
	);
	if (exactMatch) return exactMatch;
	const fallback = accepts.find(
		(option) => option && option.scheme === 'exact',
	);
	return fallback ?? null;
}

async function handlePayment(args: {
	requirement: ExactPaymentRequirement;
	keypair: Keypair;
	rpcURL: string;
	baseURL: string;
	baseFetch: typeof fetch;
	buildWalletHeaders: () => Record<string, string>;
	maxAttempts: number;
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
}): Promise<{ attempts: number; balance?: number | string }> {
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
		throw new Error(`Solforge topup failed (${response.status}): ${rawBody}`);
	}

	let parsed: PaymentResponse | undefined;
	try {
		parsed = rawBody ? (JSON.parse(rawBody) as PaymentResponse) : undefined;
	} catch {
		parsed = undefined;
	}

	if (parsed) {
		console.log(
			`Solforge payment complete: +$${parsed.amount_usd ?? 0} (balance: $${parsed.new_balance ?? 0})`,
		);
		return { attempts: 1, balance: parsed.new_balance };
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
