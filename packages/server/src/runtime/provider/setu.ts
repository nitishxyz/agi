import {
	createSetuModel,
	catalog,
	type SetuPaymentCallbacks,
} from '@agi-cli/sdk';
import { publish } from '../../events/bus.ts';
import {
	waitForTopupMethodSelection,
	type TopupMethod,
} from '../topup/manager.ts';

const MIN_TOPUP_USD = 5;

function getProviderNpm(model: string): string | undefined {
	const entry = catalog.setu?.models?.find((m) => m.id === model);
	return entry?.provider?.npm;
}

export interface ResolveSetuModelOptions {
	messageId?: string;
	topupApprovalMode?: 'auto' | 'approval';
}

export function resolveSetuModel(
	model: string,
	sessionId?: string,
	options: ResolveSetuModelOptions = {},
) {
	const privateKey = process.env.SETU_PRIVATE_KEY ?? '';
	if (!privateKey) {
		throw new Error(
			'Setu provider requires SETU_PRIVATE_KEY (base58 Solana secret).',
		);
	}
	const baseURL = process.env.SETU_BASE_URL;
	const rpcURL = process.env.SETU_SOLANA_RPC_URL;
	const { messageId, topupApprovalMode = 'approval' } = options;

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

	const providerNpm = getProviderNpm(model);

	return createSetuModel(
		model,
		{ privateKey },
		{
			baseURL,
			rpcURL,
			callbacks,
			providerNpm,
			topupApprovalMode,
		},
	);
}
