import bs58 from 'bs58';
import { createPaymentHeader } from 'x402/client';
import { svm } from 'x402/shared';
import type { PaymentRequirements } from 'x402/types';
import type { WalletContext } from './auth.ts';
import type {
	ExactPaymentRequirement,
	PaymentPayload,
	PaymentCallbacks,
} from './types.ts';
import {
	address,
	getTransactionEncoder,
	getTransactionDecoder,
	type Transaction,
	type TransactionWithLifetime,
	type TransactionWithinSizeLimit,
} from '@solana/kit';

function simplifyPaymentError(errMsg: string): string {
	const lower = errMsg.toLowerCase();
	if (
		lower.includes('insufficient') ||
		lower.includes('not enough') ||
		lower.includes('balance')
	)
		return 'Insufficient USDC balance';
	if (lower.includes('simulation') || lower.includes('compute unit'))
		return 'Transaction simulation failed';
	if (lower.includes('blockhash') || lower.includes('expired'))
		return 'Transaction expired, please retry';
	if (lower.includes('timeout') || lower.includes('timed out'))
		return 'Transaction timed out';
	if (lower.includes('rejected') || lower.includes('cancelled'))
		return 'Transaction rejected';
	if (lower.includes('network') || lower.includes('connection'))
		return 'Network error';
	const short = (errMsg.split('.')[0] ?? errMsg).slice(0, 80);
	return short.length < errMsg.length ? `${short}...` : errMsg;
}

export function pickPaymentRequirement(
	payload: unknown,
): ExactPaymentRequirement | null {
	const acceptsValue =
		typeof payload === 'object' && payload !== null
			? (payload as { accepts?: unknown }).accepts
			: undefined;
	const accepts = Array.isArray(acceptsValue)
		? (acceptsValue as ExactPaymentRequirement[])
		: [];
	return accepts.find((opt) => opt && opt.scheme === 'exact') ?? null;
}

function wrapCallbackAsSigner(
	walletAddress: string,
	callback: (transaction: Uint8Array) => Promise<Uint8Array>,
) {
	const encoder = getTransactionEncoder();
	const decoder = getTransactionDecoder();
	return {
		address: address(walletAddress),
		modifyAndSignTransactions: async (
			transactions: readonly (
				| Transaction
				| (Transaction & TransactionWithLifetime)
			)[],
		): Promise<
			readonly (Transaction &
				TransactionWithinSizeLimit &
				TransactionWithLifetime)[]
		> => {
			const results = [];
			for (const tx of transactions) {
				const bytes = new Uint8Array(encoder.encode(tx));
				const signedBytes = await callback(bytes);
				const signed = decoder.decode(signedBytes);
				results.push(
					signed as Transaction &
						TransactionWithinSizeLimit &
						TransactionWithLifetime,
				);
			}
			return results;
		},
	};
}

async function resolvePaymentSigner(wallet: WalletContext) {
	if (wallet.signTransaction) {
		return wrapCallbackAsSigner(wallet.walletAddress, wallet.signTransaction);
	}
	if (wallet.keypair) {
		const privateKeyBase58 = bs58.encode(wallet.keypair.secretKey);
		return svm.createSignerFromBase58(privateKeyBase58);
	}
	throw new Error(
		'Setu: payments require either a privateKey or signer.signTransaction.',
	);
}

export async function createPaymentPayload(
	requirement: ExactPaymentRequirement,
	wallet: WalletContext,
	rpcURL: string,
): Promise<PaymentPayload> {
	const signer = await resolvePaymentSigner(wallet);
	const header = await createPaymentHeader(
		signer,
		1,
		requirement as PaymentRequirements,
		{ svmConfig: { rpcUrl: rpcURL } },
	);
	const decoded = JSON.parse(atob(header)) as {
		payload: { transaction: string };
	};

	return {
		x402Version: 1,
		scheme: 'exact',
		network: requirement.network,
		payload: { transaction: decoded.payload.transaction },
	};
}

interface PaymentResponse {
	amount_usd?: number | string;
	new_balance?: number | string;
	amount?: number;
	balance?: number;
	transaction?: string;
}

export async function processSinglePayment(args: {
	requirement: ExactPaymentRequirement;
	wallet: WalletContext;
	rpcURL: string;
	baseURL: string;
	baseFetch: typeof fetch;
	callbacks: PaymentCallbacks;
}): Promise<{ attempts: number; balance?: number | string }> {
	args.callbacks.onPaymentSigning?.();

	let paymentPayload: PaymentPayload;
	try {
		paymentPayload = await createPaymentPayload(
			args.requirement,
			args.wallet,
			args.rpcURL,
		);
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		const userMsg = `Payment failed: ${simplifyPaymentError(errMsg)}`;
		args.callbacks.onPaymentError?.(userMsg);
		throw new Error(`Setu: ${userMsg}`);
	}

	const walletHeaders = await args.wallet.buildHeaders();
	const response = await args.baseFetch(`${args.baseURL}/v1/topup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...walletHeaders },
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
		return { attempts: 1, balance: newBalance };
	}
	return { attempts: 1 };
}

export async function handlePayment(args: {
	requirement: ExactPaymentRequirement;
	wallet: WalletContext;
	rpcURL: string;
	baseURL: string;
	baseFetch: typeof fetch;
	maxAttempts: number;
	callbacks: PaymentCallbacks;
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
	}
	throw new Error(`Setu: payment failed after ${attempts} additional top-ups.`);
}
