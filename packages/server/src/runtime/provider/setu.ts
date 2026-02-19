import {
	createSetu,
	type SetuPaymentCallbacks,
	getAuth,
	loadConfig,
} from '@ottocode/sdk';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { isDevtoolsEnabled } from '../debug/state.ts';
import { publish } from '../../events/bus.ts';
import {
	waitForTopupMethodSelection,
	type TopupMethod,
} from '../topup/manager.ts';

const MIN_TOPUP_USD = 5;

export interface ResolveSetuModelOptions {
	messageId?: string;
	topupApprovalMode?: 'auto' | 'approval';
	autoPayThresholdUsd?: number;
}

async function getSetuPrivateKey(): Promise<string> {
	if (process.env.SETU_PRIVATE_KEY) {
		return process.env.SETU_PRIVATE_KEY;
	}
	try {
		const cfg = await loadConfig(process.cwd());
		const auth = await getAuth('setu', cfg.projectRoot);
		if (auth?.type === 'wallet' && auth.secret) {
			return auth.secret;
		}
	} catch {}
	return '';
}

export async function resolveSetuModel(
	model: string,
	sessionId?: string,
	options: ResolveSetuModelOptions = {},
) {
	const privateKey = await getSetuPrivateKey();
	if (!privateKey) {
		throw new Error(
			'Setu provider requires SETU_PRIVATE_KEY (base58 Solana secret).',
		);
	}
	const baseURL = process.env.SETU_BASE_URL;
	const rpcURL = process.env.SETU_SOLANA_RPC_URL;
	const {
		messageId,
		topupApprovalMode = 'approval',
		autoPayThresholdUsd = MIN_TOPUP_USD,
	} = options;

	const callbacks: SetuPaymentCallbacks = sessionId
		? {
				onPaymentRequired: (amountUsd, currentBalance) => {
					publish({
						type: 'setu.payment.required',
						sessionId,
						payload: { amountUsd, currentBalance },
					});
				},
				onPaymentSigning: () => {
					publish({
						type: 'setu.payment.signing',
						sessionId,
						payload: {},
					});
				},
				onPaymentComplete: (data) => {
					publish({
						type: 'setu.payment.complete',
						sessionId,
						payload: data,
					});
				},
				onPaymentError: (error) => {
					publish({
						type: 'setu.payment.error',
						sessionId,
						payload: { error },
					});
				},
				onBalanceUpdate: (update) => {
					publish({
						type: 'setu.balance.updated',
						sessionId,
						payload: update,
					});
				},
				onPaymentApproval: async (info): Promise<TopupMethod | 'cancel'> => {
					const suggestedTopupUsd = Math.max(
						MIN_TOPUP_USD,
						Math.ceil(info.amountUsd * 2),
					);

					publish({
						type: 'setu.topup.required',
						sessionId,
						payload: {
							messageId,
							amountUsd: info.amountUsd,
							currentBalance: info.currentBalance,
							minTopupUsd: MIN_TOPUP_USD,
							suggestedTopupUsd,
						},
					});

					return waitForTopupMethodSelection(
						sessionId,
						messageId ?? '',
						info.amountUsd,
						info.currentBalance,
					);
				},
			}
		: {};

	const setu = createSetu({
		auth: { privateKey },
		baseURL,
		rpcURL,
		callbacks,
		middleware: isDevtoolsEnabled() ? devToolsMiddleware() : undefined,
		payment: {
			topupApprovalMode,
			autoPayThresholdUsd,
		},
	});

	return setu.model(model);
}
