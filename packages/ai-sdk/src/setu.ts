import type {
	SetuConfig,
	ProviderId,
	ProviderApiFormat,
	FetchFunction,
	BalanceResponse,
	WalletUsdcBalance,
	SetuAuth,
} from './types.ts';
import { createWalletContext } from './auth.ts';
import type { WalletContext } from './auth.ts';
import { createSetuFetch } from './fetch.ts';
import { ProviderRegistry } from './providers/registry.ts';
import { createModel } from './providers/factory.ts';
import { fetchBalance, fetchWalletUsdcBalance } from './balance.ts';

const DEFAULT_BASE_URL = 'https://api.setu.ottocode.io';

function trimTrailingSlash(url: string) {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

export interface SetuProvider {
	model(modelId: string): ReturnType<typeof createModel>;
}

export interface SetuInstance {
	model(modelId: string): ReturnType<typeof createModel>;
	provider(providerId: ProviderId, apiFormat?: ProviderApiFormat): SetuProvider;
	fetch(): FetchFunction;
	balance(): Promise<BalanceResponse | null>;
	walletBalance(
		network?: 'mainnet' | 'devnet',
	): Promise<WalletUsdcBalance | null>;
	walletAddress: string | null;
	registry: ProviderRegistry;
}

function resolveAuth(auth: SetuAuth): {
	auth: SetuAuth;
	wallet: WalletContext;
} {
	if (auth.signer) {
		return { auth, wallet: createWalletContext(auth) };
	}

	const privateKey = auth.privateKey || process.env.SETU_PRIVATE_KEY;
	if (!privateKey) {
		throw new Error(
			'Setu: either privateKey (or SETU_PRIVATE_KEY env) or signer is required.',
		);
	}
	const resolvedAuth = { ...auth, privateKey };
	return { auth: resolvedAuth, wallet: createWalletContext(resolvedAuth) };
}

export function createSetu(config: SetuConfig): SetuInstance {
	const baseURL = trimTrailingSlash(config.baseURL ?? DEFAULT_BASE_URL);
	const { auth: resolvedAuth, wallet } = resolveAuth(config.auth);
	const registry = new ProviderRegistry(config.providers, config.modelMap);

	const setuFetch = createSetuFetch({
		wallet,
		baseURL,
		rpcURL: config.rpcURL,
		callbacks: config.callbacks,
		cache: config.cache,
		payment: config.payment,
	});

	const modelBaseURL = `${baseURL}/v1`;

	return {
		model(modelId: string) {
			const resolved = registry.resolve(modelId);
			if (!resolved) {
				throw new Error(
					`Setu: unknown model "${modelId}". Register it via providers or modelMap config.`,
				);
			}
			return createModel(
				modelId,
				resolved.apiFormat,
				resolved.providerId,
				modelBaseURL,
				setuFetch,
				config.middleware,
			);
		},

		provider(
			providerId: ProviderId,
			apiFormat?: ProviderApiFormat,
		): SetuProvider {
			return {
				model(modelId: string) {
					const resolved = registry.resolve(modelId);
					const format = apiFormat ?? resolved?.apiFormat ?? 'openai-chat';
					return createModel(
						modelId,
						format,
						providerId,
						modelBaseURL,
						setuFetch,
						config.middleware,
					);
				},
			};
		},

		fetch(): FetchFunction {
			return setuFetch;
		},

		async balance() {
			return fetchBalance(wallet, baseURL);
		},

		async walletBalance(network?: 'mainnet' | 'devnet') {
			const walletAddr = wallet.walletAddress;
			if (!resolvedAuth.privateKey && !walletAddr) {
				return null;
			}
			if (resolvedAuth.privateKey) {
				return fetchWalletUsdcBalance(
					resolvedAuth as Required<Pick<SetuAuth, 'privateKey'>>,
					network,
				);
			}
			return fetchWalletUsdcBalance({ walletAddress: walletAddr }, network);
		},

		walletAddress: wallet.walletAddress,

		registry,
	};
}
