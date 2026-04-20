import { Keypair, Connection } from '@solana/web3.js';
import type { WalletContext } from './auth.ts';
import type { PaymentCallbacks, FetchFunction } from './types.ts';
import type { AccessTokenManager } from './token.ts';

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

export interface TopupRequiredPayload {
	error?: {
		topup_required?: boolean;
	};
	topup?: {
		amounts?: number[];
		minAmount?: number;
		endpoint?: string;
	};
}

export function isTopupRequired(
	payload: unknown,
): payload is TopupRequiredPayload {
	if (typeof payload !== 'object' || payload === null) return false;
	const p = payload as TopupRequiredPayload;
	return p.error?.topup_required === true;
}

export function pickTopupAmount(payload: TopupRequiredPayload): number {
	const amounts = payload.topup?.amounts;
	if (amounts && amounts.length > 0) {
		const firstAmount = amounts[0];
		if (firstAmount !== undefined) return firstAmount;
	}
	return payload.topup?.minAmount ?? 5;
}

function resolveKeypair(wallet: WalletContext): Keypair {
	if (wallet.keypair) return wallet.keypair;
	if (wallet.privateKeyBytes)
		return Keypair.fromSecretKey(wallet.privateKeyBytes);
	throw new Error(
		'OttoRouter: payments require a privateKey for on-chain transactions.',
	);
}

export async function createMppxFetch(
	wallet: WalletContext,
	rpcURL: string,
	baseFetch: FetchFunction,
): Promise<FetchFunction> {
	const keypair = resolveKeypair(wallet);
	const connection = new Connection(rpcURL, 'confirmed');

	const { Mppx } = await import('mppx/client');
	const { client: solanaClient } = await import('mppx-solana');

	const mppx = Mppx.create({
		fetch: baseFetch as typeof globalThis.fetch,
		methods: [
			solanaClient({
				connection,
				signer: keypair,
			}),
		],
		polyfill: false,
	});

	return mppx.fetch as FetchFunction;
}

export async function handleTopup(args: {
	baseURL: string;
	amount: number;
	wallet: WalletContext;
	rpcURL: string;
	baseFetch: FetchFunction;
	tokenManager: AccessTokenManager;
	callbacks: PaymentCallbacks;
}): Promise<{ balance?: number }> {
	args.callbacks.onPaymentSigning?.();

	const mppxFetch = await createMppxFetch(
		args.wallet,
		args.rpcURL,
		args.baseFetch,
	);
	const topupUrl = `${args.baseURL}/v1/topup/${args.amount}`;

	try {
		const walletHeaders = await (
			args.wallet.buildWalletAuthHeaders ?? args.wallet.buildHeaders
		)();
		const response = await mppxFetch(topupUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...walletHeaders,
			},
		});

		if (!response.ok) {
			const rawBody = await response.text().catch(() => '');
			if (
				response.status === 400 &&
				rawBody.toLowerCase().includes('already processed')
			) {
				return {};
			}
			args.callbacks.onPaymentError?.(`Topup failed: ${response.status}`);
			throw new Error(
				`OttoRouter topup failed (${response.status}): ${rawBody}`,
			);
		}

		const parsed = (await response.json().catch(() => ({}))) as {
			amount_usd?: number | string;
			new_balance?: number | string;
			amount?: number;
			balance?: number;
			transaction?: string;
		};

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

		return { balance: newBalance };
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		const userMsg = `Payment failed: ${simplifyPaymentError(errMsg)}`;
		args.callbacks.onPaymentError?.(userMsg);
		throw new Error(`OttoRouter: ${userMsg}`);
	}
}
