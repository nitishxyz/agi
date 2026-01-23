import { createSolforgeModel, catalog, type SolforgePaymentCallbacks } from '@agi-cli/sdk';
import { publish } from '../../events/bus.ts';

function getProviderNpm(model: string): string | undefined {
	const entry = catalog.solforge?.models?.find((m) => m.id === model);
	return entry?.provider?.npm;
}

export function resolveSolforgeModel(model: string, sessionId?: string) {
	const privateKey = process.env.SOLFORGE_PRIVATE_KEY ?? '';
	if (!privateKey) {
		throw new Error(
			'Solforge provider requires SOLFORGE_PRIVATE_KEY (base58 Solana secret).',
		);
	}
	const baseURL = process.env.SOLFORGE_BASE_URL;
	const rpcURL = process.env.SOLFORGE_SOLANA_RPC_URL;
	const topupAmount = process.env.SOLFORGE_TOPUP_MICRO_USDC;

	const callbacks: SolforgePaymentCallbacks = sessionId
		? {
				onPaymentRequired: (amountUsd) => {
					publish({
						type: 'solforge.payment.required',
						sessionId,
						payload: { amountUsd },
					});
				},
				onPaymentSigning: () => {
					publish({
						type: 'solforge.payment.signing',
						sessionId,
						payload: {},
					});
				},
				onPaymentComplete: (data) => {
					publish({
						type: 'solforge.payment.complete',
						sessionId,
						payload: data,
					});
				},
				onPaymentError: (error) => {
					publish({
						type: 'solforge.payment.error',
						sessionId,
						payload: { error },
					});
				},
			}
		: {};

	const providerNpm = getProviderNpm(model);

	return createSolforgeModel(
		model,
		{ privateKey },
		{
			baseURL,
			rpcURL,
			topupAmountMicroUsdc: topupAmount,
			callbacks,
			providerNpm,
		},
	);
}
