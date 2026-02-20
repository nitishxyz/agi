import {
	getAuthStatus as apiGetAuthStatus,
	setupSetuWallet as apiSetupSetuWallet,
	importSetuWallet as apiImportSetuWallet,
	exportSetuWallet as apiExportSetuWallet,
	addProviderApiKey as apiAddProviderApiKey,
	removeProvider as apiRemoveProvider,
	completeOnboarding as apiCompleteOnboarding,
	getOAuthUrl as apiGetOAuthUrl,
	exchangeOAuthCode as apiExchangeOAuthCode,
	startCopilotDeviceFlow as apiStartCopilotDeviceFlow,
	pollCopilotDeviceFlow as apiPollCopilotDeviceFlow,
	getProviderUsage as apiGetProviderUsage,
} from '@ottocode/api';
import type { ProviderUsageResponse } from '../../types/api';
import { extractErrorMessage, getBaseUrl } from './utils';

export const authMixin = {
	async getAuthStatus(): Promise<{
		onboardingComplete: boolean;
		setu: { configured: boolean; publicKey?: string };
		providers: Record<
			string,
			{
				configured: boolean;
				type?: 'api' | 'oauth' | 'wallet';
				label: string;
				supportsOAuth: boolean;
				modelCount: number;
				costRange?: { min: number; max: number };
			}
		>;
		defaults: {
			agent: string;
			provider: string;
			model: string;
			toolApproval?: 'auto' | 'dangerous' | 'all';
		};
	}> {
		const response = await apiGetAuthStatus();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async setupSetuWallet(): Promise<{
		success: boolean;
		publicKey: string;
		isNew: boolean;
	}> {
		const response = await apiSetupSetuWallet();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async importSetuWallet(privateKey: string): Promise<{
		success: boolean;
		publicKey: string;
	}> {
		const response = await apiImportSetuWallet({
			body: { privateKey },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async exportSetuWallet(): Promise<{
		success: boolean;
		publicKey: string;
		privateKey: string;
	}> {
		const response = await apiExportSetuWallet();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async addProvider(
		provider: string,
		apiKey: string,
	): Promise<{ success: boolean; provider: string }> {
		const response = await apiAddProviderApiKey({
			path: { provider },
			body: { apiKey },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async removeProvider(
		provider: string,
	): Promise<{ success: boolean; provider: string }> {
		const response = await apiRemoveProvider({ path: { provider } });
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async completeOnboarding(): Promise<{ success: boolean }> {
		const response = await apiCompleteOnboarding();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	getOAuthStartUrl(provider: string, mode?: string): string {
		const baseUrl = `${getBaseUrl()}/v1/auth/${provider}/oauth/start`;
		if (mode) return `${baseUrl}?mode=${mode}`;
		return baseUrl;
	},

	async getOAuthUrl(
		provider: string,
		mode?: string,
	): Promise<{ url: string; sessionId: string; provider: string }> {
		const response = await apiGetOAuthUrl({
			path: { provider },
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch
			body: { mode } as any,
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async exchangeOAuthCode(
		provider: string,
		code: string,
		sessionId: string,
	): Promise<{ success: boolean; provider: string }> {
		const response = await apiExchangeOAuthCode({
			path: { provider },
			body: { code, sessionId },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async startCopilotDeviceFlow(): Promise<{
		sessionId: string;
		userCode: string;
		verificationUri: string;
		interval: number;
	}> {
		const response = await apiStartCopilotDeviceFlow();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async pollCopilotDeviceFlow(
		sessionId: string,
	): Promise<{ status: 'complete' | 'pending' | 'error'; error?: string }> {
		const response = await apiPollCopilotDeviceFlow({
			body: { sessionId },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async getProviderUsage(provider: string): Promise<ProviderUsageResponse> {
		const response = await apiGetProviderUsage({
			// biome-ignore lint/suspicious/noExplicitAny: API path type mismatch
			path: { provider } as any,
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as ProviderUsageResponse;
	},
};
