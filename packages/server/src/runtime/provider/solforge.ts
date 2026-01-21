import { createSolforgeModel } from '@agi-cli/sdk';

export function resolveSolforgeModel(model: string) {
	const privateKey = process.env.SOLFORGE_PRIVATE_KEY ?? '';
	if (!privateKey) {
		throw new Error(
			'Solforge provider requires SOLFORGE_PRIVATE_KEY (base58 Solana secret).',
		);
	}
	const baseURL = process.env.SOLFORGE_BASE_URL;
	const rpcURL = process.env.SOLFORGE_SOLANA_RPC_URL;
	const topupAmount = process.env.SOLFORGE_TOPUP_MICRO_USDC;
	return createSolforgeModel(
		model,
		{ privateKey },
		{
			baseURL,
			rpcURL,
			topupAmountMicroUsdc: topupAmount,
		},
	);
}
