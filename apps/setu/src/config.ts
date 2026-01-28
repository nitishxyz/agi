const stage = process.env.STAGE === 'prod' ? 'prod' : 'dev';
const isProdStage = stage === 'prod';

const SOLANA_MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const config = {
	port: 4002,
	minBalance: 0.05,
	markup: 1.005,
	stage,
	isProdStage,

	openai: {
		apiKey: process.env.OPENAI_API_KEY || '',
		baseUrl: 'https://api.openai.com/v1',
	},

	anthropic: {
		apiKey: process.env.ANTHROPIC_API_KEY || '',
		baseUrl: 'https://api.anthropic.com/v1',
	},

	moonshot: {
		apiKey: process.env.MOONSHOT_AI_API_KEY || '',
		baseUrl: 'https://api.moonshot.ai/v1',
	},

	facilitator: {
		url: 'https://facilitator.payai.network',
	},

	payment: {
		companyWallet: process.env.PLATFORM_WALLET || '',
		network: isProdStage ? 'solana' : 'solana-devnet',
		usdcMint: isProdStage ? SOLANA_MAINNET_USDC_MINT : SOLANA_DEVNET_USDC_MINT,
	},

	polar: {
		accessToken: process.env.POLAR_ACCESS_TOKEN || '',
		webhookSecret: process.env.POLAR_WEBHOOK_SECRET || '',
		productId: process.env.POLAR_PRODUCT_ID || '',
		server: isProdStage ? 'production' : 'sandbox',
		minTopupUsd: 5,
		maxTopupUsd: 500,
		fees: {
			basePercent: 0.04,
			internationalPercent: 0.015,
			fixedCents: 40,
		},
	},
} as const;
