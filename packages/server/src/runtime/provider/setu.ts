import {
	createSetuModel,
	catalog,
	type SetuPaymentCallbacks,
} from '@agi-cli/sdk';
import { publish } from '../../events/bus.ts';

function getProviderNpm(model: string): string | undefined {
	const entry = catalog.setu?.models?.find((m) => m.id === model);
	return entry?.provider?.npm;
}

export function resolveSetuModel(model: string, sessionId?: string) {
	const privateKey = process.env.SETU_PRIVATE_KEY ?? '';
	if (!privateKey) {
		throw new Error(
			'Setu provider requires SETU_PRIVATE_KEY (base58 Solana secret).',
		);
	}
	const baseURL = process.env.SETU_BASE_URL;
	const rpcURL = process.env.SETU_SOLANA_RPC_URL;

	const callbacks: SetuPaymentCallbacks = sessionId
		? {
				onPaymentRequired: (amountUsd) => {
					publish({
						type: 'setu.payment.required',
						sessionId,
						payload: { amountUsd },
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
		},
	);
}
